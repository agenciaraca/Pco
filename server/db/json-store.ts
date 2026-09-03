// Store genérico para persistir arrays em data/<file>.json.
// Auto-save em fila serial. Carrega defaults na primeira leitura quando
// o arquivo **não existe**.
//
// Três decisões deste arquivo foram tomadas em 3/set/2026 e valem ser lidas
// antes de mexer aqui, porque todas as três consertam o mesmo acidente:
//
// 1. **A gravação é atômica** (`.tmp` + `rename`). Antes era `writeFile`
//    direto sobre o arquivo final — que trunca e reescreve. Interrupção no
//    meio (o `pm2 restart` de todo deploy, um OOM, um SIGKILL) deixava JSON
//    inválido no disco.
//
// 2. **Arquivo ilegível falha alto; arquivo ausente semeia.** Antes, o
//    `catch` de `loadFromDisk` engolia *qualquer* erro — inclusive o
//    `JSON.parse` falhando — e devolvia `null`, que o `load()` interpretava
//    como "não existe": carregava os defaults e **gravava os defaults por
//    cima do arquivo corrompido**. Para `lesson-progress.json` o default é
//    `[]`, então o progresso de todos os alunos virava vazio, sem log, sem
//    alerta, e sem meio de distinguir "ninguém estudou" de "o arquivo morreu".
//    Os dois eventos do item 1 e do item 2 se encaixam: o deploy criava a
//    corrupção, a primeira leitura seguinte a tornava permanente.
//
// 3. **Falha de escrita chega ao chamador.** Antes o `.catch()` da fila só
//    logava, e o `await` de `add`/`update`/`remove` sempre resolvia: disco
//    cheio ou volume somente-leitura faziam a rota responder 201 com um
//    objeto que existia só na RAM e sumia no próximo restart.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

/**
 * Todas as instâncias vivas, para que o encerramento do processo possa
 * esperar a fila de escrita esvaziar em vez de matar no meio.
 */
const instancias = new Set<JsonStore<unknown>>();

/**
 * Espera terminar toda escrita pendente de todos os stores.
 *
 * Chamado no `SIGTERM`/`SIGINT` do servidor. Sem isso, `process.exit(0)`
 * interrompe a gravação em andamento — que é justamente o gatilho do item 1
 * do cabeçalho, e acontece em todo `pm2 restart`.
 */
export async function drenarEscritasPendentes(): Promise<void> {
  await Promise.allSettled([...instancias].map((s) => s.aguardarEscritas()));
}

export class JsonStore<T> {
  /** Torna único o nome do arquivo temporário de cada gravação. */
  private static sequencia = 0;

  private items: T[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private filepath: string;
  /** Carga em andamento, para que N chamadas simultâneas façam UMA leitura. */
  private carregando: Promise<T[]> | null = null;

  constructor(
    private filename: string,
    private getDefaults: () => T[] | Promise<T[]>,
  ) {
    this.filepath = path.join(DATA_DIR, this.filename);
    instancias.add(this as unknown as JsonStore<unknown>);
  }

  /**
   * `null` significa **arquivo ausente** — e só isso. Conteúdo ilegível
   * lança, porque semear por cima do que não se conseguiu ler é apagar dado.
   */
  private async loadFromDisk(): Promise<T[] | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filepath, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw await this.erroDeArquivoIlegivel(
        `não é JSON válido (${(e as Error).message})`,
      );
    }
    if (!Array.isArray(parsed)) {
      throw await this.erroDeArquivoIlegivel(
        `é JSON válido mas não é um array (veio ${typeof parsed})`,
      );
    }
    return parsed as T[];
  }

  /**
   * Preserva o arquivo ilegível ao lado, com carimbo, e devolve um erro que
   * diz o que fazer. Preservar é o ponto: o conteúdo pode ser recuperável à
   * mão, e sobrescrevê-lo com a semente destrói a única cópia.
   */
  private async erroDeArquivoIlegivel(motivo: string): Promise<Error> {
    const copia = `${this.filepath}.corrompido-${Date.now()}`;
    let preservado = false;
    try {
      await fs.copyFile(this.filepath, copia);
      preservado = true;
    } catch {
      // Se nem copiar deu, ainda assim recusamos carregar.
    }
    return new Error(
      `[json-store] ${this.filename} ${motivo}. O arquivo NÃO foi sobrescrito` +
        (preservado ? ` e uma cópia ficou em ${path.basename(copia)}` : '') +
        `. Recupere-o do backup ou apague-o de propósito para que a semente seja recarregada.`,
    );
  }

  /**
   * Carrega uma vez, mesmo chamado N vezes ao mesmo tempo.
   *
   * Sem o `carregando`, duas rotas simultâneas no primeiro acesso a um store
   * viam ambas `items === null`, ambas rodavam `getDefaults()` e ambas
   * gravavam — dobrando o trabalho e disputando o arquivo temporário.
   */
  async load(): Promise<T[]> {
    if (this.items !== null) return this.items;
    if (this.carregando) return this.carregando;
    this.carregando = (async () => {
      const onDisk = await this.loadFromDisk();
      if (onDisk !== null) {
        this.items = onDisk;
      } else {
        this.items = await Promise.resolve(this.getDefaults());
        // Pela FILA, e não direto: a gravação da semente também precisa ser
        // serializada com as demais e, sobretudo, precisa ser esperável por
        // `drenarEscritasPendentes()` no encerramento. Chamando `persist()`
        // aqui, ela ficava fora do controle da fila.
        await this.queueWrite();
      }
      return this.items;
    })();
    try {
      return await this.carregando;
    } finally {
      this.carregando = null;
    }
  }

  /**
   * Escreve num temporário e renomeia. `rename` no mesmo volume é atômico:
   * ou o arquivo antigo está inteiro, ou o novo está inteiro — nunca metade.
   */
  private async persist(): Promise<void> {
    if (this.items === null) return;
    await fs.mkdir(DATA_DIR, { recursive: true });
    // O sufixo precisa ser único por GRAVAÇÃO, não por processo. Com
    // `.tmp-<pid>` fixo, duas escritas do mesmo store que se sobreponham
    // disputam o mesmo arquivo: a primeira renomeia, a segunda encontra o
    // temporário já movido e falha com ENOENT (ou EPERM, no Windows).
    // Aconteceu de verdade — dois `load()` concorrentes chamando `persist()`
    // fora da fila, ver o comentário de `load`.
    const temporario = `${this.filepath}.tmp-${process.pid}-${++JsonStore.sequencia}`;
    const conteudo = JSON.stringify(this.items, null, 2) + '\n';
    try {
      await fs.writeFile(temporario, conteudo, { mode: 0o600 });
      await fs.rename(temporario, this.filepath);
    } catch (e) {
      await fs.rm(temporario, { force: true }).catch(() => {});
      throw e;
    }
  }

  /**
   * Enfileira uma gravação. A falha vai para **quem chamou** (que responde
   * erro ao usuário em vez de fingir sucesso), mas não envenena a fila: a
   * próxima escrita ainda é tentada.
   */
  private queueWrite(): Promise<void> {
    const minha = this.writeQueue.then(
      () => this.persist(),
      () => this.persist(),
    );
    this.writeQueue = minha.catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[json-store] persist failed for ${this.filename}:`, e);
    });
    return minha;
  }

  /** Resolve quando a fila de escrita deste store estiver vazia. */
  async aguardarEscritas(): Promise<void> {
    await this.writeQueue;
  }

  /**
   * Snapshot do array. **A cópia é rasa**: os objetos são os mesmos que estão
   * em memória. Mutar `item.campo` do que sai daqui altera o estado do store
   * sem enfileirar escrita — a mudança vale até o restart e some. Para
   * alterar, use `update`, `mutate` ou `modify`.
   */
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

  /**
   * Permite mutação arbitrária do array interno (incluindo nested) com
   * auto-save garantido. O retorno do mutator é repassado.
   */
  async modify<R>(mutator: (items: T[]) => R | Promise<R>): Promise<R> {
    await this.load();
    const result = await Promise.resolve(mutator(this.items!));
    await this.queueWrite();
    return result;
  }
}
