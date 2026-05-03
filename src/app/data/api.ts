// Camada de API mockada — espelha o contrato REST que o backend real exporá.
// Cada função retorna Promise para o consumidor poder usar TanStack Query
// uniformemente. Quando o backend existir, basta trocar o corpo das funções
// por fetch/axios para o endpoint real, mantendo a mesma assinatura.

import {
  courses,
  newsArticles,
  podcasts,
  libraryItems,
  certificates,
  retentionRisks,
  professionals,
  sessionServices,
  seoTimeseries,
  keywords,
  aiConfigurations,
  supportTickets,
  adminStudents,
  currentStudent,
  type AdminStudentRow,
} from './seed';
import type {
  Course,
  Student,
  NewsArticle,
  PodcastEpisode,
  LibraryItem,
  Certificate,
  RetentionRisk,
  Professional,
  SessionService,
  SeoMetric,
  KeywordMetric,
  AiConfiguration,
  SupportTicket,
  RecoveryPlan,
} from '../types/schema';

const NETWORK_DELAY = 350;
const FAILURE_RATE = 0; // 0..1 — coloque 0.05 para simular falhas eventuais em dev

function delay<T>(value: T, ms = NETWORK_DELAY): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < FAILURE_RATE) {
        reject(new Error('Falha de rede simulada'));
      } else {
        resolve(value);
      }
    }, ms);
  });
}

function clone<T>(v: T): T {
  return typeof structuredClone !== 'undefined'
    ? structuredClone(v)
    : (JSON.parse(JSON.stringify(v)) as T);
}

// ---------- Auth / current user ----------

export async function fetchCurrentStudent(): Promise<Student> {
  return delay(clone(currentStudent));
}

// ---------- Courses ----------

export async function fetchCourses(): Promise<Course[]> {
  return delay(clone(courses));
}

export async function fetchCourse(id: string): Promise<Course | null> {
  return delay(clone(courses.find((c) => c.id === id) ?? null));
}

// ---------- News ----------

export async function fetchNews(): Promise<NewsArticle[]> {
  return delay(clone(newsArticles));
}

// ---------- Podcasts ----------

export async function fetchPodcasts(): Promise<PodcastEpisode[]> {
  return delay(clone(podcasts));
}

export async function fetchPodcastEpisode(id: string): Promise<PodcastEpisode | null> {
  return delay(clone(podcasts.find((p) => p.id === id) ?? null));
}

// ---------- Library ----------

export async function fetchLibrary(filters?: {
  type?: string;
  courseId?: string;
  mandatoryOnly?: boolean;
}): Promise<LibraryItem[]> {
  let list = libraryItems;
  if (filters?.type) list = list.filter((i) => i.type === filters.type);
  if (filters?.courseId)
    list = list.filter((i) => i.relatedCourseIds?.includes(filters.courseId!));
  if (filters?.mandatoryOnly) list = list.filter((i) => i.mandatory);
  return delay(clone(list));
}

// ---------- Certificates ----------

export async function fetchCertificates(): Promise<Certificate[]> {
  return delay(clone(certificates));
}

// ---------- Retention / risks ----------

export async function fetchRetentionRisks(level?: string): Promise<RetentionRisk[]> {
  let list = retentionRisks;
  if (level && level !== 'todos') list = list.filter((r) => r.level === level);
  return delay(clone(list));
}

// ---------- Sessions / professionals ----------

export async function fetchProfessionals(): Promise<Professional[]> {
  return delay(clone(professionals));
}

export async function fetchSessionServices(): Promise<SessionService[]> {
  return delay(clone(sessionServices));
}

// ---------- Metrics (SEO) ----------

export async function fetchSeoTimeseries(_range = '30d'): Promise<SeoMetric[]> {
  return delay(clone(seoTimeseries));
}

export async function fetchKeywords(): Promise<KeywordMetric[]> {
  return delay(clone(keywords));
}

// ---------- AI configurations ----------

export async function fetchAiConfigurations(): Promise<AiConfiguration[]> {
  return delay(clone(aiConfigurations));
}

// ---------- Support ----------

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  return delay(clone(supportTickets));
}

export async function createSupportTicket(input: {
  subject: string;
  category: SupportTicket['category'];
  message: string;
}): Promise<SupportTicket> {
  const ticket: SupportTicket = {
    id: `t-${Date.now()}`,
    studentId: currentStudent.id,
    subject: input.subject,
    category: input.category,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: input.message,
  };
  return delay(ticket, 600);
}

// ---------- Admin students ----------

export interface StudentsFilter {
  search?: string;
  status?: string;
  courseId?: string;
  sortBy?: 'name' | 'risk' | 'lastAccess';
}

export async function fetchAdminStudents(
  filters: StudentsFilter = {},
): Promise<AdminStudentRow[]> {
  let list = [...adminStudents];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }
  if (filters.status && filters.status !== 'todos')
    list = list.filter((s) => s.status === filters.status);
  if (filters.courseId && filters.courseId !== 'todos')
    list = list.filter((s) => s.enrolledCourseIds.includes(filters.courseId!));
  list.sort((a, b) => {
    if (filters.sortBy === 'risk') return b.riskScore - a.riskScore;
    if (filters.sortBy === 'lastAccess')
      return new Date(b.lastAccessAt).getTime() - new Date(a.lastAccessAt).getTime();
    return a.name.localeCompare(b.name);
  });
  return delay(clone(list));
}

export async function fetchAdminStudent(id: string): Promise<AdminStudentRow | null> {
  return delay(clone(adminStudents.find((s) => s.id === id) ?? null));
}

// ---------- Recovery plans ----------

export async function generateRecoveryPlan(input: {
  studentId: string;
  tone: 'acolhedor' | 'direto' | 'motivacional';
  channel: 'email' | 'whatsapp' | 'in_app';
  intensity: 'leve' | 'media' | 'intensa';
  goal: string;
  includeTutor: boolean;
  includePod: boolean;
  includeLibrary: boolean;
}): Promise<{ message: string; plan: Partial<RecoveryPlan> }> {
  const message = `Plano gerado (mock) com tom ${input.tone}, canal ${input.channel}, intensidade ${input.intensity}.`;
  return delay(
    {
      message,
      plan: {
        studentId: input.studentId,
        tone: input.tone,
        channel: input.channel,
        intensity: input.intensity,
        goal: input.goal,
        message,
        weeklyGoalMinutes: 120,
        status: 'draft',
      },
    },
    900,
  );
}
