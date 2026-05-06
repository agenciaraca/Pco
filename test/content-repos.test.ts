import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let news: typeof import('../server/repositories/news');
let library: typeof import('../server/repositories/library');
let podcasts: typeof import('../server/repositories/podcasts');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cont-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  news = await import('../server/repositories/news');
  library = await import('../server/repositories/library');
  podcasts = await import('../server/repositories/podcasts');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/news', () => {
  it('listNews retorna seed', async () => {
    const list = await news.listNews();
    expect(list.length).toBeGreaterThan(0);
  });

  it('createNews + findNews + updateNews + deleteNews', async () => {
    const created = await news.createNews({
      title: 'Teste de notícia',
      excerpt: 'Resumo de teste',
      body: 'Corpo opcional',
      category: 'Geral',
      tags: ['x', 'y'],
      coverColor: 'from-pco-blue to-pco-cyan',
      authorName: 'Equipe PCO',
      publishedAt: '2026-05-05',
      featured: false,
      relatedCourseIds: [],
    });
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Teste de notícia');

    const found = await news.findNews(created.id);
    expect(found!.id).toBe(created.id);

    const updated = await news.updateNews(created.id, {
      title: 'Atualizado',
      featured: true,
    });
    expect(updated!.title).toBe('Atualizado');
    expect(updated!.featured).toBe(true);

    expect(await news.deleteNews(created.id)).toBe(true);
    expect(await news.deleteNews(created.id)).toBe(false);
    expect(await news.findNews(created.id)).toBeNull();
  });
});

describe('repositories/library', () => {
  it('listLibrary retorna seed', async () => {
    const list = await library.listLibrary();
    expect(list.length).toBeGreaterThan(0);
  });

  it('listLibrary filtra por type', async () => {
    const created = await library.createLibrary({
      title: 'Artigo Filtro',
      author: 'A',
      type: 'artigo',
      mandatory: false,
      fileMockUrl: '#',
      relatedCourseIds: [],
      relatedModuleIds: [],
    });
    const arts = await library.listLibrary({ type: 'artigo' });
    expect(arts.every((i) => i.type === 'artigo')).toBe(true);
    expect(arts.some((i) => i.id === created.id)).toBe(true);
  });

  it('listLibrary filtra mandatoryOnly', async () => {
    await library.createLibrary({
      title: 'Obrigatório',
      author: 'X',
      type: 'artigo',
      mandatory: true,
      fileMockUrl: '#',
      relatedCourseIds: [],
      relatedModuleIds: [],
    });
    const must = await library.listLibrary({ mandatoryOnly: true });
    expect(must.every((i) => i.mandatory)).toBe(true);
    expect(must.length).toBeGreaterThan(0);
  });

  it('listLibrary filtra por courseId em relatedCourseIds', async () => {
    await library.createLibrary({
      title: 'Vinculado',
      author: 'X',
      type: 'artigo',
      mandatory: false,
      fileMockUrl: '#',
      relatedCourseIds: ['c-vinc'],
      relatedModuleIds: [],
    });
    const r = await library.listLibrary({ courseId: 'c-vinc' });
    expect(r.every((i) => i.relatedCourseIds?.includes('c-vinc'))).toBe(true);
  });

  it('updateLibrary altera campos + deleteLibrary remove', async () => {
    const c = await library.createLibrary({
      title: 'CRUD',
      author: 'A',
      type: 'artigo',
      mandatory: false,
      fileMockUrl: '#',
      relatedCourseIds: [],
      relatedModuleIds: [],
    });
    const u = await library.updateLibrary(c.id, { title: 'Renomeado' });
    expect(u!.title).toBe('Renomeado');
    expect(await library.deleteLibrary(c.id)).toBe(true);
    expect(await library.findLibrary(c.id)).toBeNull();
  });
});

describe('repositories/podcasts', () => {
  it('listPodcasts retorna seed', async () => {
    const list = await podcasts.listPodcasts();
    expect(list.length).toBeGreaterThan(0);
  });

  it('createPodcast + findPodcast', async () => {
    const c = await podcasts.createPodcast({
      title: 'Episódio teste',
      description: 'Descrição completa do episódio',
      durationMinutes: 45,
      publishedAt: '2026-05-05',
      coverColor: 'from-pco-blue to-pco-cyan',
      audioUrl: '',
      relatedCourseIds: [],
      relatedModuleIds: [],
    });
    expect(c.id).toBeTruthy();
    const found = await podcasts.findPodcast(c.id);
    expect(found!.id).toBe(c.id);
  });

  it('updatePodcast altera duração', async () => {
    const c = await podcasts.createPodcast({
      title: 'Update',
      description: 'desc longa o suficiente',
      durationMinutes: 30,
      publishedAt: '2026-05-05',
      coverColor: 'from-pco-blue to-pco-cyan',
      relatedCourseIds: [],
      relatedModuleIds: [],
    });
    const u = await podcasts.updatePodcast(c.id, { durationMinutes: 60 });
    expect(u!.durationMinutes).toBe(60);
  });

  it('deletePodcast idempotente', async () => {
    const c = await podcasts.createPodcast({
      title: 'Del',
      description: 'desc desc desc',
      durationMinutes: 20,
      publishedAt: '2026-05-05',
      coverColor: 'from-pco-blue to-pco-cyan',
      relatedCourseIds: [],
      relatedModuleIds: [],
    });
    expect(await podcasts.deletePodcast(c.id)).toBe(true);
    expect(await podcasts.deletePodcast(c.id)).toBe(false);
  });
});
