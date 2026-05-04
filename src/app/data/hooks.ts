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
    mutationFn: api.deleteSystemUser,
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

export function useBroadcastNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.broadcastNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKey });
      qc.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
}
