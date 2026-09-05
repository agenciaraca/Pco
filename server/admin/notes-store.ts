// Notas que admins escrevem sobre alunos.
//
// **Não aparecem em tela nenhuma do aluno** — nem na estante, nem no perfil,
// nem em resposta de API do produto. Mas o corpo da nota **sai na exportação
// de dados** (`GET /me/export`): é juízo sobre a pessoa, feito sem que ela
// saiba, e é exatamente o que o direito de acesso existe para alcançar (LGPD,
// art. 18, II). O que não sai é `authorId`/`authorEmail`, que são dado pessoal
// do funcionário que escreveu.
//
// Este comentário dizia apenas "não visíveis ao aluno" e ficou em contradição
// com a rota por um dia — a auditoria registrou as duas afirmações lado a lado.
// Quem escrever uma nota aqui deve saber que ela é legível pelo titular.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface AdminNote {
  id: string;
  studentId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<AdminNote>('admin-notes.json', () => []);

function newId(): string {
  return `note-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listForStudent(studentId: string): Promise<AdminNote[]> {
  const all = await store.filter((n) => n.studentId === studentId);
  return [...all].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt > a.createdAt ? 1 : -1;
  });
}

export async function findById(id: string): Promise<AdminNote | null> {
  return await store.findOne((n) => n.id === id);
}

export interface CreateNoteInput {
  studentId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  pinned?: boolean;
}

export async function createNote(input: CreateNoteInput): Promise<AdminNote> {
  const now = new Date().toISOString();
  const n: AdminNote = {
    id: newId(),
    studentId: input.studentId,
    authorId: input.authorId,
    authorEmail: input.authorEmail,
    body: input.body,
    pinned: input.pinned ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(n);
  return n;
}

export async function updateNote(
  id: string,
  patch: { body?: string; pinned?: boolean },
): Promise<AdminNote | null> {
  return await store.update(
    (n) => n.id === id,
    (n) => ({
      ...n,
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function deleteNote(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((n) => n.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}
