// Dicionários de tradução do AVA PCO. Português é a fonte (native).
// Adicionar novo idioma: criar nova chave no SupportedLocale + traduzir todas
// as keys deste arquivo. Faltas caem pro fallback (PT) automaticamente.

export const SUPPORTED_LOCALES = ['pt', 'es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  pt: 'Português',
  es: 'Español',
  en: 'English',
};

export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  pt: '🇧🇷',
  es: '🇪🇸',
  en: '🇺🇸',
};

// Estrutura plana com keys namespaced (common.cancel, lesson.markComplete, etc.)
// Plano facilita lookup, simples de manter, sem ambiguidade.
type Dict = Record<string, string>;

const pt: Dict = {
  // common
  'common.cancel': 'Cancelar',
  'common.save': 'Salvar',
  'common.delete': 'Excluir',
  'common.edit': 'Editar',
  'common.create': 'Criar',
  'common.confirm': 'Confirmar',
  'common.close': 'Fechar',
  'common.loading': 'Carregando...',
  'common.error': 'Erro',
  'common.retry': 'Tentar de novo',
  'common.search': 'Buscar',
  'common.back': 'Voltar',
  'common.next': 'Próximo',
  'common.previous': 'Anterior',
  'common.yes': 'Sim',
  'common.no': 'Não',
  'common.ok': 'OK',
  'common.copy': 'Copiar',
  'common.share': 'Compartilhar',
  'common.show': 'Mostrar',
  'common.hide': 'Ocultar',
  'common.empty': 'Nada por aqui ainda.',

  // nav (aluno)
  'nav.dashboard': 'Início',
  'nav.courses': 'Cursos',
  'nav.library': 'Biblioteca',
  'nav.podcasts': 'Podcasts',
  'nav.news': 'Notícias',
  'nav.certificates': 'Certificados',
  'nav.profile': 'Perfil',
  'nav.support': 'Suporte',
  'nav.logout': 'Sair',
  'nav.settings': 'Configurações',

  // auth
  'auth.login': 'Entrar',
  'auth.logout': 'Sair',
  'auth.register': 'Cadastrar',
  'auth.email': 'E-mail',
  'auth.password': 'Senha',
  'auth.forgotPassword': 'Esqueci a senha',
  'auth.rememberMe': 'Lembrar-me',
  'auth.signIn': 'Entrar',
  'auth.signOut': 'Sair',
  'auth.invalidCredentials': 'E-mail ou senha incorretos.',
  'auth.welcomeBack': 'Bem-vindo de volta',

  // dashboard
  'dashboard.welcome': 'Bem-vindo de volta,',
  'dashboard.subtitle': 'Você está construindo uma rotina sólida. Continue no seu ritmo.',
  'dashboard.viewJourney': 'Ver Minha Jornada',
  'dashboard.continueFromHere': 'Continuar de onde parou',
  'dashboard.continueStudying': 'Continuar estudando',
  'dashboard.continueLesson': 'Continuar aula',
  'dashboard.weekStudy': 'Estudo da semana',
  'dashboard.streak': 'Sequência',
  'dashboard.recentNews': 'Notícias recentes',
  'dashboard.recentPodcasts': 'Podcasts em destaque',
  'dashboard.lastCertificate': 'Último certificado',

  // lesson / player
  'lesson.markComplete': 'Marcar como concluída',
  'lesson.markIncomplete': 'Desmarcar conclusão',
  'lesson.completed': 'Concluída',
  'lesson.transcript': 'Transcrição',
  'lesson.transcriptShow': 'Mostrar transcrição',
  'lesson.transcriptHide': 'Ocultar transcrição',
  'lesson.transcriptNone': 'Esta aula ainda não tem transcrição disponível.',
  'lesson.transcriptLoading': 'Carregando transcrição...',
  'lesson.transcriptCopied': 'Transcrição copiada',
  'lesson.transcriptLanguage': 'Idioma da transcrição',
  'lesson.summary': 'Resumo da aula',
  'lesson.materials': 'Materiais complementares',
  'lesson.notes': 'Minhas anotações',
  'lesson.notesEmpty': 'Sem anotações ainda.',
  'lesson.notesEdit': 'Editar',
  'lesson.notesPreview': 'Preview',
  'lesson.duration': '{n} min',
  'lesson.mandatory': 'Aula obrigatória',
  'lesson.optional': 'Opcional',
  'lesson.shortcuts': 'Atalhos',

  // courses
  'course.title': 'Curso',
  'course.modules': 'Módulos',
  'course.lessons': 'Aulas',
  'course.progress': 'Progresso',
  'course.startCourse': 'Iniciar curso',
  'course.continueCourse': 'Continuar',
  'course.completed': 'Curso concluído',
  'course.locked': 'Bloqueado',
  'course.preview': 'Preview',

  // certificate
  'certificate.title': 'Certificado',
  'certificate.download': 'Baixar certificado',
  'certificate.print': 'Imprimir',
  'certificate.issuedAt': 'Emitido em',
  'certificate.notIssued': 'Certificado ainda não emitido.',

  // profile
  'profile.title': 'Meu perfil',
  'profile.name': 'Nome',
  'profile.changePassword': 'Trocar senha',
  'profile.language': 'Idioma',
  'profile.languageHint': 'Aplica-se à interface da plataforma.',
  'profile.saved': 'Alterações salvas',

  // empty / errors
  'error.notFound': 'Não encontrado',
  'error.forbidden': 'Acesso negado',
  'error.unauthorized': 'Sessão expirada',
  'error.network': 'Falha de conexão. Tente novamente.',
  'error.unknown': 'Ocorreu um erro inesperado.',
};

const es: Dict = {
  // common
  'common.cancel': 'Cancelar',
  'common.save': 'Guardar',
  'common.delete': 'Eliminar',
  'common.edit': 'Editar',
  'common.create': 'Crear',
  'common.confirm': 'Confirmar',
  'common.close': 'Cerrar',
  'common.loading': 'Cargando...',
  'common.error': 'Error',
  'common.retry': 'Reintentar',
  'common.search': 'Buscar',
  'common.back': 'Volver',
  'common.next': 'Siguiente',
  'common.previous': 'Anterior',
  'common.yes': 'Sí',
  'common.no': 'No',
  'common.ok': 'OK',
  'common.copy': 'Copiar',
  'common.share': 'Compartir',
  'common.show': 'Mostrar',
  'common.hide': 'Ocultar',
  'common.empty': 'Nada por aquí todavía.',

  // nav
  'nav.dashboard': 'Inicio',
  'nav.courses': 'Cursos',
  'nav.library': 'Biblioteca',
  'nav.podcasts': 'Podcasts',
  'nav.news': 'Noticias',
  'nav.certificates': 'Certificados',
  'nav.profile': 'Perfil',
  'nav.support': 'Soporte',
  'nav.logout': 'Salir',
  'nav.settings': 'Configuración',

  // auth
  'auth.login': 'Entrar',
  'auth.logout': 'Salir',
  'auth.register': 'Registrarse',
  'auth.email': 'Correo electrónico',
  'auth.password': 'Contraseña',
  'auth.forgotPassword': 'Olvidé mi contraseña',
  'auth.rememberMe': 'Recordarme',
  'auth.signIn': 'Iniciar sesión',
  'auth.signOut': 'Cerrar sesión',
  'auth.invalidCredentials': 'Correo o contraseña incorrectos.',
  'auth.welcomeBack': 'Bienvenido de vuelta',

  // dashboard
  'dashboard.welcome': 'Bienvenido de vuelta,',
  'dashboard.subtitle': 'Estás construyendo una rutina sólida. Continúa a tu ritmo.',
  'dashboard.viewJourney': 'Ver Mi Recorrido',
  'dashboard.continueFromHere': 'Continuar desde donde lo dejaste',
  'dashboard.continueStudying': 'Continuar estudiando',
  'dashboard.continueLesson': 'Continuar clase',
  'dashboard.weekStudy': 'Estudio de la semana',
  'dashboard.streak': 'Racha',
  'dashboard.recentNews': 'Noticias recientes',
  'dashboard.recentPodcasts': 'Podcasts destacados',
  'dashboard.lastCertificate': 'Último certificado',

  // lesson
  'lesson.markComplete': 'Marcar como completada',
  'lesson.markIncomplete': 'Desmarcar finalización',
  'lesson.completed': 'Completada',
  'lesson.transcript': 'Transcripción',
  'lesson.transcriptShow': 'Mostrar transcripción',
  'lesson.transcriptHide': 'Ocultar transcripción',
  'lesson.transcriptNone': 'Esta clase aún no tiene transcripción disponible.',
  'lesson.transcriptLoading': 'Cargando transcripción...',
  'lesson.transcriptCopied': 'Transcripción copiada',
  'lesson.transcriptLanguage': 'Idioma de la transcripción',
  'lesson.summary': 'Resumen de la clase',
  'lesson.materials': 'Materiales complementarios',
  'lesson.notes': 'Mis notas',
  'lesson.notesEmpty': 'Sin notas todavía.',
  'lesson.notesEdit': 'Editar',
  'lesson.notesPreview': 'Vista previa',
  'lesson.duration': '{n} min',
  'lesson.mandatory': 'Clase obligatoria',
  'lesson.optional': 'Opcional',
  'lesson.shortcuts': 'Atajos',

  // courses
  'course.title': 'Curso',
  'course.modules': 'Módulos',
  'course.lessons': 'Clases',
  'course.progress': 'Progreso',
  'course.startCourse': 'Iniciar curso',
  'course.continueCourse': 'Continuar',
  'course.completed': 'Curso finalizado',
  'course.locked': 'Bloqueado',
  'course.preview': 'Vista previa',

  // certificate
  'certificate.title': 'Certificado',
  'certificate.download': 'Descargar certificado',
  'certificate.print': 'Imprimir',
  'certificate.issuedAt': 'Emitido el',
  'certificate.notIssued': 'Certificado aún no emitido.',

  // profile
  'profile.title': 'Mi perfil',
  'profile.name': 'Nombre',
  'profile.changePassword': 'Cambiar contraseña',
  'profile.language': 'Idioma',
  'profile.languageHint': 'Se aplica a la interfaz de la plataforma.',
  'profile.saved': 'Cambios guardados',

  // errors
  'error.notFound': 'No encontrado',
  'error.forbidden': 'Acceso denegado',
  'error.unauthorized': 'Sesión expirada',
  'error.network': 'Falla de conexión. Inténtalo de nuevo.',
  'error.unknown': 'Ha ocurrido un error inesperado.',
};

const en: Dict = {
  // common
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.retry': 'Retry',
  'common.search': 'Search',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.ok': 'OK',
  'common.copy': 'Copy',
  'common.share': 'Share',
  'common.show': 'Show',
  'common.hide': 'Hide',
  'common.empty': 'Nothing here yet.',

  // nav
  'nav.dashboard': 'Home',
  'nav.courses': 'Courses',
  'nav.library': 'Library',
  'nav.podcasts': 'Podcasts',
  'nav.news': 'News',
  'nav.certificates': 'Certificates',
  'nav.profile': 'Profile',
  'nav.support': 'Support',
  'nav.logout': 'Log out',
  'nav.settings': 'Settings',

  // auth
  'auth.login': 'Sign in',
  'auth.logout': 'Sign out',
  'auth.register': 'Sign up',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot password',
  'auth.rememberMe': 'Remember me',
  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.invalidCredentials': 'Incorrect email or password.',
  'auth.welcomeBack': 'Welcome back',

  // dashboard
  'dashboard.welcome': 'Welcome back,',
  'dashboard.subtitle': "You're building a solid routine. Keep at your own pace.",
  'dashboard.viewJourney': 'View My Journey',
  'dashboard.continueFromHere': 'Continue where you left off',
  'dashboard.continueStudying': 'Continue studying',
  'dashboard.continueLesson': 'Continue lesson',
  'dashboard.weekStudy': 'This week study',
  'dashboard.streak': 'Streak',
  'dashboard.recentNews': 'Recent news',
  'dashboard.recentPodcasts': 'Featured podcasts',
  'dashboard.lastCertificate': 'Latest certificate',

  // lesson
  'lesson.markComplete': 'Mark complete',
  'lesson.markIncomplete': 'Unmark complete',
  'lesson.completed': 'Completed',
  'lesson.transcript': 'Transcript',
  'lesson.transcriptShow': 'Show transcript',
  'lesson.transcriptHide': 'Hide transcript',
  'lesson.transcriptNone': 'This lesson does not have a transcript yet.',
  'lesson.transcriptLoading': 'Loading transcript...',
  'lesson.transcriptCopied': 'Transcript copied',
  'lesson.transcriptLanguage': 'Transcript language',
  'lesson.summary': 'Lesson summary',
  'lesson.materials': 'Complementary materials',
  'lesson.notes': 'My notes',
  'lesson.notesEmpty': 'No notes yet.',
  'lesson.notesEdit': 'Edit',
  'lesson.notesPreview': 'Preview',
  'lesson.duration': '{n} min',
  'lesson.mandatory': 'Mandatory lesson',
  'lesson.optional': 'Optional',
  'lesson.shortcuts': 'Shortcuts',

  // courses
  'course.title': 'Course',
  'course.modules': 'Modules',
  'course.lessons': 'Lessons',
  'course.progress': 'Progress',
  'course.startCourse': 'Start course',
  'course.continueCourse': 'Continue',
  'course.completed': 'Course completed',
  'course.locked': 'Locked',
  'course.preview': 'Preview',

  // certificate
  'certificate.title': 'Certificate',
  'certificate.download': 'Download certificate',
  'certificate.print': 'Print',
  'certificate.issuedAt': 'Issued on',
  'certificate.notIssued': 'Certificate not issued yet.',

  // profile
  'profile.title': 'My profile',
  'profile.name': 'Name',
  'profile.changePassword': 'Change password',
  'profile.language': 'Language',
  'profile.languageHint': 'Applies to the platform interface.',
  'profile.saved': 'Changes saved',

  // errors
  'error.notFound': 'Not found',
  'error.forbidden': 'Access denied',
  'error.unauthorized': 'Session expired',
  'error.network': 'Connection failed. Please retry.',
  'error.unknown': 'An unexpected error occurred.',
};

export const DICTIONARIES: Record<SupportedLocale, Dict> = { pt, es, en };

export type TranslationKey = keyof typeof pt;
