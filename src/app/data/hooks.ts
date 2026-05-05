import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { AiProviderInfo } from './api';

// Keys centralizadas para invalidate
export const queryKeys = {
  currentStudent: ['current-student'] as const,
  courses: ['courses'] as const,
  course: (id: string) => ['courses', id] as const,
  news: ['news'] as const,
  podcasts: ['podcasts'] as const,
  podcast: (id: string) => ['podcasts', id] as const,
  library: (filters?: unknown) => ['library', filters] as const,
  certificates: ['certificates'] as const,
  retentionRisks: (level?: string) => ['retention-risks', level] as const,
  professionals: ['professionals'] as const,
  sessionServices: ['session-services'] as const,
  seoTimeseries: (range: string) => ['seo-timeseries', range] as const,
  keywords: ['keywords'] as const,
  aiConfigurations: ['ai-configurations'] as const,
  aiConfiguration: (id: string) => ['ai-configurations', id] as const,
  aiProviders: ['ai-providers'] as const,
  supportTickets: ['support-tickets'] as const,
  adminStudents: (filters: api.StudentsFilter) => ['admin-students', filters] as const,
  adminStudent: (id: string) => ['admin-students', id] as const,
};

// ---------- Queries ----------

export function useCurrentStudent() {
  return useQuery({
    queryKey: queryKeys.currentStudent,
    queryFn: api.fetchCurrentStudent,
  });
}

export function useCourses() {
  return useQuery({ queryKey: queryKeys.courses, queryFn: api.fetchCourses });
}

export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.course(id ?? ''),
    queryFn: () => api.fetchCourse(id!),
    enabled: !!id,
  });
}

export function useNews() {
  return useQuery({ queryKey: queryKeys.news, queryFn: api.fetchNews });
}

export function usePodcasts() {
  return useQuery({ queryKey: queryKeys.podcasts, queryFn: api.fetchPodcasts });
}

export function usePodcastEpisode(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.podcast(id ?? ''),
    queryFn: () => api.fetchPodcastEpisode(id!),
    enabled: !!id,
  });
}

export function useLibrary(filters?: {
  type?: string;
  courseId?: string;
  mandatoryOnly?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.library(filters),
    queryFn: () => api.fetchLibrary(filters),
  });
}

export function useCertificates() {
  return useQuery({
    queryKey: queryKeys.certificates,
    queryFn: api.fetchCertificates,
  });
}

const allCertsKey = ['admin', 'certificates'] as const;
export function useAllCertificates() {
  return useQuery({ queryKey: allCertsKey, queryFn: api.fetchAllCertificates });
}

const certValidationsKey = ['admin', 'cert-validations'] as const;
export function useCertValidations() {
  return useQuery({ queryKey: certValidationsKey, queryFn: api.fetchCertValidations });
}

export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, courseId }: { studentId: string; courseId: string }) =>
      api.issueCertificate(studentId, courseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allCertsKey });
      qc.invalidateQueries({ queryKey: queryKeys.certificates });
    },
  });
}

export function useRevokeCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.revokeCertificate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allCertsKey });
      qc.invalidateQueries({ queryKey: queryKeys.certificates });
    },
  });
}

export function useRetentionRisks(level?: string) {
  return useQuery({
    queryKey: queryKeys.retentionRisks(level),
    queryFn: () => api.fetchRetentionRisks(level),
  });
}

export function useProfessionals() {
  return useQuery({
    queryKey: queryKeys.professionals,
    queryFn: api.fetchProfessionals,
  });
}

export function useSessionServices() {
  return useQuery({
    queryKey: queryKeys.sessionServices,
    queryFn: api.fetchSessionServices,
  });
}

export function useSeoTimeseries(range = '30d') {
  return useQuery({
    queryKey: queryKeys.seoTimeseries(range),
    queryFn: () => api.fetchSeoTimeseries(range),
  });
}

export function useKeywords() {
  return useQuery({ queryKey: queryKeys.keywords, queryFn: api.fetchKeywords });
}

export function useAiConfigurations() {
  return useQuery({
    queryKey: queryKeys.aiConfigurations,
    queryFn: api.fetchAiConfigurations,
  });
}

export function useAiConfiguration(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.aiConfiguration(id ?? ''),
    queryFn: () => api.fetchAiConfiguration(id!),
    enabled: !!id,
  });
}

export function useAiProviders() {
  return useQuery({
    queryKey: queryKeys.aiProviders,
    queryFn: api.fetchAiProviders,
    staleTime: Infinity,
  });
}

export function useUpdateAiConfiguration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateAiConfiguration>[1] }) =>
      api.updateAiConfiguration(id, patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.aiConfigurations });
      qc.invalidateQueries({ queryKey: queryKeys.aiConfiguration(variables.id) });
    },
  });
}

export function useTestAiConnection() {
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: AiProviderInfo['id']; apiKey: string }) =>
      api.testAiConnection(provider, apiKey),
  });
}

export function useAskTutor() {
  return useMutation({
    mutationFn: ({
      message,
      history,
    }: {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => api.askTutor(message, history),
  });
}

export function useSupportTickets() {
  return useQuery({
    queryKey: queryKeys.supportTickets,
    queryFn: api.fetchSupportTickets,
  });
}

export function useAdminStudents(filters: api.StudentsFilter) {
  return useQuery({
    queryKey: queryKeys.adminStudents(filters),
    queryFn: () => api.fetchAdminStudents(filters),
    placeholderData: (prev) => prev,
  });
}

export function useAdminStudent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminStudent(id ?? ''),
    queryFn: () => api.fetchAdminStudent(id!),
    enabled: !!id,
  });
}

// ---------- Mutations ----------

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSupportTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.supportTickets });
    },
  });
}

export function useGenerateRecoveryPlan() {
  return useMutation({ mutationFn: api.generateRecoveryPlan });
}

// ---- Admin: course writes ----

export function useDuplicateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.duplicateCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.courses }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.UpdateCoursePatch }) =>
      api.updateCourse(id, patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.courses });
      qc.invalidateQueries({ queryKey: queryKeys.course(variables.id) });
    },
  });
}

// ---- Admin: news writes ----

export function useCreateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createNews,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.news }),
  });
}

export function useUpdateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreateNewsPayload> }) =>
      api.updateNews(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.news }),
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteNews,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.news }),
  });
}

// ---- Admin: library writes ----

export function useCreateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLibrary,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }),
  });
}

export function useUpdateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreateLibraryPayload> }) =>
      api.updateLibrary(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }),
  });
}

export function useDeleteLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLibrary,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }),
  });
}

// ---- Admin: podcasts writes ----

export function useCreatePodcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPodcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.podcasts }),
  });
}

export function useUpdatePodcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreatePodcastPayload> }) =>
      api.updatePodcast(id, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.podcasts });
      qc.invalidateQueries({ queryKey: queryKeys.podcast(vars.id) });
    },
  });
}

export function useDeletePodcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deletePodcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.podcasts }),
  });
}

// ---- Admin: modules writes ----

export function useCreateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, input }: { courseId: string; input: api.CreateModulePayload }) =>
      api.createModule(courseId, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.course(vars.courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

export function useUpdateModule(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreateModulePayload> }) =>
      api.updateModule(id, patch),
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

export function useDeleteModule(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteModule,
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

// ---- Admin: lessons writes ----

export function useCreateLesson(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, input }: { moduleId: string; input: api.CreateLessonPayload }) =>
      api.createLesson(moduleId, input),
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

export function useUpdateLesson(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreateLessonPayload> }) =>
      api.updateLesson(id, patch),
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

export function useDeleteLesson(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLesson,
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

// ---- Admin: students writes ----

function invalidateStudents(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-students'] });
}

export function useCreateAdminStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAdminStudent,
    onSuccess: () => invalidateStudents(qc),
  });
}

export function useUpdateAdminStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreateStudentPayload> }) =>
      api.updateAdminStudent(id, patch),
    onSuccess: (_data, vars) => {
      invalidateStudents(qc);
      qc.invalidateQueries({ queryKey: queryKeys.adminStudent(vars.id) });
    },
  });
}

export function useBlockStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.blockStudent,
    onSuccess: (_data, id) => {
      invalidateStudents(qc);
      qc.invalidateQueries({ queryKey: queryKeys.adminStudent(id) });
    },
  });
}

export function useUnblockStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.unblockStudent,
    onSuccess: (_data, id) => {
      invalidateStudents(qc);
      qc.invalidateQueries({ queryKey: queryKeys.adminStudent(id) });
    },
  });
}

export function useDeleteAdminStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAdminStudent,
    onSuccess: () => invalidateStudents(qc),
  });
}

// ---- Admin: assessments writes ----

export function useUpsertAssessment(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, input }: { moduleId: string; input: api.AssessmentPayload }) =>
      api.upsertAssessment(moduleId, input),
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

export function useDeleteAssessment(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAssessment,
    onSuccess: () => {
      if (courseId) qc.invalidateQueries({ queryKey: queryKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

// ---- Admin: System users (login + RBAC) ----

const systemUsersKey = ['system-users'] as const;

export function useSystemUsers() {
  return useQuery({ queryKey: systemUsersKey, queryFn: api.fetchSystemUsers });
}

export function useCreateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSystemUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: systemUsersKey }),
  });
}

export function useUpdateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof api.updateSystemUser>[1];
    }) => api.updateSystemUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemUsersKey }),
  });
}

export function useChangeSystemUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.changeSystemUserPassword(id, password),
  });
}

export function useDeleteSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; confirmEmail: string }) =>
      api.deleteSystemUser(args.id, args.confirmEmail),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemUsersKey }),
  });
}

const myProgressKey = ['me', 'progress'] as const;
export function useMyProgress() {
  return useQuery({ queryKey: myProgressKey, queryFn: api.fetchMyProgress });
}

export function useMarkLessonCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lessonId,
      courseId,
      moduleId,
    }: {
      lessonId: string;
      courseId: string;
      moduleId: string;
    }) => api.markLessonCompleted(lessonId, courseId, moduleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myProgressKey }),
  });
}

export function useUnmarkLessonCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.unmarkLessonCompleted,
    onSuccess: () => qc.invalidateQueries({ queryKey: myProgressKey }),
  });
}

export function useUserTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user-timeline', id],
    queryFn: () => api.fetchUserTimeline(id!),
    enabled: !!id,
  });
}

const allSupportKey = ['admin', 'support'] as const;
export function useAllSupportTickets() {
  return useQuery({ queryKey: allSupportKey, queryFn: api.fetchAllSupportTickets });
}

export function useUpdateSupportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'in_progress' | 'resolved' }) =>
      api.updateSupportTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: allSupportKey }),
  });
}

export function useRespondSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api.respondSupportTicket(id, message),
    onSuccess: () => qc.invalidateQueries({ queryKey: allSupportKey }),
  });
}

const podcastEngagementKey = ['me', 'podcast-engagement'] as const;
export function useMyPodcastEngagement() {
  return useQuery({ queryKey: podcastEngagementKey, queryFn: api.fetchMyPodcastEngagement });
}

export function useSetPodcastEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      episodeId,
      patch,
    }: {
      episodeId: string;
      patch: { listened?: boolean; favorite?: boolean };
    }) => api.setPodcastEngagement(episodeId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: podcastEngagementKey }),
  });
}

export function useLessonNote(lessonId: string | undefined) {
  return useQuery({
    queryKey: ['lesson-note', lessonId],
    queryFn: () => api.fetchLessonNote(lessonId!),
    enabled: !!lessonId,
  });
}

export function useSaveLessonNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, content }: { lessonId: string; content: string }) =>
      api.saveLessonNote(lessonId, content),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lesson-note', vars.lessonId] });
    },
  });
}

const tutorUsageKey = ['tutor', 'usage'] as const;
export function useTutorUsage() {
  return useQuery({
    queryKey: tutorUsageKey,
    queryFn: api.fetchTutorUsage,
    refetchInterval: 60_000,
  });
}

const tutorHistoryKey = ['tutor', 'history'] as const;
export function useTutorHistory() {
  return useQuery({ queryKey: tutorHistoryKey, queryFn: () => api.fetchTutorHistory() });
}

export function useClearTutorHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.clearTutorHistory,
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorHistoryKey }),
  });
}

const versionKey = ['version'] as const;
export function useVersion() {
  return useQuery({
    queryKey: versionKey,
    queryFn: api.fetchVersion,
    staleTime: 60 * 60_000,
  });
}

const settingsKey = ['settings'] as const;
export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: api.fetchSettings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKey }),
  });
}

const loginConfigKey = ['login-config'] as const;
export function useLoginConfig() {
  return useQuery({
    queryKey: loginConfigKey,
    queryFn: api.fetchLoginConfig,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateLoginConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateLoginConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: loginConfigKey }),
  });
}

export function useResetLoginConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.resetLoginConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: loginConfigKey }),
  });
}

// Payment gateways
const paymentProvidersKey = ['admin', 'payments', 'providers'] as const;
const paymentGatewaysKey = ['admin', 'payments', 'gateways'] as const;

export function usePaymentProviders() {
  return useQuery({
    queryKey: paymentProvidersKey,
    queryFn: api.fetchPaymentProviders,
    staleTime: 60 * 60_000,
  });
}

export function usePaymentGateways() {
  return useQuery({ queryKey: paymentGatewaysKey, queryFn: api.fetchPaymentGateways });
}

export function useCreatePaymentGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPaymentGateway,
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentGatewaysKey }),
  });
}

export function useUpdatePaymentGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.UpdateGatewayInput }) =>
      api.updatePaymentGateway(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentGatewaysKey }),
  });
}

export function useDeletePaymentGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deletePaymentGateway,
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentGatewaysKey }),
  });
}

const productsKey = ['products'] as const;
const adminProductsKey = ['admin', 'products'] as const;

export function useProducts() {
  return useQuery({ queryKey: productsKey, queryFn: api.fetchProducts });
}

export function useAdminProducts() {
  return useQuery({ queryKey: adminProductsKey, queryFn: api.fetchAdminProducts });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productsKey });
      qc.invalidateQueries({ queryKey: adminProductsKey });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.CreateProductInput> }) =>
      api.updateProduct(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productsKey });
      qc.invalidateQueries({ queryKey: adminProductsKey });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; confirmName: string }) =>
      api.deleteProduct(args.id, args.confirmName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productsKey });
      qc.invalidateQueries({ queryKey: adminProductsKey });
    },
  });
}

const myOrdersKey = ['me', 'orders'] as const;
const allOrdersKey = ['admin', 'orders'] as const;

export function useMyOrders() {
  return useQuery({ queryKey: myOrdersKey, queryFn: api.fetchMyOrders });
}

export function useAllOrders() {
  return useQuery({
    queryKey: allOrdersKey,
    queryFn: api.fetchAllOrders,
    refetchInterval: 30_000,
  });
}

export function useStartCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, gatewayId }: { productId: string; gatewayId?: string }) =>
      api.startCheckout(productId, gatewayId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myOrdersKey }),
  });
}

export function useCancelMyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.cancelMyOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: myOrdersKey }),
  });
}

export function useAdminUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: 'canceled' | 'refunded' | 'failed';
      note?: string;
    }) => api.adminUpdateOrderStatus(id, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: allOrdersKey }),
  });
}

export function useAdminRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; amountCents?: number; reason?: string }) =>
      api.adminRefundOrder(args.id, {
        amountCents: args.amountCents,
        reason: args.reason,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: allOrdersKey }),
  });
}

// Imports
const importTemplatesKey = ['admin', 'imports', 'templates'] as const;
const importJobsKey = ['admin', 'imports', 'jobs'] as const;

export function useImportTemplates() {
  return useQuery({
    queryKey: importTemplatesKey,
    queryFn: api.fetchImportTemplates,
    staleTime: 60 * 60_000,
  });
}

export function useImportJobs(filter: api.ImportJobsFilterDto = {}) {
  return useQuery({
    queryKey: [...importJobsKey, filter],
    queryFn: () => api.fetchImportJobs(filter),
    refetchInterval: 5_000, // polling rápido enquanto import roda
  });
}

const importConnectionsKey = ['admin', 'imports', 'connections'] as const;

export function useImportConnections() {
  return useQuery({
    queryKey: importConnectionsKey,
    queryFn: api.fetchImportConnections,
    staleTime: 30_000,
  });
}

export function useCreateImportConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: api.ImportConnectionInputDto) => api.createImportConnection(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: importConnectionsKey }),
  });
}

export function useUpdateImportConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: Partial<api.ImportConnectionInputDto> }) =>
      api.updateImportConnection(args.id, args.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: importConnectionsKey }),
  });
}

export function useDeleteImportConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteImportConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: importConnectionsKey }),
  });
}

export function useTestImportConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.testImportConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: importConnectionsKey }),
  });
}

export function useStartApiRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: api.RunApiInputDto) => api.startApiRun(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: importJobsKey }),
  });
}

export function useRollbackImportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rollbackImportJob(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: importJobsKey });
      qc.invalidateQueries({ queryKey: ['admin', 'imports', 'jobs', id] });
    },
  });
}

export function useCancelImportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelImportJob(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: importJobsKey });
      qc.invalidateQueries({ queryKey: ['admin', 'imports', 'jobs', id] });
    },
  });
}

const importSchedulesKey = ['admin', 'imports', 'schedules'] as const;

export function useImportSchedules() {
  return useQuery({
    queryKey: importSchedulesKey,
    queryFn: () => api.fetchImportSchedules(),
  });
}

export function useCreateImportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.ImportScheduleInputDto) =>
      api.createImportSchedule(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: importSchedulesKey }),
  });
}

export function useUpdateImportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<api.ImportScheduleInputDto>;
    }) => api.updateImportSchedule(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: importSchedulesKey }),
  });
}

export function useDeleteImportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteImportSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: importSchedulesKey }),
  });
}

export function useRunImportScheduleNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.runImportScheduleNow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: importSchedulesKey });
      qc.invalidateQueries({ queryKey: importJobsKey });
    },
  });
}

export function useImportJob(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'imports', 'jobs', id],
    queryFn: () => api.fetchImportJob(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'running' || status === 'pending') return 2_000;
      return false;
    },
  });
}

const completionsKey = ['admin', 'stats', 'completions'] as const;
export function useCompletionsStats(days = 7) {
  return useQuery({
    queryKey: [...completionsKey, days],
    queryFn: () => api.fetchCompletionsStats(days),
    refetchInterval: 60_000,
  });
}

const tutorUsageStatsKey = ['admin', 'stats', 'tutor-usage'] as const;
export function useTutorUsageStats(days = 30) {
  return useQuery({
    queryKey: [...tutorUsageStatsKey, days],
    queryFn: () => api.fetchTutorUsageStats(days),
  });
}

const errorsStatsKey = ['admin', 'stats', 'errors'] as const;
export function useErrorsStats(days = 7) {
  return useQuery({
    queryKey: [...errorsStatsKey, days],
    queryFn: () => api.fetchErrorsStats(days),
  });
}

const auditStatsKey = ['admin', 'stats', 'audit'] as const;
export function useAuditStats(days = 7) {
  return useQuery({
    queryKey: [...auditStatsKey, days],
    queryFn: () => api.fetchAuditStats(days),
  });
}

const healthKey = ['admin', 'health'] as const;
export function useHealth() {
  return useQuery({
    queryKey: healthKey,
    queryFn: api.fetchHealth,
    refetchInterval: 30_000,
  });
}

const backupsKey = ['admin', 'backups'] as const;
export function useBackups() {
  return useQuery({ queryKey: backupsKey, queryFn: api.fetchBackups });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBackup,
    onSuccess: () => qc.invalidateQueries({ queryKey: backupsKey }),
  });
}

export function useRunBackupNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.runBackupNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: backupsKey }),
  });
}

const errorLogKey = ['admin', 'error-log'] as const;
export function useErrorLog(limit = 200) {
  return useQuery({
    queryKey: [...errorLogKey, limit],
    queryFn: () => api.fetchErrorLog(limit),
  });
}

const auditLogKey = ['admin', 'audit-log'] as const;
export function useAuditLog(filter: api.AuditFilter = {}) {
  return useQuery({
    queryKey: [...auditLogKey, filter],
    queryFn: () => api.fetchAuditLog(filter),
  });
}

const notificationsKey = ['notifications'] as const;
const unreadCountKey = ['notifications', 'unread-count'] as const;

export function useNotifications() {
  return useQuery({ queryKey: notificationsKey, queryFn: api.fetchNotifications });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: unreadCountKey,
    queryFn: api.fetchUnreadCount,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKey });
      qc.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKey });
      qc.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
}

const sentBroadcastsKey = ['admin', 'notifications', 'sent'] as const;
export function useSentBroadcasts() {
  return useQuery({ queryKey: sentBroadcastsKey, queryFn: () => api.fetchSentBroadcasts(50) });
}

export function useBroadcastNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.broadcastNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKey });
      qc.invalidateQueries({ queryKey: unreadCountKey });
      qc.invalidateQueries({ queryKey: sentBroadcastsKey });
    },
  });
}

// ---------- Email transacional ----------

const emailConfigsKey = ['admin', 'email', 'configs'] as const;
const emailLogsKey = ['admin', 'email', 'logs'] as const;
const emailTemplatesKey = ['admin', 'email', 'templates'] as const;

export function useEmailProviders() {
  return useQuery({
    queryKey: ['admin', 'email', 'providers'] as const,
    queryFn: api.fetchEmailProviders,
    staleTime: Infinity,
  });
}

export function useEmailConfigs() {
  return useQuery({ queryKey: emailConfigsKey, queryFn: api.fetchEmailConfigs });
}

export function useCreateEmailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createEmailConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: emailConfigsKey }),
  });
}

export function useUpdateEmailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: Partial<api.EmailConfigInputDto> }) =>
      api.updateEmailConfig(args.id, args.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: emailConfigsKey }),
  });
}

export function useDeleteEmailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteEmailConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: emailConfigsKey }),
  });
}

export function useTestEmailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.testEmailConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: emailConfigsKey }),
  });
}

export function useSendTestEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; to: string }) =>
      api.sendTestEmail(args.id, args.to),
    onSuccess: () => qc.invalidateQueries({ queryKey: emailLogsKey }),
  });
}

export function useEmailLogs() {
  return useQuery({
    queryKey: emailLogsKey,
    queryFn: api.fetchEmailLogs,
    refetchInterval: 10_000,
  });
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: emailTemplatesKey,
    queryFn: api.fetchEmailTemplates,
    staleTime: Infinity,
  });
}

export function usePreviewEmailTemplate(name: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'email', 'preview', name] as const,
    queryFn: () => api.previewEmailTemplate(name!),
    enabled: !!name,
  });
}

// ---------- Webhooks de saída ----------

const webhookEndpointsKey = ['admin', 'webhooks', 'endpoints'] as const;
const webhookDeliveriesKey = ['admin', 'webhooks', 'deliveries'] as const;

export function useWebhookEvents() {
  return useQuery({
    queryKey: ['admin', 'webhooks', 'events'] as const,
    queryFn: api.fetchWebhookEvents,
    staleTime: Infinity,
  });
}

export function useWebhookEndpoints() {
  return useQuery({
    queryKey: webhookEndpointsKey,
    queryFn: api.fetchWebhookEndpoints,
  });
}

export function useCreateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createWebhookEndpoint,
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookEndpointsKey }),
  });
}

export function useUpdateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: Partial<api.WebhookEndpointInputDto> }) =>
      api.updateWebhookEndpoint(args.id, args.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookEndpointsKey }),
  });
}

export function useDeleteWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteWebhookEndpoint,
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookEndpointsKey }),
  });
}

export function useTestWebhookEndpoint() {
  return useMutation({ mutationFn: api.testWebhookEndpoint });
}

export function useWebhookDeliveries(endpointId?: string) {
  return useQuery({
    queryKey: [...webhookDeliveriesKey, endpointId] as const,
    queryFn: () => api.fetchWebhookDeliveries(endpointId),
    refetchInterval: 10_000,
  });
}

export function useRetryWebhookDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.retryWebhookDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookDeliveriesKey }),
  });
}

export function useHealthSnapshot() {
  return useQuery({
    queryKey: ['admin', 'health'] as const,
    queryFn: api.fetchHealthSnapshot,
    refetchInterval: 60_000,
  });
}

const reengagementCfgKey = ['admin', 'reengagement', 'config'] as const;
const reengagementSentKey = ['admin', 'reengagement', 'sent'] as const;

export function useReengagementConfig() {
  return useQuery({
    queryKey: reengagementCfgKey,
    queryFn: api.fetchReengagementConfig,
  });
}

export function useUpdateReengagementConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateReengagementConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: reengagementCfgKey }),
  });
}

export function useReengagementSent() {
  return useQuery({
    queryKey: reengagementSentKey,
    queryFn: api.fetchReengagementSent,
    refetchInterval: 30_000,
  });
}

export function useRunReengagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.runReengagement,
    onSuccess: () => qc.invalidateQueries({ queryKey: reengagementSentKey }),
  });
}

export function useBulkUserAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.bulkUserAction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

const broadcastsKey = ['admin', 'email', 'broadcasts'] as const;

export function useBroadcasts() {
  return useQuery({
    queryKey: broadcastsKey,
    queryFn: api.fetchBroadcasts,
    refetchInterval: 5_000,
  });
}

export function usePreviewBroadcast() {
  return useMutation({ mutationFn: api.previewBroadcast });
}

export function useStartBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.startBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: broadcastsKey }),
  });
}

const sessionsKey = ['admin', 'sessions'] as const;

export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: api.fetchSessions,
    refetchInterval: 30_000,
  });
}

export function useForceLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.forceLogout,
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKey }),
  });
}

const apiTokensKey = ['admin', 'api-tokens'] as const;

export function useApiTokens() {
  return useQuery({
    queryKey: apiTokensKey,
    queryFn: api.fetchApiTokens,
  });
}

export function useCreateApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createApiToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokensKey }),
  });
}

export function useRevokeApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.revokeApiToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokensKey }),
  });
}

export function useDeleteApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteApiToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: apiTokensKey }),
  });
}

export function useActivityFeed(
  filter: Parameters<typeof api.fetchActivityFeed>[0] = {},
) {
  return useQuery({
    queryKey: ['admin', 'activity', filter] as const,
    queryFn: () => api.fetchActivityFeed(filter),
    refetchInterval: 30_000,
  });
}

export function useAdminNotes(studentId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'notes', studentId] as const,
    queryFn: () => api.fetchAdminNotes(studentId!),
    enabled: !!studentId,
  });
}

export function useCreateAdminNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { studentId: string; body: string; pinned?: boolean }) =>
      api.createAdminNote(args.studentId, args.body, args.pinned),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['admin', 'notes', vars.studentId] }),
  });
}

export function useUpdateAdminNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      studentId: string;
      noteId: string;
      patch: { body?: string; pinned?: boolean };
    }) => api.updateAdminNote(args.studentId, args.noteId, args.patch),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['admin', 'notes', vars.studentId] }),
  });
}

export function useDeleteAdminNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { studentId: string; noteId: string }) =>
      api.deleteAdminNote(args.studentId, args.noteId),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['admin', 'notes', vars.studentId] }),
  });
}

export function useCourseRating(courseId: string | undefined) {
  return useQuery({
    queryKey: ['courses', courseId, 'rating'] as const,
    queryFn: () => api.fetchCourseRating(courseId!),
    enabled: !!courseId,
  });
}

export function useCourseReviews(courseId: string | undefined) {
  return useQuery({
    queryKey: ['courses', courseId, 'reviews'] as const,
    queryFn: () => api.fetchCourseReviews(courseId!),
    enabled: !!courseId,
  });
}

export function useMyCourseReview(courseId: string | undefined) {
  return useQuery({
    queryKey: ['me', 'courses', courseId, 'review'] as const,
    queryFn: () => api.fetchMyCourseReview(courseId!),
    enabled: !!courseId,
  });
}

const notifPrefsKey = ['me', 'notification-prefs'] as const;

export function useMyNotificationPrefs() {
  return useQuery({
    queryKey: notifPrefsKey,
    queryFn: api.fetchMyNotificationPrefs,
  });
}

export function useUpdateMyNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMyNotificationPrefs,
    onSuccess: () => qc.invalidateQueries({ queryKey: notifPrefsKey }),
  });
}

const myAchievementsKey = ['me', 'achievements'] as const;

export function useMyAchievements() {
  return useQuery({
    queryKey: myAchievementsKey,
    queryFn: api.fetchMyAchievements,
  });
}

export function useRefreshMyAchievements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.refreshMyAchievements,
    onSuccess: () => qc.invalidateQueries({ queryKey: myAchievementsKey }),
  });
}

export function useStudentAchievements(studentId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'students', studentId, 'achievements'] as const,
    queryFn: () => api.fetchStudentAchievements(studentId!),
    enabled: !!studentId,
  });
}

const lessonCommentsKey = (lessonId: string) =>
  ['lessons', lessonId, 'comments'] as const;

export function useLessonComments(lessonId: string | undefined) {
  return useQuery({
    queryKey: lessonCommentsKey(lessonId ?? ''),
    queryFn: () => api.fetchLessonComments(lessonId!),
    enabled: !!lessonId,
  });
}

export function useCreateLessonComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLessonComment,
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: lessonCommentsKey(vars.lessonId) }),
  });
}

export function useUpdateLessonComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      lessonId: string;
      commentId: string;
      patch: { body?: string; pinned?: boolean; hidden?: boolean };
    }) => api.updateLessonComment(args.lessonId, args.commentId, args.patch),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: lessonCommentsKey(vars.lessonId) }),
  });
}

export function useDeleteLessonComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { lessonId: string; commentId: string }) =>
      api.deleteLessonComment(args.lessonId, args.commentId),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: lessonCommentsKey(vars.lessonId) }),
  });
}

const jobsKey = ['admin', 'jobs'] as const;

export function useJobs() {
  return useQuery({
    queryKey: jobsKey,
    queryFn: api.fetchJobs,
    refetchInterval: 10_000,
  });
}

export function useRunJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { name: string; dryRun?: boolean }) =>
      api.runJob(args.name, args.dryRun ?? false),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobsKey }),
  });
}

export function useLogs(filter: Parameters<typeof api.fetchLogs>[0] = {}) {
  return useQuery({
    queryKey: ['admin', 'logs', filter] as const,
    queryFn: () => api.fetchLogs(filter),
    refetchInterval: 5_000,
  });
}

export function useMyStreak() {
  return useQuery({
    queryKey: ['me', 'streak'] as const,
    queryFn: api.fetchMyStreak,
  });
}

export function useRateLimitSummary(windowMs?: number) {
  return useQuery({
    queryKey: ['admin', 'rate-limits', windowMs] as const,
    queryFn: () => api.fetchRateLimitSummary(windowMs),
    refetchInterval: 10_000,
  });
}

export function useCourseAnalytics(courseId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'courses', courseId, 'analytics'] as const,
    queryFn: () => api.fetchCourseAnalytics(courseId!),
    enabled: !!courseId,
  });
}

// Setup checklist
export function useSetupStatus() {
  return useQuery({
    queryKey: ['admin', 'setup-status'] as const,
    queryFn: api.fetchSetupStatus,
    refetchInterval: 60_000,
  });
}

// Saved searches
export function useSavedSearches(scope?: api.SavedSearchScopeDto) {
  return useQuery({
    queryKey: ['admin', 'saved-searches', scope] as const,
    queryFn: () => api.fetchSavedSearches(scope),
  });
}

export function useCreateSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSavedSearch,
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['admin', 'saved-searches', vars.scope] }),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSavedSearch,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin', 'saved-searches'] }),
  });
}

// Live sessions
const liveSessionsAdminKey = ['admin', 'live-sessions'] as const;
const liveSessionsMyKey = ['me', 'live-sessions'] as const;

export function useMyLiveSessions() {
  return useQuery({
    queryKey: liveSessionsMyKey,
    queryFn: api.fetchMyLiveSessions,
    refetchInterval: 60_000,
  });
}

export function useAdminLiveSessions() {
  return useQuery({
    queryKey: liveSessionsAdminKey,
    queryFn: api.fetchAdminLiveSessions,
  });
}

export function useCreateLiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLiveSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: liveSessionsAdminKey });
      qc.invalidateQueries({ queryKey: liveSessionsMyKey });
    },
  });
}

export function useUpdateLiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      patch: Partial<api.LiveSessionInputDto> & {
        status?: api.LiveSessionStatusDto;
      };
    }) => api.updateLiveSession(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: liveSessionsAdminKey });
      qc.invalidateQueries({ queryKey: liveSessionsMyKey });
    },
  });
}

export function useDeleteLiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLiveSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: liveSessionsAdminKey });
      qc.invalidateQueries({ queryKey: liveSessionsMyKey });
    },
  });
}

export function useStudentAnalytics(studentId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'students', studentId, 'analytics'] as const,
    queryFn: () => api.fetchStudentAnalytics(studentId!),
    enabled: !!studentId,
  });
}

export function useUpsertMyCourseReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { courseId: string; rating: number; comment?: string }) =>
      api.upsertMyCourseReview(args.courseId, args.rating, args.comment),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['courses', vars.courseId, 'rating'] });
      qc.invalidateQueries({ queryKey: ['courses', vars.courseId, 'reviews'] });
      qc.invalidateQueries({ queryKey: ['me', 'courses', vars.courseId, 'review'] });
    },
  });
}
