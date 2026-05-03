// Store genérico para persistir arrays em data/<file>.json.
// Auto-save em fila serial. Carrega defaults na primeira leitura quando
// o arquivo não existe.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

export class JsonStore<T> {
  private items: T[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private filepath: string;

  constructor(
    private filename: string,
    private getDefaults: () => T[] | Promise<T[]>,
  ) {
    this.filepath = path.join(DATA_DIR, this.filename);
  }

  private async loadFromDisk(): Promise<T[] | null> {
    try {
      const raw = await fs.readFile(this.filepath, 'utf8');
      return JSON.parse(raw) as T[];
    } catch {
      return null;
    }
  }

  async load(): Promise<T[]> {
    if (this.items !== null) return this.items;
    const onDisk = await this.loadFromDisk();
    if (onDisk !== null) {
      this.items = onDisk;
    } else {
      this.items = await Promise.resolve(this.getDefaults());
      await this.persist();
    }
    return this.items;
  }

  private async persist(): Promise<void> {
    if (this.items === null) return;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(this.filepath, JSON.stringify(this.items, null, 2) + '\n', {
      mode: 0o600,
    });
  }

  private queueWrite(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.persist()).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[json-store] persist failed for ${this.filename}:`, e);
    });
    return this.writeQueue;
  }

  /** Snapshot imutável dos itens. */
  async getAll(): Promise<T[]> {
    const items = await this.load();
    return [...items];
  }

  /** Substitui toda a coleção. */
  async setAll(items: T[]): Promise<void> {
    this.items = [...items];
    await this.queueWrite();
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    const items = await this.load();
    return items.find(predicate) ?? null;
  }

  async filter(predicate: (item: T) => boolean): Promise<T[]> {
    const items = await this.load();
    return items.filter(predicate);
  }

  async add(item: T): Promise<T> {
    await this.load();
    this.items!.push(item);
    await this.queueWrite();
    return item;
  }

  async unshift(item: T): Promise<T> {
    await this.load();
    this.items!.unshift(item);
    await this.queueWrite();
    return item;
  }

  async update(
    predicate: (item: T) => boolean,
    updater: (item: T) => T,
  ): Promise<T | null> {
    await this.load();
    const idx = this.items!.findIndex(predicate);
    if (idx === -1) return null;
    this.items![idx] = updater(this.items![idx]);
    await this.queueWrite();
    return this.items![idx];
  }

  async remove(predicate: (item: T) => boolean): Promise<boolean> {
    await this.load();
    const idx = this.items!.findIndex(predicate);
    if (idx === -1) return false;
    this.items!.splice(idx, 1);
    await this.queueWrite();
    return true;
  }

  /** Aplica mutação em todos os items que casam o predicate (in-place). */
  async mutate(predicate: (item: T) => boolean, mutator: (item: T) => void): Promise<number> {
    await this.load();
    let count = 0;
    for (const item of this.items!) {
      if (predicate(item)) {
        mutator(item);
        count++;
      }
    }
    if (count > 0) await this.queueWrite();
    return count;
  }
}
