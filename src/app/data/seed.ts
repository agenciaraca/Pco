import type {
  ID,
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
  SupportTicket,
} from '../types/schema';

export const currentStudent: Student = {
  id: 'stu-001',
  name: 'Aluno Demo',
  email: 'aluno@pco.local',
  role: 'student',
  enrolledCourseIds: ['c-psi', 'c-tfs', 'c-hipno'],
  lastAccessAt: new Date().toISOString(),
  weeklyGoalMinutes: 180,
  totalStudyMinutes: 1240,
  riskScore: 18,
  createdAt: '2025-09-12T00:00:00Z',
};

const buildModules = (courseId: string, prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-mod-${i + 1}`,
    courseId,
    title: `Módulo ${i + 1}`,
    order: i + 1,
    description: `Conteúdo introdutório do módulo ${i + 1}.`,
    status:
      i === 0
        ? ('completed' as const)
        : i === 1
          ? ('in_progress' as const)
          : i < 4
            ? ('available' as const)
            : ('locked' as const),
    lessons: Array.from({ length: 4 }, (_, j) => ({
      id: `${prefix}-mod-${i + 1}-les-${j + 1}`,
      moduleId: `${prefix}-mod-${i + 1}`,
      courseId,
      title: `Aula ${j + 1} — Conceitos fundamentais`,
      durationMinutes: 18 + j * 2,
      isMandatory: j < 3,
      order: j + 1,
      status:
        i === 0
          ? ('completed' as const)
          : i === 1 && j < 2
            ? ('completed' as const)
            : i === 1 && j === 2
              ? ('in_progress' as const)
              : ('available' as const),
    })),
    assessment: {
      id: `${prefix}-mod-${i + 1}-aval`,
      moduleId: `${prefix}-mod-${i + 1}`,
      courseId,
      title: `Avaliação do Módulo ${i + 1}`,
      questionCount: 10,
      passingScore: 70,
      status: i === 0 ? ('passed' as const) : ('available' as const),
    },
  }));

export const courses: Course[] = [
  {
    id: 'c-psi',
    slug: 'psicanalise-clinica',
    title: 'Psicanálise Clínica',
    shortTitle: 'Psicanálise',
    description:
      'Formação completa em psicanálise clínica com abordagem contemporânea, casos e supervisão.',
    coverColor: 'from-pco-blue to-pco-cyan',
    modules: buildModules('c-psi', 'psi', 8),
    totalHours: 240,
    certificateAvailable: true,
  },
  {
    id: 'c-tfs',
    slug: 'terapia-familiar-sistemica',
    title: 'Terapia Familiar Sistêmica',
    shortTitle: 'Familiar',
    description:
      'Abordagem sistêmica para famílias e relações, com fundamentos teóricos e aplicação prática.',
    coverColor: 'from-pco-cyan to-pco-cyan-light',
    modules: buildModules('c-tfs', 'tfs', 6),
    totalHours: 180,
    certificateAvailable: true,
  },
  {
    id: 'c-hipno',
    slug: 'hipnoterapia',
    title: 'Hipnoterapia',
    shortTitle: 'Hipno',
    description:
      'Hipnose terapêutica com base científica, integrada à prática clínica de cuidado.',
    coverColor: 'from-pco-orange to-[#FFB347]',
    modules: buildModules('c-hipno', 'hip', 5),
    totalHours: 120,
    certificateAvailable: true,
  },
];

export const newsArticles: NewsArticle[] = [
  {
    id: 'n-1',
    title: 'O retorno do simbólico na clínica contemporânea',
    excerpt:
      'Como a escuta psicanalítica responde aos sintomas do nosso tempo, da angústia digital às novas formas de subjetivação.',
    category: 'Estudos',
    tags: ['psicanálise', 'clínica', 'contemporâneo'],
    coverColor: 'from-pco-blue to-pco-deep',
    authorName: 'Equipe PCO',
    publishedAt: '2026-04-22',
    featured: true,
    relatedCourseIds: ['c-psi'],
  },
  {
    id: 'n-2',
    title: 'Sistema familiar: padrões que se repetem em três gerações',
    excerpt:
      'Estudo comentado sobre transmissão psíquica e padrões geracionais em terapia sistêmica.',
    category: 'Notícias da escola',
    tags: ['família', 'sistêmica'],
    coverColor: 'from-pco-cyan to-pco-cyan-light',
    authorName: 'Curadoria PCO',
    publishedAt: '2026-04-15',
    relatedCourseIds: ['c-tfs'],
  },
  {
    id: 'n-3',
    title: 'Hipnose clínica e evidências: o que a ciência diz hoje',
    excerpt:
      'Uma revisão acessível das evidências contemporâneas em hipnoterapia.',
    category: 'Recomendado',
    tags: ['hipnose', 'evidências'],
    coverColor: 'from-pco-orange to-[#FFC76A]',
    authorName: 'Equipe PCO',
    publishedAt: '2026-04-08',
    relatedCourseIds: ['c-hipno'],
  },
];

export const podcasts: PodcastEpisode[] = [
  {
    id: 'p-1',
    title: 'O ato analítico além da técnica',
    description:
      'Conversa sobre o que diferencia a escuta psicanalítica de outras abordagens.',
    durationMinutes: 42,
    publishedAt: '2026-04-20',
    coverColor: 'from-pco-blue to-pco-deep',
    relatedCourseIds: ['c-psi'],
    listened: true,
  },
  {
    id: 'p-2',
    title: 'Genograma na prática familiar',
    description:
      'Como construir e ler um genograma para entender padrões sistêmicos.',
    durationMinutes: 35,
    publishedAt: '2026-04-12',
    coverColor: 'from-pco-cyan to-pco-cyan-light',
    relatedCourseIds: ['c-tfs'],
    favorite: true,
  },
  {
    id: 'p-3',
    title: 'Indução hipnótica clínica passo a passo',
    description: 'Demonstração comentada de um processo de indução clínica.',
    durationMinutes: 28,
    publishedAt: '2026-04-04',
    coverColor: 'from-pco-orange to-[#FFC76A]',
    relatedCourseIds: ['c-hipno'],
  },
];

export const libraryItems: LibraryItem[] = [
  {
    id: 'l-1',
    title: 'Cadernos PCO — Fundamentos da escuta clínica',
    author: 'Curadoria PCO',
    type: 'apostila',
    mandatory: true,
    fileMockUrl: '#',
    relatedCourseIds: ['c-psi'],
    theme: 'Fundamentos',
  },
  {
    id: 'l-2',
    title: 'Mapa sistêmico — guia prático',
    author: 'Curadoria PCO',
    type: 'pdf',
    mandatory: false,
    fileMockUrl: '#',
    relatedCourseIds: ['c-tfs'],
    theme: 'Sistêmica',
  },
  {
    id: 'l-3',
    title: 'Estudos em hipnose clínica',
    author: 'Diversos',
    type: 'leitura',
    mandatory: false,
    fileMockUrl: '#',
    relatedCourseIds: ['c-hipno'],
    theme: 'Hipnose',
  },
];

export const certificates: Certificate[] = [
  {
    id: 'cert-1',
    courseId: 'c-psi',
    studentId: 'stu-001',
    validationCode: 'PCO-PSI-7K3M-9X2',
    qrCodeMockUrl: '#',
    status: 'in_progress',
    progress: 38,
  },
  {
    id: 'cert-2',
    courseId: 'c-tfs',
    studentId: 'stu-001',
    validationCode: 'PCO-TFS-2J8R-5Q1',
    qrCodeMockUrl: '#',
    status: 'in_progress',
    progress: 12,
  },
];

export const retentionRisks: RetentionRisk[] = [
  {
    studentId: 's-101',
    studentName: 'Carla M.',
    score: 82,
    level: 'critico',
    reasons: ['Sem acesso há 21 dias', 'Avaliação pendente', 'Tutor sem uso'],
    lastAccessAt: '2026-04-11',
    expectedProgress: 38,
    realProgress: 14,
    pendingAssessments: 2,
    tutorUsage: 0,
    podConsumption: 1,
    libraryInteractions: 0,
    recommendedAction: 'Plano de retomada com IA + contato pedagógico',
  },
  {
    studentId: 's-102',
    studentName: 'Diego R.',
    score: 64,
    level: 'alto',
    reasons: ['Ritmo abaixo da meta semanal', 'Módulo travado'],
    lastAccessAt: '2026-04-26',
    expectedProgress: 50,
    realProgress: 32,
    pendingAssessments: 1,
    tutorUsage: 3,
    podConsumption: 4,
    libraryInteractions: 2,
    recommendedAction: 'Reengajamento leve via in-app',
  },
  {
    studentId: 's-103',
    studentName: 'Renata B.',
    score: 41,
    level: 'medio',
    reasons: ['Queda de ritmo nos últimos 7 dias'],
    lastAccessAt: '2026-04-29',
    expectedProgress: 60,
    realProgress: 52,
    pendingAssessments: 0,
    tutorUsage: 8,
    podConsumption: 6,
    libraryInteractions: 3,
    recommendedAction: 'Recomendar PCO POD + meta semanal',
  },
  {
    studentId: 's-104',
    studentName: 'Pedro O.',
    score: 22,
    level: 'baixo',
    reasons: ['Pequena oscilação de ritmo'],
    lastAccessAt: '2026-05-01',
    expectedProgress: 70,
    realProgress: 67,
    pendingAssessments: 0,
    tutorUsage: 12,
    podConsumption: 9,
    libraryInteractions: 5,
    recommendedAction: 'Acompanhar, sem ação urgente',
  },
];

export const professionals: Professional[] = [
  {
    id: 'pro-1',
    name: 'Dra. Helena Vieira',
    avatarColor: 'from-pco-blue to-pco-cyan',
    bio: 'Psicanalista clínica com 18 anos de prática e supervisão em formação.',
    specialties: ['Psicanálise', 'Supervisão Clínica'],
    serviceIds: ['svc-1', 'svc-2'],
    hourlyRate: 280,
    email: 'helena@pco.local',
  },
  {
    id: 'pro-2',
    name: 'Dr. Marco Aurélio',
    avatarColor: 'from-pco-cyan to-pco-cyan-light',
    bio: 'Terapeuta familiar sistêmico, formador e supervisor.',
    specialties: ['Terapia Familiar', 'Orientação Formativa'],
    serviceIds: ['svc-2', 'svc-3'],
    hourlyRate: 240,
    email: 'marco@pco.local',
  },
];

export const sessionServices: SessionService[] = [
  {
    id: 'svc-1',
    name: 'Análise Pessoal',
    type: 'analise',
    description: 'Sessão individual de análise pessoal, online.',
    durationMinutes: 50,
    price: 280,
    active: true,
    paymentBeforeConfirmation: true,
  },
  {
    id: 'svc-2',
    name: 'Supervisão Clínica',
    type: 'supervisao',
    description: 'Supervisão de casos clínicos com profissional sênior.',
    durationMinutes: 60,
    price: 320,
    active: true,
    paymentBeforeConfirmation: true,
  },
  {
    id: 'svc-3',
    name: 'Orientação Formativa',
    type: 'orientacao',
    description: 'Mentoria sobre trajetória formativa e estudos.',
    durationMinutes: 45,
    price: 200,
    active: true,
    paymentBeforeConfirmation: false,
  },
];

const today = new Date();
export const seoTimeseries: SeoMetric[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() - (29 - i));
  const base = 1200 + Math.sin(i / 3) * 220 + i * 18;
  const visitors = Math.round(base + (Math.random() * 120 - 60));
  return {
    date: d.toISOString().slice(0, 10),
    visitors,
    pageviews: Math.round(visitors * (2.4 + Math.random() * 0.6)),
    bounceRate: Number((38 + Math.random() * 8).toFixed(1)),
    avgSessionMinutes: Number((3.2 + Math.random() * 1.4).toFixed(2)),
  };
});

export const keywords: KeywordMetric[] = [
  { keyword: 'curso de psicanálise online', position: 4, searchVolume: 2900, trend: 'up', ctr: 6.2 },
  { keyword: 'formação em hipnoterapia', position: 7, searchVolume: 1800, trend: 'up', ctr: 4.1 },
  { keyword: 'terapia familiar sistêmica curso', position: 12, searchVolume: 1300, trend: 'flat', ctr: 2.4 },
  { keyword: 'pós em psicanálise clínica', position: 9, searchVolume: 990, trend: 'down', ctr: 3.0 },
  { keyword: 'pco escola de psicanálise', position: 1, searchVolume: 480, trend: 'up', ctr: 14.8 },
];

export interface AdminStudentRow {
  id: ID;
  name: string;
  email: string;
  enrolledCourseIds: ID[];
  progressByCourse: Record<ID, number>;
  status: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo';
  riskScore: number;
  lastAccessAt: string;
  createdAt: string;
}

export const adminStudents: AdminStudentRow[] = [
  {
    id: 's-101',
    name: 'Carla Mendes',
    email: 'carla.m@example.com',
    enrolledCourseIds: ['c-psi'],
    progressByCourse: { 'c-psi': 14 },
    status: 'em_risco',
    riskScore: 82,
    lastAccessAt: '2026-04-11',
    createdAt: '2025-11-03',
  },
  {
    id: 's-102',
    name: 'Diego Ribeiro',
    email: 'diego.r@example.com',
    enrolledCourseIds: ['c-psi', 'c-tfs'],
    progressByCourse: { 'c-psi': 32, 'c-tfs': 18 },
    status: 'em_risco',
    riskScore: 64,
    lastAccessAt: '2026-04-26',
    createdAt: '2025-09-21',
  },
  {
    id: 's-103',
    name: 'Renata Borges',
    email: 'renata.b@example.com',
    enrolledCourseIds: ['c-tfs'],
    progressByCourse: { 'c-tfs': 52 },
    status: 'ativo',
    riskScore: 41,
    lastAccessAt: '2026-04-29',
    createdAt: '2025-08-12',
  },
  {
    id: 's-104',
    name: 'Pedro Oliveira',
    email: 'pedro.o@example.com',
    enrolledCourseIds: ['c-hipno'],
    progressByCourse: { 'c-hipno': 67 },
    status: 'ativo',
    riskScore: 22,
    lastAccessAt: '2026-05-01',
    createdAt: '2025-10-04',
  },
  {
    id: 's-105',
    name: 'Beatriz Lima',
    email: 'bia.l@example.com',
    enrolledCourseIds: ['c-psi', 'c-hipno'],
    progressByCourse: { 'c-psi': 71, 'c-hipno': 24 },
    status: 'ativo',
    riskScore: 18,
    lastAccessAt: '2026-05-02',
    createdAt: '2025-07-18',
  },
  {
    id: 's-106',
    name: 'Thiago Souza',
    email: 'thiago.s@example.com',
    enrolledCourseIds: ['c-psi'],
    progressByCourse: { 'c-psi': 5 },
    status: 'bloqueado',
    riskScore: 70,
    lastAccessAt: '2026-03-15',
    createdAt: '2025-12-01',
  },
  {
    id: 's-107',
    name: 'Mariana Castro',
    email: 'mariana.c@example.com',
    enrolledCourseIds: ['c-tfs', 'c-hipno'],
    progressByCourse: { 'c-tfs': 88, 'c-hipno': 12 },
    status: 'ativo',
    riskScore: 12,
    lastAccessAt: '2026-05-03',
    createdAt: '2025-06-28',
  },
  {
    id: 's-108',
    name: 'Lucas Almeida',
    email: 'lucas.a@example.com',
    enrolledCourseIds: ['c-psi'],
    progressByCourse: { 'c-psi': 0 },
    status: 'inativo',
    riskScore: 88,
    lastAccessAt: '2026-02-08',
    createdAt: '2026-01-15',
  },
];

export const supportTickets: SupportTicket[] = [
  {
    id: 't-1',
    studentId: 'stu-001',
    subject: 'Vídeo da aula 3 não carrega',
    category: 'duvida_aula',
    status: 'in_progress',
    createdAt: '2026-04-29T10:12:00Z',
    updatedAt: '2026-04-30T08:30:00Z',
    message: 'O player fica em loading e não inicia.',
  },
  {
    id: 't-2',
    studentId: 'stu-001',
    subject: 'Como gerar segunda via do certificado?',
    category: 'certificado',
    status: 'resolved',
    createdAt: '2026-04-22T15:00:00Z',
    updatedAt: '2026-04-23T09:00:00Z',
    message: 'Preciso de uma segunda via do meu certificado.',
  },
];
