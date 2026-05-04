// Busca global do aluno — varre conteúdos públicos: cursos/aulas/biblioteca/news/podcasts.
// Não inclui usuários (privacidade).

import * as coursesRepo from '../repositories/courses';
import * as libraryRepo from '../repositories/library';
import * as newsRepo from '../repositories/news';
import * as podcastsRepo from '../repositories/podcasts';

export interface StudentSearchHit {
  type: 'course' | 'lesson' | 'library' | 'news' | 'podcast';
  id: string;
  title: string;
  snippet: string;
  link: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function matches(haystack: string, needle: string): boolean {
  if (!haystack) return false;
  return norm(haystack).includes(needle);
}

function snippet(text: string | null | undefined, max = 120): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max).trim() + '…' : text;
}

export async function studentSearch(query: string, limit = 30): Promise<StudentSearchHit[]> {
  const q = norm(query.trim());
  if (q.length < 2) return [];

  const hits: StudentSearchHit[] = [];

  const courses = await coursesRepo.listCourses();
  for (const c of courses) {
    if (matches(c.title, q) || matches(c.description, q)) {
      hits.push({
        type: 'course',
        id: c.id,
        title: c.title,
        snippet: snippet(c.description),
        link: `/curso/${c.id}`,
      });
    }
    for (const m of c.modules ?? []) {
      for (const l of m.lessons ?? []) {
        if (matches(l.title, q) || matches(l.description ?? '', q)) {
          hits.push({
            type: 'lesson',
            id: l.id,
            title: `${c.shortTitle} › ${l.title}`,
            snippet: snippet(l.description),
            link: `/curso/${c.id}/aula/${l.id}`,
          });
        }
      }
    }
  }

  const lib = await libraryRepo.listLibrary();
  for (const item of lib) {
    if (matches(item.title, q) || matches(item.author, q) || matches(item.theme ?? '', q)) {
      hits.push({
        type: 'library',
        id: item.id,
        title: item.title,
        snippet: snippet(`${item.author} · ${item.theme ?? item.type}`),
        link: '/biblioteca',
      });
    }
  }

  const news = await newsRepo.listNews();
  for (const n of news) {
    if (matches(n.title, q) || matches(n.excerpt ?? '', q) || matches(n.body ?? '', q)) {
      hits.push({
        type: 'news',
        id: n.id,
        title: n.title,
        snippet: snippet(n.excerpt ?? n.body),
        link: '/news',
      });
    }
  }

  const pods = await podcastsRepo.listPodcasts();
  for (const p of pods) {
    if (matches(p.title, q) || matches(p.description ?? '', q)) {
      hits.push({
        type: 'podcast',
        id: p.id,
        title: p.title,
        snippet: snippet(p.description),
        link: `/podcasts/${p.id}`,
      });
    }
  }

  return hits.slice(0, limit);
}
