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
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacidade = lazy(() => import('./pages/Privacidade'));
const Landing = lazy(() => import('./pages/Landing'));

// Student — lazy
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Jornada = lazy(() => import('./pages/Jornada'));
const Courses = lazy(() => import('./pages/Courses'));
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
const AdminAuditoria = lazy(() => import('./pages/admin/AdminAuditoria'));
const AdminNotificacoes = lazy(() => import('./pages/admin/AdminNotificacoes'));
const AdminErros = lazy(() => import('./pages/admin/AdminErros'));
const AdminSuporte = lazy(() => import('./pages/admin/AdminSuporte'));
const AdminBackups = lazy(() => import('./pages/admin/AdminBackups'));
const AdminGateways = lazy(() => import('./pages/admin/AdminGateways'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const ImportsHome = lazy(() => import('./pages/admin/imports/ImportsHome'));
const ImportWizardCsv = lazy(() => import('./pages/admin/imports/ImportWizardCsv'));
const ImportJobDetail = lazy(() => import('./pages/admin/imports/ImportJobDetail'));
const ImportsHistory = lazy(() => import('./pages/admin/imports/ImportsHistory'));
const AdminEmail = lazy(() => import('./pages/admin/AdminEmail'));
const ImportWizardApi = lazy(() => import('./pages/admin/imports/ImportWizardApi'));

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
      { path: 'auditoria', element: <S><AdminAuditoria /></S> },
      { path: 'notificacoes', element: <S><AdminNotificacoes /></S> },
      { path: 'erros', element: <S><AdminErros /></S> },
      { path: 'suporte', element: <S><AdminSuporte /></S> },
      { path: 'backups', element: <S><AdminBackups /></S> },
      { path: 'gateways', element: <S><AdminGateways /></S> },
      { path: 'produtos', element: <S><AdminProducts /></S> },
      { path: 'pedidos', element: <S><AdminOrders /></S> },
      { path: 'email', element: <S><AdminEmail /></S> },
      { path: 'imports', element: <S><ImportsHome /></S> },
      { path: 'imports/wizard', element: <S><ImportWizardCsv /></S> },
      { path: 'imports/wizard-api', element: <S><ImportWizardApi /></S> },
      { path: 'imports/history', element: <S><ImportsHistory /></S> },
      { path: 'imports/jobs/:id', element: <S><ImportJobDetail /></S> },
    ],
  },

  { path: '*', element: <NotFound />, errorElement: <RootError /> },
]);
