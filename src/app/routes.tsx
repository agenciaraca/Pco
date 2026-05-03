import { createBrowserRouter, Navigate } from 'react-router-dom';
import StudentLayout from './layouts/StudentLayout';
import AdminLayout from './layouts/AdminLayout';
import LearningLayout from './layouts/LearningLayout';
import RootError from './components/RootError';

// Public
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';
import Terms from './pages/Terms';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';

// Student
import Dashboard from './pages/Dashboard';
import Jornada from './pages/Jornada';
import Courses from './pages/Courses';
import Library from './pages/Library';
import News from './pages/News';
import Podcasts from './pages/Podcasts';
import Tutor from './pages/Tutor';
import Certificates from './pages/Certificates';
import Support from './pages/Support';
import Profile from './pages/Profile';
import AnaliseSupervisao from './pages/AnaliseSupervisao';
import Notifications from './pages/Notifications';

// Learning (LMS)
import LMSCourse from './pages/LMSCourse';
import LMSModule from './pages/LMSModule';
import LMSLesson from './pages/LMSLesson';
import LMSAssessment from './pages/LMSAssessment';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCourses from './pages/admin/AdminCourses';
import AdminCourseEditor from './pages/admin/AdminCourseEditor';
import AdminModules from './pages/admin/AdminModules';
import AdminLessons from './pages/admin/AdminLessons';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminEvasion from './pages/admin/AdminEvasion';
import AdminRecoveryPlan from './pages/admin/AdminRecoveryPlan';
import AdminRetention from './pages/admin/AdminRetention';
import AdminMetricas from './pages/admin/AdminMetricas';
import AdminLibrary from './pages/admin/AdminLibrary';
import AdminNews from './pages/admin/AdminNews';
import AdminPodcasts from './pages/admin/AdminPodcasts';
import AdminTutor from './pages/admin/AdminTutor';
import AdminIAs from './pages/admin/AdminIAs';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminAnaliseSupervisao from './pages/admin/AdminAnaliseSupervisao';
import AdminReengajamento from './pages/admin/AdminReengajamento';
import AdminLoginModels from './pages/admin/AdminLoginModels';
import AdminLoginCustomize from './pages/admin/AdminLoginCustomize';
import AdminSettings from './pages/admin/AdminSettings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RootError />,
  },
  { path: '/login', element: <Login />, errorElement: <RootError /> },
  { path: '/esqueci-senha', element: <ForgotPassword />, errorElement: <RootError /> },
  { path: '/onboarding', element: <Onboarding />, errorElement: <RootError /> },
  { path: '/termos', element: <Terms />, errorElement: <RootError /> },
  { path: '/landing', element: <Landing />, errorElement: <RootError /> },
  { path: '/ava-pco', element: <Landing />, errorElement: <RootError /> },

  {
    element: <StudentLayout />,
    errorElement: <RootError />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/jornada', element: <Jornada /> },
      { path: '/cursos', element: <Courses /> },
      { path: '/biblioteca', element: <Library /> },
      { path: '/news', element: <News /> },
      { path: '/podcasts', element: <Podcasts /> },
      { path: '/tutor', element: <Tutor /> },
      { path: '/certificados', element: <Certificates /> },
      { path: '/suporte', element: <Support /> },
      { path: '/perfil', element: <Profile /> },
      { path: '/analise-supervisao', element: <AnaliseSupervisao /> },
      { path: '/notificacoes', element: <Notifications /> },
    ],
  },

  {
    element: <LearningLayout />,
    errorElement: <RootError />,
    children: [
      { path: '/curso/:courseId', element: <LMSCourse /> },
      { path: '/curso/:courseId/modulo/:moduleId', element: <LMSModule /> },
      { path: '/curso/:courseId/aula/:lessonId', element: <LMSLesson /> },
      { path: '/curso/:courseId/avaliacao/:assessmentId', element: <LMSAssessment /> },
    ],
  },

  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <RootError />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboard /> },
      { path: 'cursos', element: <AdminCourses /> },
      { path: 'cursos/:id', element: <AdminCourseEditor /> },
      { path: 'modulos', element: <AdminModules /> },
      { path: 'aulas', element: <AdminLessons /> },
      { path: 'alunos', element: <AdminUsers /> },
      { path: 'alunos/:id', element: <AdminUserDetail /> },
      { path: 'evasao', element: <AdminEvasion /> },
      { path: 'plano-retomada-ia', element: <AdminRecoveryPlan /> },
      { path: 'retencao', element: <AdminRetention /> },
      { path: 'metricas', element: <AdminMetricas /> },
      { path: 'biblioteca', element: <AdminLibrary /> },
      { path: 'news', element: <AdminNews /> },
      { path: 'podcasts', element: <AdminPodcasts /> },
      { path: 'tutor', element: <AdminTutor /> },
      { path: 'ias', element: <AdminIAs /> },
      { path: 'certificados', element: <AdminCertificates /> },
      { path: 'analise-supervisao', element: <AdminAnaliseSupervisao /> },
      { path: 'reengajamento', element: <AdminReengajamento /> },
      { path: 'login-modelos', element: <AdminLoginModels /> },
      { path: 'login-customizacao', element: <AdminLoginCustomize /> },
      { path: 'configuracoes', element: <AdminSettings /> },
    ],
  },

  { path: '*', element: <NotFound />, errorElement: <RootError /> },
]);
