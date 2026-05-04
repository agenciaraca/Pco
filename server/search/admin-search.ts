// Busca global admin — vasculha cursos/módulos/aulas/biblioteca/news/podcasts/usuários.
// Tudo in-memory por enquanto (volume baixo). Futuramente, índice incremental.

import * as coursesRepo from '../repositories/courses';
import * as libraryRepo from '../repositories/library';
import * as newsRepo from '../repositories/news';
import * as podcastsRepo from '../repositories/podcasts';
import * as usersStore from '../auth/users-store';
import * as ordersRepo from '../payments/orders-repo';
import * as productsRepo from '../payments/products-repo';

export interface SearchHit {
  type:
    | 'course'
    | 'module'
    | 'lesson'
    | 'library'
    | 'news'
    | 'podcast'
    | 'user'
    | 'order'
    | 'product';
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

export async function search(query: string, limit = 30): Promise<SearchHit[]> {
  const q = norm(query.trim());
  if (q.length < 2) return [];

  const hits: SearchHit[] = [];

  // Cursos + módulos + aulas + avaliações
  const courses = await coursesRepo.listCourses();
  for (const c of courses) {
    if (matches(c.title, q) || matches(c.description, q)) {
      hits.push({
        type: 'course',
        id: c.id,
        title: c.title,
        snippet: snippet(c.description),
        link: `/admin/cursos/${c.id}`,
      });
    }
    for (const m of c.modules ?? []) {
      if (matches(m.title, q) || matches(m.description ?? '', q)) {
        hits.push({
          type: 'module',
          id: m.id,
          title: `${c.title} › ${m.title}`,
          snippet: snippet(m.description),
          link: `/admin/cursos/${c.id}`,
        });
      }
      for (const l of m.lessons ?? []) {
        if (matches(l.title, q) || matches(l.description ?? '', q)) {
          hits.push({
            type: 'lesson',
            id: l.id,
            title: `${m.title} › ${l.title}`,
            snippet: snippet(l.description),
            link: `/admin/cursos/${c.id}`,
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
        link: '/admin/biblioteca',
      });
    }
  }

  const news = await newsRepo.listNews();
  for (const n of news) {
    if (
      matches(n.title, q) ||
      matches(n.excerpt ?? '', q) ||
      matches(n.body ?? '', q)
    ) {
      hits.push({
        type: 'news',
        id: n.id,
        title: n.title,
        snippet: snippet(n.excerpt ?? n.body),
        link: '/admin/news',
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
        link: '/admin/podcasts',
      });
    }
  }

  const users = await usersStore.listUsers();
  for (const u of users) {
    if (matches(u.name, q) || matches(u.email, q)) {
      hits.push({
        type: 'user',
        id: u.id,
        title: u.name,
        snippet: `${u.email} · ${u.role}${u.active ? '' : ' · inativo'}`,
        link: u.role === 'student' ? `/admin/alunos/${u.id}` : '/admin/usuarios',
      });
    }
  }

  try {
    const orders = await ordersRepo.listAll();
    for (const o of orders) {
      if (
        matches(o.id, q) ||
        matches(o.userEmail, q) ||
        matches(o.productSnapshot.name, q) ||
        matches(o.externalId ?? '', q)
      ) {
        hits.push({
          type: 'order',
          id: o.id,
          title: `Pedido ${o.id}`,
          snippet: `${o.userEmail} · ${o.productSnapshot.name} · ${o.status}`,
          link: '/admin/pedidos',
        });
      }
    }
  } catch {
    // ignora se módulo não pronto
  }

  try {
    const products = await productsRepo.listAll();
    for (const p of products) {
      if (matches(p.name, q) || matches(p.description ?? '', q)) {
        hits.push({
          type: 'product',
          id: p.id,
          title: p.name,
          snippet: `${p.kind} · ${(p.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: p.currency || 'BRL' })}`,
          link: '/admin/produtos',
        });
      }
    }
  } catch {
    // ignora
  }

  return hits.slice(0, limit);
}
