import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import StudentLayout from './layouts/StudentLayout';
import AdminLayout from './layouts/AdminLayout';
import LearningLayout from './layouts/LearningLayout';
import RootError from './components/RootError';
import ProtectedRoute from './auth/ProtectedRoute';
import { PageLoadingSkeleton } from './components/LoadingSkeleton';

// Eager (small/critical)
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Public — lazy
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'));
const CheckoutMock = lazy(() => import('./pages/CheckoutMock'));
const Pedidos = lazy(() => import('./pages/Pedidos'));
const Eventos = lazy(() => import('./pages/Eventos'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacidade = lazy(() => import('./pages/Privacidade'));
const Landing = lazy(() => import('./pages/Landing'));

// Student — lazy
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Jornada = lazy(() => import('./pages/Jornada'));
const Courses = lazy(() => import('./pages/Courses'));
const Bundles = lazy(() => import('./pages/Bundles'));
const Catalog = lazy(() => import('./pages/Catalog'));
const CoursePreview = lazy(() => import('./pages/CoursePreview'));
const MyNotes = lazy(() => import('./pages/MyNotes'));
const Library = lazy(() => import('./pages/Library'));
const News = lazy(() => import('./pages/News'));
const Podcasts = lazy(() => import('./pages/Podcasts'));
const PodcastEpisode = lazy(() => import('./pages/PodcastEpisode'));
const Tutor = lazy(() => import('./pages/Tutor'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Support = lazy(() => import('./pages/Support'));
const Profile = lazy(() => import('./pages/Profile'));
const AnaliseSupervisao = lazy(() => import('./pages/AnaliseSupervisao'));
const Notifications = lazy(() => import('./pages/Notifications'));

// Learning — lazy
const LMSCourse = lazy(() => import('./pages/LMSCourse'));
const LMSModule = lazy(() => import('./pages/LMSModule'));
const LMSLesson = lazy(() => import('./pages/LMSLesson'));
const LMSAssessment = lazy(() => import('./pages/LMSAssessment'));

// Admin — lazy
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminCourses = lazy(() => import('./pages/admin/AdminCourses'));
const AdminCourseEditor = lazy(() => import('./pages/admin/AdminCourseEditor'));
const AdminModules = lazy(() => import('./pages/admin/AdminModules'));
const AdminLessons = lazy(() => import('./pages/admin/AdminLessons'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminEvasion = lazy(() => import('./pages/admin/AdminEvasion'));
const AdminRecoveryPlan = lazy(() => import('./pages/admin/AdminRecoveryPlan'));
const AdminRetention = lazy(() => import('./pages/admin/AdminRetention'));
const AdminMetricas = lazy(() => import('./pages/admin/AdminMetricas'));
const AdminLibrary = lazy(() => import('./pages/admin/AdminLibrary'));
const AdminNews = lazy(() => import('./pages/admin/AdminNews'));
const AdminPodcasts = lazy(() => import('./pages/admin/AdminPodcasts'));
const AdminTutor = lazy(() => import('./pages/admin/AdminTutor'));
const AdminIAs = lazy(() => import('./pages/admin/AdminIAs'));
const AdminCertificates = lazy(() => import('./pages/admin/AdminCertificates'));
const AdminAnaliseSupervisao = lazy(() => import('./pages/admin/AdminAnaliseSupervisao'));
const AdminReengajamento = lazy(() => import('./pages/admin/AdminReengajamento'));
const AdminLoginModels = lazy(() => import('./pages/admin/AdminLoginModels'));
const AdminLoginCustomize = lazy(() => import('./pages/admin/AdminLoginCustomize'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminUsuarios = lazy(() => import('./pages/admin/AdminUsuarios'));
const AdminUsersImport = lazy(() => import('./pages/admin/AdminUsersImport'));
const AdminAuditoria = lazy(() => import('./pages/admin/AdminAuditoria'));
const AdminNotificacoes = lazy(() => import('./pages/admin/AdminNotificacoes'));
const AdminErros = lazy(() => import('./pages/admin/AdminErros'));
const AdminSuporte = lazy(() => import('./pages/admin/AdminSuporte'));
const AdminBackups = lazy(() => import('./pages/admin/AdminBackups'));
const AdminGateways = lazy(() => import('./pages/admin/AdminGateways'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'));
const AdminVendas = lazy(() => import('./pages/admin/AdminVendas'));
const AdminDigest = lazy(() => import('./pages/admin/AdminDigest'));
const AdminLeaderboard = lazy(() => import('./pages/admin/AdminLeaderboard'));
const AdminWishlist = lazy(() => import('./pages/admin/AdminWishlist'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport'));
const AdminCourseStudents = lazy(() => import('./pages/admin/AdminCourseStudents'));
const AdminDeletionRequests = lazy(() => import('./pages/admin/AdminDeletionRequests'));
const AdminAlertsCenter = lazy(() => import('./pages/admin/AdminAlertsCenter'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const ImportsHome = lazy(() => import('./pages/admin/imports/ImportsHome'));
const ImportWizardCsv = lazy(() => import('./pages/admin/imports/ImportWizardCsv'));
const ImportJobDetail = lazy(() => import('./pages/admin/imports/ImportJobDetail'));
const ImportsHistory = lazy(() => import('./pages/admin/imports/ImportsHistory'));
const AdminEmail = lazy(() => import('./pages/admin/AdminEmail'));
const AdminWebhooks = lazy(() => import('./pages/admin/AdminWebhooks'));
const AdminSaude = lazy(() => import('./pages/admin/AdminSaude'));
const AdminReengagementAuto = lazy(() => import('./pages/admin/AdminReengagementAuto'));
const AdminBroadcasts = lazy(() => import('./pages/admin/AdminBroadcasts'));
const AdminSessoes = lazy(() => import('./pages/admin/AdminSessoes'));
const AdminApiTokens = lazy(() => import('./pages/admin/AdminApiTokens'));
const AdminActivity = lazy(() => import('./pages/admin/AdminActivity'));
const AdminBackup = lazy(() => import('./pages/admin/AdminBackup'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminRateLimits = lazy(() => import('./pages/admin/AdminRateLimits'));
const AdminCoursePreview = lazy(() => import('./pages/admin/AdminCoursePreview'));
const AdminCourseAnalytics = lazy(() => import('./pages/admin/AdminCourseAnalytics'));
const AdminLiveSessions = lazy(() => import('./pages/admin/AdminLiveSessions'));
const AdminSetup = lazy(() => import('./pages/admin/AdminSetup'));
const ImportWizardApi = lazy(() => import('./pages/admin/imports/ImportWizardApi'));
const ImportSchedules = lazy(() => import('./pages/admin/imports/ImportSchedules'));

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>;
}

function Protected({ children, role }: { children: ReactNode; role?: 'student' | 'admin' }) {
  return <ProtectedRoute requireRole={role}>{children}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <S><Landing /></S>,
    errorElement: <RootError />,
  },
  { path: '/login', element: <Login />, errorElement: <RootError /> },
  { path: '/esqueci-senha', element: <S><ForgotPassword /></S>, errorElement: <RootError /> },
  { path: '/redefinir-senha', element: <S><ResetPassword /></S>, errorElement: <RootError /> },
  { path: '/verificar/:code', element: <S><VerifyCertificate /></S>, errorElement: <RootError /> },
  { path: '/checkout/mock', element: <S><CheckoutMock /></S>, errorElement: <RootError /> },
  { path: '/onboarding', element: <S><Onboarding /></S>, errorElement: <RootError /> },
  { path: '/termos', element: <S><Terms /></S>, errorElement: <RootError /> },
  { path: '/privacidade', element: <S><Privacidade /></S>, errorElement: <RootError /> },
  { path: '/landing', element: <S><Landing /></S>, errorElement: <RootError /> },
  { path: '/ava-pco', element: <S><Landing /></S>, errorElement: <RootError /> },
  { path: '/catalogo', element: <S><Catalog /></S>, errorElement: <RootError /> },
  { path: '/curso-preview/:id', element: <S><CoursePreview /></S>, errorElement: <RootError /> },

  {
    element: (
      <Protected>
        <StudentLayout />
      </Protected>
    ),
    errorElement: <RootError />,
    children: [
      { path: '/dashboard', element: <S><Dashboard /></S> },
      { path: '/jornada', element: <S><Jornada /></S> },
      { path: '/cursos', element: <S><Courses /></S> },
      { path: '/pacotes', element: <S><Bundles /></S> },
      { path: '/anotacoes', element: <S><MyNotes /></S> },
      { path: '/biblioteca', element: <S><Library /></S> },
      { path: '/news', element: <S><News /></S> },
      { path: '/podcasts', element: <S><Podcasts /></S> },
      { path: '/podcasts/:id', element: <S><PodcastEpisode /></S> },
      { path: '/tutor', element: <S><Tutor /></S> },
      { path: '/certificados', element: <S><Certificates /></S> },
      { path: '/suporte', element: <S><Support /></S> },
      { path: '/perfil', element: <S><Profile /></S> },
      { path: '/analise-supervisao', element: <S><AnaliseSupervisao /></S> },
      { path: '/notificacoes', element: <S><Notifications /></S> },
      { path: '/pedidos', element: <S><Pedidos /></S> },
      { path: '/eventos', element: <S><Eventos /></S> },
    ],
  },

  {
    element: (
      <Protected>
        <LearningLayout />
      </Protected>
    ),
    errorElement: <RootError />,
    children: [
      { path: '/curso/:courseId', element: <S><LMSCourse /></S> },
      { path: '/curso/:courseId/modulo/:moduleId', element: <S><LMSModule /></S> },
      { path: '/curso/:courseId/aula/:lessonId', element: <S><LMSLesson /></S> },
      { path: '/curso/:courseId/avaliacao/:assessmentId', element: <S><LMSAssessment /></S> },
    ],
  },

  {
    path: '/admin',
    element: (
      <Protected role="admin">
        <AdminLayout />
      </Protected>
    ),
    errorElement: <RootError />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <S><AdminDashboard /></S> },
      { path: 'cursos', element: <S><AdminCourses /></S> },
      { path: 'cursos/:id', element: <S><AdminCourseEditor /></S> },
      { path: 'modulos', element: <S><AdminModules /></S> },
      { path: 'aulas', element: <S><AdminLessons /></S> },
      { path: 'alunos', element: <S><AdminUsers /></S> },
      { path: 'alunos/:id', element: <S><AdminUserDetail /></S> },
      { path: 'evasao', element: <S><AdminEvasion /></S> },
      { path: 'plano-retomada-ia', element: <S><AdminRecoveryPlan /></S> },
      { path: 'retencao', element: <S><AdminRetention /></S> },
      { path: 'metricas', element: <S><AdminMetricas /></S> },
      { path: 'biblioteca', element: <S><AdminLibrary /></S> },
      { path: 'news', element: <S><AdminNews /></S> },
      { path: 'podcasts', element: <S><AdminPodcasts /></S> },
      { path: 'tutor', element: <S><AdminTutor /></S> },
      { path: 'ias', element: <S><AdminIAs /></S> },
      { path: 'certificados', element: <S><AdminCertificates /></S> },
      { path: 'analise-supervisao', element: <S><AdminAnaliseSupervisao /></S> },
      { path: 'reengajamento', element: <S><AdminReengajamento /></S> },
      { path: 'login-modelos', element: <S><AdminLoginModels /></S> },
      { path: 'login-customizacao', element: <S><AdminLoginCustomize /></S> },
      { path: 'configuracoes', element: <S><AdminSettings /></S> },
      { path: 'usuarios', element: <S><AdminUsuarios /></S> },
      { path: 'usuarios/import', element: <S><AdminUsersImport /></S> },
      { path: 'auditoria', element: <S><AdminAuditoria /></S> },
      { path: 'notificacoes', element: <S><AdminNotificacoes /></S> },
      { path: 'erros', element: <S><AdminErros /></S> },
      { path: 'suporte', element: <S><AdminSuporte /></S> },
      { path: 'backups', element: <S><AdminBackups /></S> },
      { path: 'gateways', element: <S><AdminGateways /></S> },
      { path: 'produtos', element: <S><AdminProducts /></S> },
      { path: 'cupons', element: <S><AdminCoupons /></S> },
      { path: 'moderacao', element: <S><AdminModeration /></S> },
      { path: 'vendas', element: <S><AdminVendas /></S> },
      { path: 'digest', element: <S><AdminDigest /></S> },
      { path: 'leaderboard', element: <S><AdminLeaderboard /></S> },
      { path: 'wishlist', element: <S><AdminWishlist /></S> },
      { path: 'suporte', element: <S><AdminSupport /></S> },
      { path: 'pedidos', element: <S><AdminOrders /></S> },
      { path: 'email', element: <S><AdminEmail /></S> },
      { path: 'webhooks', element: <S><AdminWebhooks /></S> },
      { path: 'saude', element: <S><AdminSaude /></S> },
      { path: 'reengajamento-auto', element: <S><AdminReengagementAuto /></S> },
      { path: 'broadcasts', element: <S><AdminBroadcasts /></S> },
      { path: 'sessoes', element: <S><AdminSessoes /></S> },
      { path: 'api-tokens', element: <S><AdminApiTokens /></S> },
      { path: 'atividade', element: <S><AdminActivity /></S> },
      { path: 'backup', element: <S><AdminBackup /></S> },
      { path: 'jobs', element: <S><AdminJobs /></S> },
      { path: 'logs', element: <S><AdminLogs /></S> },
      { path: 'rate-limits', element: <S><AdminRateLimits /></S> },
      { path: 'cursos/:courseId/preview', element: <S><AdminCoursePreview /></S> },
      { path: 'cursos/:courseId/analytics', element: <S><AdminCourseAnalytics /></S> },
      { path: 'cursos/:courseId/alunos', element: <S><AdminCourseStudents /></S> },
      { path: 'lgpd-exclusoes', element: <S><AdminDeletionRequests /></S> },
      { path: 'alertas', element: <S><AdminAlertsCenter /></S> },
      { path: 'sessoes-ao-vivo', element: <S><AdminLiveSessions /></S> },
      { path: 'setup', element: <S><AdminSetup /></S> },
      { path: 'imports', element: <S><ImportsHome /></S> },
      { path: 'imports/wizard', element: <S><ImportWizardCsv /></S> },
      { path: 'imports/wizard-api', element: <S><ImportWizardApi /></S> },
      { path: 'imports/schedules', element: <S><ImportSchedules /></S> },
      { path: 'imports/history', element: <S><ImportsHistory /></S> },
      { path: 'imports/jobs/:id', element: <S><ImportJobDetail /></S> },
    ],
  },

  { path: '*', element: <NotFound />, errorElement: <RootError /> },
]);
