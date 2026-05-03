import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

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
