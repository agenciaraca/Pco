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

  // courses page
  'courses.title': 'Meus Cursos',
  'courses.subtitle': 'Cursos em que você está matriculado',
  'courses.empty': 'Você ainda não está matriculado em nenhum curso.',
  'courses.viewAll': 'Ver todos os cursos',
  'courses.continue': 'Continuar curso',
  'courses.start': 'Iniciar',
  'courses.completed': 'Concluído',
  'courses.inProgress': 'Em andamento',

  // library
  'library.title': 'Biblioteca PCO',
  'library.subtitle': 'Livros, artigos, vídeos e outros materiais.',
  'library.empty': 'Nenhum material disponível ainda.',
  'library.filter': 'Filtrar',
  'library.allTypes': 'Todos os tipos',

  // certificates
  'certificates.title': 'Meus Certificados',
  'certificates.subtitle': 'Certificados emitidos pela conclusão dos cursos.',
  'certificates.empty': 'Você ainda não tem certificados emitidos.',
  'certificates.view': 'Ver certificado',
  'certificates.download': 'Baixar PDF',
  'certificates.verify': 'Verificar autenticidade',

  // news
  'news.title': 'PCO News',
  'news.subtitle': 'Notícias e atualizações da Psicanálise Clínica Online.',
  'news.empty': 'Nenhuma notícia publicada ainda.',
  'news.readMore': 'Ler mais',

  // podcasts
  'podcasts.title': 'PCO POD',
  'podcasts.subtitle': 'Episódios em áudio sobre psicanálise.',
  'podcasts.empty': 'Nenhum episódio disponível ainda.',
  'podcasts.play': 'Reproduzir',
  'podcasts.episode': 'Episódio',

  // support
  'support.title': 'Suporte',
  'support.subtitle': 'Tire dúvidas, peça ajuda ou abra um chamado.',
  'support.newTicket': 'Abrir chamado',
  'support.subject': 'Assunto',
  'support.message': 'Mensagem',
  'support.send': 'Enviar',
  'support.empty': 'Nenhum chamado aberto.',

  // tutor
  'tutor.title': 'Tutor Virtual',
  'tutor.subtitle': 'Tire dúvidas com o tutor de IA da PCO.',
  'tutor.placeholder': 'Digite sua pergunta...',

  // notifications
  'notifications.title': 'Notificações',
  'notifications.empty': 'Nenhuma notificação no momento.',
  'notifications.markAllRead': 'Marcar todas como lidas',

  // notes
  'notes.title': 'Minhas Anotações',
  'notes.empty': 'Você ainda não tem anotações em aulas.',

  // forgot/reset password
  'forgot.title': 'Recuperar senha',
  'forgot.subtitle': 'Informe seu e-mail para receber instruções.',
  'forgot.send': 'Enviar instruções',
  'forgot.backToLogin': 'Voltar ao login',
  'forgot.sent': 'Se este e-mail estiver cadastrado, você receberá as instruções em alguns minutos.',
  'reset.title': 'Definir nova senha',
  'reset.newPassword': 'Nova senha',
  'reset.confirmPassword': 'Confirmar senha',
  'reset.submit': 'Salvar nova senha',
  'reset.success': 'Senha alterada com sucesso. Faça login.',

  // onboarding / 404
  'onboarding.welcome': 'Bem-vindo ao AVA PCO',
  'notfound.title': 'Página não encontrada',
  'notfound.subtitle': 'A página que você procura não existe ou foi movida.',
  'notfound.home': 'Voltar ao início',

  // jornada
  'journey.title': 'Minha Jornada',
  'journey.subtitle': 'Sua trilha de aprendizado pela formação da PCO.',

  // footer
  'footer.terms': 'Termos',
  'footer.privacy': 'Privacidade',

  // orders
  'orders.title': 'Meus Pedidos',
  'orders.empty': 'Você ainda não tem pedidos.',
  'orders.cancel': 'Cancelar pedido',
  'orders.viewInvoice': 'Ver fatura',
  'orders.payNow': 'Pagar agora',

  // events / bundles / catalog
  'events.title': 'Eventos',
  'bundles.title': 'Pacotes',
  'catalog.title': 'Catálogo de Cursos',

  // public pages
  'terms.title': 'Termos de Uso e Política de Privacidade',
  'privacy.title': 'Política de Privacidade',

  // admin nav
  'admin.section.panel': 'Painel',
  'admin.section.academic': 'Acadêmico',
  'admin.section.content': 'Conteúdo',
  'admin.section.sales': 'Vendas',
  'admin.section.communications': 'Comunicações',
  'admin.section.imports': 'Importações',
  'admin.section.system': 'Sistema',
  'admin.section.users': 'Usuários',
  'admin.section.analytics': 'Analytics',

  'admin.nav.dashboard': 'Dashboard',
  'admin.nav.setup': 'Setup',
  'admin.nav.health': 'Saúde do sistema',
  'admin.nav.activity': 'Feed de atividade',
  'admin.nav.alerts': 'Centro de alertas',
  'admin.nav.courses': 'Cursos',
  'admin.nav.studyPaths': 'Trilhas de Estudo',
  'admin.nav.modules': 'Módulos e Aulas',
  'admin.nav.students': 'Alunos',
  'admin.nav.certificates': 'Certificados',
  'admin.nav.achievements': 'Conquistas',
  'admin.nav.leaderboard': 'Leaderboard',
  'admin.nav.library': 'Biblioteca PCO',
  'admin.nav.news': 'PCO News',
  'admin.nav.podcasts': 'PCO POD',
  'admin.nav.liveSessions': 'Sessões ao vivo',
  'admin.nav.supervision': 'Análise e Supervisão',
  'admin.nav.orders': 'Pedidos',
  'admin.nav.products': 'Produtos',
  'admin.nav.coupons': 'Cupons',
  'admin.nav.gateways': 'Pagamentos',
  'admin.nav.salesAnalytics': 'Vendas (analytics)',
  'admin.nav.wishlist': 'Wishlist',
  'admin.nav.email': 'E-mail transacional',
  'admin.nav.broadcasts': 'Campanhas',
  'admin.nav.users': 'Usuários do sistema',
  'admin.nav.roles': 'Papéis e Permissões',
  'admin.nav.tickets': 'Suporte',
  'admin.nav.audit': 'Auditoria',
  'admin.nav.backups': 'Backups',
  'admin.nav.imports': 'Importações',
  'admin.nav.errors': 'Erros',
  'admin.nav.metrics': 'Métricas',
  'admin.nav.settings': 'Configurações',

  // admin common
  'admin.create': 'Criar',
  'admin.edit': 'Editar',
  'admin.delete': 'Excluir',
  'admin.export': 'Exportar',
  'admin.import': 'Importar',
  'admin.publish': 'Publicar',
  'admin.unpublish': 'Despublicar',
  'admin.archive': 'Arquivar',
  'admin.nav.evasion': 'Previsão de Evasão',
  'admin.nav.retention': 'Retenção',
  'admin.nav.reengagement': 'Reengajamento',
  'admin.nav.recoveryPlan': 'Plano de Retomada IA',
  'admin.nav.aiManagement': 'Gestão de IAs',
  'admin.nav.tutor': 'Tutor Virtual',
  'admin.nav.jobs': 'Jobs / workers',
  'admin.nav.deletionRequests': 'Pedidos de exclusão',
  'admin.nav.about': 'Sobre',
  'admin.nav.apiTokens': 'API Tokens',
  'admin.nav.loginCustomize': 'Customizar Login',
  'admin.nav.loginModels': 'Login Customizável',
  'admin.nav.moderation': 'Moderação',
  'admin.nav.lgpd': 'LGPD — Exclusões',
  'admin.nav.imports2': 'Importar dados',
  'admin.nav.studyPaths2': 'Trilhas de Estudo',
  'admin.nav.questions': 'Banco de Questões',
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

  // courses
  'courses.title': 'Mis Cursos',
  'courses.subtitle': 'Cursos en los que estás inscrito',
  'courses.empty': 'Aún no estás inscrito en ningún curso.',
  'courses.viewAll': 'Ver todos los cursos',
  'courses.continue': 'Continuar curso',
  'courses.start': 'Iniciar',
  'courses.completed': 'Completado',
  'courses.inProgress': 'En progreso',

  // library
  'library.title': 'Biblioteca PCO',
  'library.subtitle': 'Libros, artículos, videos y otros materiales.',
  'library.empty': 'Aún no hay materiales disponibles.',
  'library.filter': 'Filtrar',
  'library.allTypes': 'Todos los tipos',

  // certificates
  'certificates.title': 'Mis Certificados',
  'certificates.subtitle': 'Certificados emitidos al completar los cursos.',
  'certificates.empty': 'Aún no tienes certificados emitidos.',
  'certificates.view': 'Ver certificado',
  'certificates.download': 'Descargar PDF',
  'certificates.verify': 'Verificar autenticidad',

  // news
  'news.title': 'PCO News',
  'news.subtitle': 'Noticias y actualizaciones del Psicoanálisis Clínico Online.',
  'news.empty': 'Aún no se han publicado noticias.',
  'news.readMore': 'Leer más',

  // podcasts
  'podcasts.title': 'PCO POD',
  'podcasts.subtitle': 'Episodios de audio sobre psicoanálisis.',
  'podcasts.empty': 'Aún no hay episodios disponibles.',
  'podcasts.play': 'Reproducir',
  'podcasts.episode': 'Episodio',

  // support
  'support.title': 'Soporte',
  'support.subtitle': 'Resuelve dudas, pide ayuda o abre un ticket.',
  'support.newTicket': 'Abrir ticket',
  'support.subject': 'Asunto',
  'support.message': 'Mensaje',
  'support.send': 'Enviar',
  'support.empty': 'Sin tickets abiertos.',

  // tutor
  'tutor.title': 'Tutor Virtual',
  'tutor.subtitle': 'Resuelve dudas con el tutor de IA de PCO.',
  'tutor.placeholder': 'Escribe tu pregunta...',

  // notifications
  'notifications.title': 'Notificaciones',
  'notifications.empty': 'Sin notificaciones por ahora.',
  'notifications.markAllRead': 'Marcar todas como leídas',

  // notes
  'notes.title': 'Mis Notas',
  'notes.empty': 'Aún no tienes notas en clases.',

  // forgot/reset password
  'forgot.title': 'Recuperar contraseña',
  'forgot.subtitle': 'Ingresa tu correo para recibir instrucciones.',
  'forgot.send': 'Enviar instrucciones',
  'forgot.backToLogin': 'Volver al inicio de sesión',
  'forgot.sent': 'Si este correo está registrado, recibirás las instrucciones en pocos minutos.',
  'reset.title': 'Establecer nueva contraseña',
  'reset.newPassword': 'Nueva contraseña',
  'reset.confirmPassword': 'Confirmar contraseña',
  'reset.submit': 'Guardar nueva contraseña',
  'reset.success': 'Contraseña actualizada. Inicia sesión.',

  // onboarding / 404
  'onboarding.welcome': 'Bienvenido a AVA PCO',
  'notfound.title': 'Página no encontrada',
  'notfound.subtitle': 'La página que buscas no existe o fue movida.',
  'notfound.home': 'Volver al inicio',

  // jornada
  'journey.title': 'Mi Recorrido',
  'journey.subtitle': 'Tu trayecto de aprendizaje en la formación PCO.',

  // footer
  'footer.terms': 'Términos',
  'footer.privacy': 'Privacidad',

  // orders
  'orders.title': 'Mis Pedidos',
  'orders.empty': 'Aún no tienes pedidos.',
  'orders.cancel': 'Cancelar pedido',
  'orders.viewInvoice': 'Ver factura',
  'orders.payNow': 'Pagar ahora',

  // events / bundles / catalog
  'events.title': 'Eventos',
  'bundles.title': 'Paquetes',
  'catalog.title': 'Catálogo de Cursos',

  // public pages
  'terms.title': 'Términos de Uso y Política de Privacidad',
  'privacy.title': 'Política de Privacidad',

  // admin nav
  'admin.section.panel': 'Panel',
  'admin.section.academic': 'Académico',
  'admin.section.content': 'Contenido',
  'admin.section.sales': 'Ventas',
  'admin.section.communications': 'Comunicaciones',
  'admin.section.imports': 'Importaciones',
  'admin.section.system': 'Sistema',
  'admin.section.users': 'Usuarios',
  'admin.section.analytics': 'Analítica',

  'admin.nav.dashboard': 'Panel',
  'admin.nav.setup': 'Configuración inicial',
  'admin.nav.health': 'Salud del sistema',
  'admin.nav.activity': 'Feed de actividad',
  'admin.nav.alerts': 'Centro de alertas',
  'admin.nav.courses': 'Cursos',
  'admin.nav.studyPaths': 'Rutas de Estudio',
  'admin.nav.modules': 'Módulos y Clases',
  'admin.nav.students': 'Alumnos',
  'admin.nav.certificates': 'Certificados',
  'admin.nav.achievements': 'Logros',
  'admin.nav.leaderboard': 'Tabla de clasificación',
  'admin.nav.library': 'Biblioteca PCO',
  'admin.nav.news': 'PCO News',
  'admin.nav.podcasts': 'PCO POD',
  'admin.nav.liveSessions': 'Sesiones en vivo',
  'admin.nav.supervision': 'Análisis y Supervisión',
  'admin.nav.orders': 'Pedidos',
  'admin.nav.products': 'Productos',
  'admin.nav.coupons': 'Cupones',
  'admin.nav.gateways': 'Pagos',
  'admin.nav.salesAnalytics': 'Ventas (analítica)',
  'admin.nav.wishlist': 'Lista de deseos',
  'admin.nav.email': 'Email transaccional',
  'admin.nav.broadcasts': 'Campañas',
  'admin.nav.users': 'Usuarios del sistema',
  'admin.nav.roles': 'Roles y Permisos',
  'admin.nav.tickets': 'Soporte',
  'admin.nav.audit': 'Auditoría',
  'admin.nav.backups': 'Copias de seguridad',
  'admin.nav.imports': 'Importaciones',
  'admin.nav.errors': 'Errores',
  'admin.nav.metrics': 'Métricas',
  'admin.nav.settings': 'Configuración',

  // admin common
  'admin.create': 'Crear',
  'admin.edit': 'Editar',
  'admin.delete': 'Eliminar',
  'admin.export': 'Exportar',
  'admin.import': 'Importar',
  'admin.publish': 'Publicar',
  'admin.unpublish': 'Despublicar',
  'admin.archive': 'Archivar',
  'admin.nav.evasion': 'Predicción de abandono',
  'admin.nav.retention': 'Retención',
  'admin.nav.reengagement': 'Reactivación',
  'admin.nav.recoveryPlan': 'Plan de Recuperación IA',
  'admin.nav.aiManagement': 'Gestión de IAs',
  'admin.nav.tutor': 'Tutor Virtual',
  'admin.nav.jobs': 'Jobs / workers',
  'admin.nav.deletionRequests': 'Solicitudes de eliminación',
  'admin.nav.about': 'Acerca de',
  'admin.nav.apiTokens': 'Tokens API',
  'admin.nav.loginCustomize': 'Personalizar Login',
  'admin.nav.loginModels': 'Login Personalizable',
  'admin.nav.moderation': 'Moderación',
  'admin.nav.lgpd': 'GDPR — Eliminaciones',
  'admin.nav.imports2': 'Importar datos',
  'admin.nav.studyPaths2': 'Rutas de Estudio',
  'admin.nav.questions': 'Banco de Preguntas',
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

  // courses
  'courses.title': 'My Courses',
  'courses.subtitle': 'Courses you are enrolled in',
  'courses.empty': "You aren't enrolled in any course yet.",
  'courses.viewAll': 'View all courses',
  'courses.continue': 'Continue course',
  'courses.start': 'Start',
  'courses.completed': 'Completed',
  'courses.inProgress': 'In progress',

  // library
  'library.title': 'PCO Library',
  'library.subtitle': 'Books, articles, videos and other materials.',
  'library.empty': 'No materials available yet.',
  'library.filter': 'Filter',
  'library.allTypes': 'All types',

  // certificates
  'certificates.title': 'My Certificates',
  'certificates.subtitle': 'Certificates issued upon course completion.',
  'certificates.empty': 'You have no certificates yet.',
  'certificates.view': 'View certificate',
  'certificates.download': 'Download PDF',
  'certificates.verify': 'Verify authenticity',

  // news
  'news.title': 'PCO News',
  'news.subtitle': 'News and updates from Psicanálise Clínica Online.',
  'news.empty': 'No news posted yet.',
  'news.readMore': 'Read more',

  // podcasts
  'podcasts.title': 'PCO POD',
  'podcasts.subtitle': 'Audio episodes about psychoanalysis.',
  'podcasts.empty': 'No episodes available yet.',
  'podcasts.play': 'Play',
  'podcasts.episode': 'Episode',

  // support
  'support.title': 'Support',
  'support.subtitle': 'Get answers, ask for help or open a ticket.',
  'support.newTicket': 'Open ticket',
  'support.subject': 'Subject',
  'support.message': 'Message',
  'support.send': 'Send',
  'support.empty': 'No open tickets.',

  // tutor
  'tutor.title': 'Virtual Tutor',
  'tutor.subtitle': 'Ask questions to the PCO AI tutor.',
  'tutor.placeholder': 'Type your question...',

  // notifications
  'notifications.title': 'Notifications',
  'notifications.empty': 'No notifications right now.',
  'notifications.markAllRead': 'Mark all as read',

  // notes
  'notes.title': 'My Notes',
  'notes.empty': 'No lesson notes yet.',

  // forgot/reset password
  'forgot.title': 'Recover password',
  'forgot.subtitle': 'Enter your email to receive instructions.',
  'forgot.send': 'Send instructions',
  'forgot.backToLogin': 'Back to sign in',
  'forgot.sent': 'If this email is registered, you will receive instructions in a few minutes.',
  'reset.title': 'Set new password',
  'reset.newPassword': 'New password',
  'reset.confirmPassword': 'Confirm password',
  'reset.submit': 'Save new password',
  'reset.success': 'Password updated. Please sign in.',

  // onboarding / 404
  'onboarding.welcome': 'Welcome to AVA PCO',
  'notfound.title': 'Page not found',
  'notfound.subtitle': 'The page you are looking for does not exist or has moved.',
  'notfound.home': 'Back to home',

  // jornada
  'journey.title': 'My Journey',
  'journey.subtitle': 'Your learning path through the PCO program.',

  // footer
  'footer.terms': 'Terms',
  'footer.privacy': 'Privacy',

  // orders
  'orders.title': 'My Orders',
  'orders.empty': 'You have no orders yet.',
  'orders.cancel': 'Cancel order',
  'orders.viewInvoice': 'View invoice',
  'orders.payNow': 'Pay now',

  // events / bundles / catalog
  'events.title': 'Events',
  'bundles.title': 'Bundles',
  'catalog.title': 'Course Catalog',

  // public pages
  'terms.title': 'Terms of Use and Privacy Policy',
  'privacy.title': 'Privacy Policy',

  // admin nav
  'admin.section.panel': 'Panel',
  'admin.section.academic': 'Academic',
  'admin.section.content': 'Content',
  'admin.section.sales': 'Sales',
  'admin.section.communications': 'Communications',
  'admin.section.imports': 'Imports',
  'admin.section.system': 'System',
  'admin.section.users': 'Users',
  'admin.section.analytics': 'Analytics',

  'admin.nav.dashboard': 'Dashboard',
  'admin.nav.setup': 'Setup',
  'admin.nav.health': 'System health',
  'admin.nav.activity': 'Activity feed',
  'admin.nav.alerts': 'Alert center',
  'admin.nav.courses': 'Courses',
  'admin.nav.studyPaths': 'Study Paths',
  'admin.nav.modules': 'Modules & Lessons',
  'admin.nav.students': 'Students',
  'admin.nav.certificates': 'Certificates',
  'admin.nav.achievements': 'Achievements',
  'admin.nav.leaderboard': 'Leaderboard',
  'admin.nav.library': 'PCO Library',
  'admin.nav.news': 'PCO News',
  'admin.nav.podcasts': 'PCO POD',
  'admin.nav.liveSessions': 'Live sessions',
  'admin.nav.supervision': 'Analysis & Supervision',
  'admin.nav.orders': 'Orders',
  'admin.nav.products': 'Products',
  'admin.nav.coupons': 'Coupons',
  'admin.nav.gateways': 'Payments',
  'admin.nav.salesAnalytics': 'Sales analytics',
  'admin.nav.wishlist': 'Wishlist',
  'admin.nav.email': 'Transactional email',
  'admin.nav.broadcasts': 'Campaigns',
  'admin.nav.users': 'System users',
  'admin.nav.roles': 'Roles & Permissions',
  'admin.nav.tickets': 'Support',
  'admin.nav.audit': 'Audit log',
  'admin.nav.backups': 'Backups',
  'admin.nav.imports': 'Imports',
  'admin.nav.errors': 'Errors',
  'admin.nav.metrics': 'Metrics',
  'admin.nav.settings': 'Settings',

  // admin common
  'admin.create': 'Create',
  'admin.edit': 'Edit',
  'admin.delete': 'Delete',
  'admin.export': 'Export',
  'admin.import': 'Import',
  'admin.publish': 'Publish',
  'admin.unpublish': 'Unpublish',
  'admin.archive': 'Archive',
  'admin.nav.evasion': 'Dropout Prediction',
  'admin.nav.retention': 'Retention',
  'admin.nav.reengagement': 'Re-engagement',
  'admin.nav.recoveryPlan': 'AI Recovery Plan',
  'admin.nav.aiManagement': 'AI Management',
  'admin.nav.tutor': 'Virtual Tutor',
  'admin.nav.jobs': 'Jobs / workers',
  'admin.nav.deletionRequests': 'Deletion requests',
  'admin.nav.about': 'About',
  'admin.nav.apiTokens': 'API Tokens',
  'admin.nav.loginCustomize': 'Customize Login',
  'admin.nav.loginModels': 'Login Customization',
  'admin.nav.moderation': 'Moderation',
  'admin.nav.lgpd': 'LGPD — Deletions',
  'admin.nav.imports2': 'Import data',
  'admin.nav.studyPaths2': 'Study Paths',
  'admin.nav.questions': 'Question Bank',
};

export const DICTIONARIES: Record<SupportedLocale, Dict> = { pt, es, en };

export type TranslationKey = keyof typeof pt;
