#!/usr/bin/env npx tsx
/**
 * migrate-from-sql.ts
 *
 * Migração direta a partir de dumps SQL (PortalPCOBD.sql + PCOWOOBD.sql).
 * Lê tabelas WP/LD/WC direto do .sql, cruza dados, gera JSONs da plataforma.
 *
 * Uso:
 *   npx tsx scripts/migrate-from-sql.ts --ld=<caminho_LD.sql> [--wc=<caminho_WC.sql>] [--dry-run]
 *
 * Saída (em data/):
 *   users.json, admin-students.json, courses.json, lesson-progress.json,
 *   question-bank.json, external-references.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readSqlDump, type Row } from './lib/sql-reader.js';
import { phpUnserialize, type PhpArray } from './lib/php-unserialize.js';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const a = args.find(a => a.startsWith(prefix));
  return a ? a.slice(prefix.length) : undefined;
}
const dryRun = args.includes('--dry-run');
const ldPath = getArg('ld') || 'C:\\Users\\alexj\\Downloads\\PortalPCOBD.sql';
const wcPath = getArg('wc') || 'C:\\Users\\alexj\\Downloads\\PCOWOOBD.sql';

const DATA_DIR = resolve(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uid(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = randomBytes(3).toString('hex');
  return `${prefix}-${ts}${rnd}`;
}
function isoFromUnix(ts: number | null | undefined): string | null {
  if (!ts || ts === 0) return null;
  return new Date(ts * 1000).toISOString();
}
function safeIso(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.startsWith('0000')) return new Date('2021-01-01').toISOString();
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date('2021-01-01').toISOString();
    return d.toISOString();
  } catch {
    return new Date('2021-01-01').toISOString();
  }
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// Spam filter — same 8 patterns from migrate_wp_to_ava.ts
const SPAM_PATTERNS = [
  /[а-яА-ЯёЁ]{3,}/,          // Cyrillic
  /blogspot\.(com|ru|co)/i,
  /\.(ru|ua|by)\b/i,
  /seo|backlink|casino|porn|viagra|cialis/i,
  /https?:\/\/[^\s]+\.(ru|ua|by)/i,
  /buy\s+(cheap|online)/i,
  /\b(xrumer|hrumer|GSA)\b/i,
  // O range 0x00-0x7F é ASCII por definição; a negação detecta sequências longas
  // não-ASCII (spam SEO em cirílico). Os chars de controle aqui são intencionais.
  // eslint-disable-next-line no-control-regex
  /[^\x00-\x7F]{10,}/,        // long non-ASCII runs
];
function isSpam(name: string): boolean {
  return SPAM_PATTERNS.some(p => p.test(name));
}

// ---------------------------------------------------------------------------
// 1. Read SQL dump
// ---------------------------------------------------------------------------
const LD_TABLES = [
  'wp_users',
  'wp_usermeta',
  'wp_posts',
  'wp_postmeta',
  'wp_learndash_user_activity',
  'wp_learndash_user_activity_meta',
  'wp_learndash_pro_quiz_question',
  'wp_learndash_pro_quiz_master',
];

async function main() {
  console.log('=== Migração SQL → AVA PCO ===');
  console.log(`LD dump: ${ldPath}`);
  console.log(`WC dump: ${wcPath}`);
  console.log(`Dry run: ${dryRun}`);
  console.log();

  // --- Parse LD dump ---
  console.log('Lendo LD dump (pode demorar ~1min para 79MB)...');
  const ldTables = await readSqlDump(ldPath, LD_TABLES, (table, n) => {
    if (n % 5000 === 0) process.stdout.write(`  ${table}: ${n} rows\r`);
  });
  console.log();

  for (const [table, rows] of ldTables) {
    console.log(`  ${table}: ${rows.length} rows`);
  }
  console.log();

  // --- Build indexes ---
  const wpUsers = ldTables.get('wp_users')!;
  const wpUsermeta = ldTables.get('wp_usermeta')!;
  const wpPosts = ldTables.get('wp_posts')!;
  const wpPostmeta = ldTables.get('wp_postmeta')!;
  const ldActivity = ldTables.get('wp_learndash_user_activity')!;
  const ldActivityMeta = ldTables.get('wp_learndash_user_activity_meta')!;
  const ldQuizQuestions = ldTables.get('wp_learndash_pro_quiz_question')!;
  const ldQuizMasters = ldTables.get('wp_learndash_pro_quiz_master')!;

  // Index usermeta by user_id
  const usermetaByUser = new Map<number, Row[]>();
  for (const m of wpUsermeta) {
    const userId = m.user_id as number;
    if (!usermetaByUser.has(userId)) usermetaByUser.set(userId, []);
    usermetaByUser.get(userId)!.push(m);
  }

  // Index postmeta by post_id
  const postmetaByPost = new Map<number, Row[]>();
  for (const m of wpPostmeta) {
    const postId = m.post_id as number;
    if (!postmetaByPost.has(postId)) postmetaByPost.set(postId, []);
    postmetaByPost.get(postId)!.push(m);
  }

  // Index posts by type
  const postsByType = new Map<string, Row[]>();
  for (const p of wpPosts) {
    const type = p.post_type as string;
    if (!postsByType.has(type)) postsByType.set(type, []);
    postsByType.get(type)!.push(p);
  }

  // Posts by ID
  const postsById = new Map<number, Row>();
  for (const p of wpPosts) postsById.set(p.ID as number, p);

  // Activity meta by activity_id
  const actMetaByActivity = new Map<number, Row[]>();
  for (const m of ldActivityMeta) {
    const actId = m.activity_id as number;
    if (!actMetaByActivity.has(actId)) actMetaByActivity.set(actId, []);
    actMetaByActivity.get(actId)!.push(m);
  }

  // Quiz master by id
  const quizMasterById = new Map<number, Row>();
  for (const q of ldQuizMasters) quizMasterById.set(q.id as number, q);

  // -----------------------------------------------------------------------
  // 2. Extract courses (sfwd-courses)
  // -----------------------------------------------------------------------
  console.log('--- Extraindo cursos ---');
  const ldCourses = postsByType.get('sfwd-courses') || [];
  console.log(`  ${ldCourses.length} cursos LD encontrados`);

  interface CourseInfo {
    wpId: number;
    slug: string;
    title: string;
    description: string;
    status: string;
    expireDays: number;
    certificatePostId: number | null;
  }

  const coursesInfo: CourseInfo[] = [];
  const courseIdMap = new Map<number, string>(); // wpId → avaId

  for (const c of ldCourses) {
    const wpId = c.ID as number;
    const meta = postmetaByPost.get(wpId) || [];
    const sfwdMeta = meta.find(m => m.meta_key === '_sfwd-courses');
    let expireDays = 0;
    let certificatePostId: number | null = null;

    if (sfwdMeta?.meta_value) {
      const parsed = phpUnserialize(sfwdMeta.meta_value as string) as PhpArray | null;
      if (parsed) {
        const exp = parsed['sfwd-courses_expire_access_days'];
        if (typeof exp === 'number') expireDays = exp;
        else if (typeof exp === 'string') expireDays = parseInt(exp, 10) || 0;

        const cert = parsed['sfwd-courses_certificate'];
        if (typeof cert === 'number' && cert > 0) certificatePostId = cert;
        else if (typeof cert === 'string' && parseInt(cert, 10) > 0) certificatePostId = parseInt(cert, 10);
      }
    }

    const avaId = String(wpId);
    courseIdMap.set(wpId, avaId);

    coursesInfo.push({
      wpId,
      slug: (c.post_name as string) || `course-${wpId}`,
      title: (c.post_title as string) || `Curso ${wpId}`,
      description: stripHtml((c.post_content as string) || ''),
      status: c.post_status as string,
      expireDays,
      certificatePostId,
    });

    console.log(`  [${wpId}] ${c.post_title} (${c.post_status}, expire=${expireDays}d)`);
  }

  // -----------------------------------------------------------------------
  // 3. Extract modules (sfwd-lessons = nível do meio)
  // -----------------------------------------------------------------------
  console.log('\n--- Extraindo módulos (sfwd-lessons) ---');
  const ldLessons = postsByType.get('sfwd-lessons') || [];
  console.log(`  ${ldLessons.length} lessons/módulos LD encontrados`);

  interface ModuleInfo {
    wpId: number;
    courseWpId: number;
    title: string;
    description: string;
    order: number;
  }

  const modulesByCourse = new Map<number, ModuleInfo[]>();

  for (const l of ldLessons) {
    const wpId = l.ID as number;
    const meta = postmetaByPost.get(wpId) || [];
    const sfwdMeta = meta.find(m => m.meta_key === '_sfwd-lessons');
    let courseWpId = 0;

    if (sfwdMeta?.meta_value) {
      const parsed = phpUnserialize(sfwdMeta.meta_value as string) as PhpArray | null;
      if (parsed) {
        const cid = parsed['sfwd-lessons_course'];
        courseWpId = typeof cid === 'number' ? cid : parseInt(String(cid), 10) || 0;
      }
    }

    if (!courseWpId) continue;

    const mod: ModuleInfo = {
      wpId,
      courseWpId,
      title: (l.post_title as string) || `Módulo ${wpId}`,
      description: stripHtml((l.post_content as string) || ''),
      order: (l.menu_order as number) || 0,
    };

    if (!modulesByCourse.has(courseWpId)) modulesByCourse.set(courseWpId, []);
    modulesByCourse.get(courseWpId)!.push(mod);
  }

  // Sort modules by order within each course
  for (const mods of modulesByCourse.values()) {
    mods.sort((a, b) => a.order - b.order);
    mods.forEach((m, i) => { m.order = i + 1; });
  }

  // -----------------------------------------------------------------------
  // 4. Extract lessons/aulas (sfwd-topic = nível folha)
  // -----------------------------------------------------------------------
  console.log('\n--- Extraindo aulas (sfwd-topic) ---');
  const ldTopics = postsByType.get('sfwd-topic') || [];
  console.log(`  ${ldTopics.length} topics/aulas LD encontrados`);

  interface LessonInfo {
    wpId: number;
    courseWpId: number;
    moduleWpId: number; // parent lesson (sfwd-lessons) = our module
    title: string;
    description: string;
    content: string;
    videoUrl: string | null;
    order: number;
  }

  const lessonsByModule = new Map<number, LessonInfo[]>();
  let videoCount = 0;

  for (const t of ldTopics) {
    const wpId = t.ID as number;
    const meta = postmetaByPost.get(wpId) || [];
    const sfwdMeta = meta.find(m => m.meta_key === '_sfwd-topic');
    let courseWpId = 0;
    let moduleWpId = 0;
    let videoUrl: string | null = null;

    if (sfwdMeta?.meta_value) {
      const parsed = phpUnserialize(sfwdMeta.meta_value as string) as PhpArray | null;
      if (parsed) {
        const cid = parsed['sfwd-topic_course'];
        courseWpId = typeof cid === 'number' ? cid : parseInt(String(cid), 10) || 0;

        const lid = parsed['sfwd-topic_lesson'];
        moduleWpId = typeof lid === 'number' ? lid : parseInt(String(lid), 10) || 0;

        const vEnabled = parsed['sfwd-topic_lesson_video_enabled'];
        const vUrl = parsed['sfwd-topic_lesson_video_url'];
        if (vEnabled === 'on' && typeof vUrl === 'string' && vUrl.length > 5) {
          videoUrl = vUrl;
          videoCount++;
        }
      }
    }

    if (!courseWpId || !moduleWpId) continue;

    const lesson: LessonInfo = {
      wpId,
      courseWpId,
      moduleWpId,
      title: (t.post_title as string) || `Aula ${wpId}`,
      description: truncate(stripHtml((t.post_content as string) || ''), 500),
      content: (t.post_content as string) || '',
      videoUrl,
      order: (t.menu_order as number) || 0,
    };

    if (!lessonsByModule.has(moduleWpId)) lessonsByModule.set(moduleWpId, []);
    lessonsByModule.get(moduleWpId)!.push(lesson);
  }

  // Sort lessons by order within each module
  for (const lessons of lessonsByModule.values()) {
    lessons.sort((a, b) => a.order - b.order);
    lessons.forEach((l, i) => { l.order = i + 1; });
  }

  console.log(`  ${videoCount} aulas com vídeo Vimeo`);

  // Debug: count topics per course (from raw postmeta, not just mapped ones)
  const topicCourseCount = new Map<number, number>();
  let topicsSkippedNoCourse = 0;
  let topicsSkippedNoModule = 0;
  let topicsSkippedNoMeta = 0;
  for (const t of ldTopics) {
    const wpId = t.ID as number;
    const meta = postmetaByPost.get(wpId) || [];
    const sfwdMeta = meta.find(m => m.meta_key === '_sfwd-topic');
    if (!sfwdMeta?.meta_value) { topicsSkippedNoMeta++; continue; }

    const parsed = phpUnserialize(sfwdMeta.meta_value as string) as PhpArray | null;
    if (!parsed) { topicsSkippedNoMeta++; continue; }

    const cid = parsed['sfwd-topic_course'];
    const lid = parsed['sfwd-topic_lesson'];
    const courseWpId = typeof cid === 'number' ? cid : parseInt(String(cid), 10) || 0;
    const moduleWpId = typeof lid === 'number' ? lid : parseInt(String(lid), 10) || 0;

    if (!courseWpId) { topicsSkippedNoCourse++; continue; }
    if (!moduleWpId) { topicsSkippedNoModule++; continue; }

    topicCourseCount.set(courseWpId, (topicCourseCount.get(courseWpId) || 0) + 1);
  }
  console.log(`\n  DEBUG topics por curso (raw):`);
  for (const [cid, count] of topicCourseCount) {
    const mapped = lessonsByModule.get(cid)?.length || 0;
    const courseTitle = coursesInfo.find(c => c.wpId === cid)?.title || '?';
    console.log(`    [${cid}] ${courseTitle}: ${count} topics no postmeta`);
  }
  console.log(`  Skipped: noMeta=${topicsSkippedNoMeta} noCourse=${topicsSkippedNoCourse} noModule=${topicsSkippedNoModule}`);

  // -----------------------------------------------------------------------
  // 5. Build courses.json
  // -----------------------------------------------------------------------
  console.log('\n--- Montando courses.json ---');

  const COVER_COLORS = [
    'from-blue-600 to-cyan-500',
    'from-purple-600 to-pink-500',
    'from-emerald-600 to-teal-500',
    'from-orange-500 to-red-500',
    'from-indigo-600 to-blue-500',
    'from-rose-500 to-pink-500',
    'from-teal-500 to-green-500',
    'from-amber-500 to-orange-500',
    'from-violet-600 to-purple-500',
    'from-cyan-500 to-blue-500',
    'from-lime-500 to-green-500',
    'from-fuchsia-500 to-pink-500',
    'from-sky-500 to-indigo-500',
  ];

  interface AvaLesson {
    id: string;
    moduleId: string;
    courseId: string;
    title: string;
    durationMinutes: number;
    description: string;
    content: string;
    videoUrl?: string;
    isMandatory: boolean;
    order: number;
  }

  interface AvaModule {
    id: string;
    courseId: string;
    title: string;
    description: string;
    order: number;
    lessons: AvaLesson[];
  }

  interface AvaCourse {
    id: string;
    slug: string;
    title: string;
    shortTitle: string;
    description: string;
    coverColor: string;
    modules: AvaModule[];
    totalHours: number;
    certificateAvailable: boolean;
    active: boolean;
    tags: string[];
    expireDays?: number;
  }

  const avaCourses: AvaCourse[] = [];

  for (let ci = 0; ci < coursesInfo.length; ci++) {
    const c = coursesInfo[ci];
    const mods = modulesByCourse.get(c.wpId) || [];
    const avaModules: AvaModule[] = [];
    let totalLessons = 0;

    for (const mod of mods) {
      const modId = `mod-${c.wpId}-${mod.wpId}`;
      const lessons = lessonsByModule.get(mod.wpId) || [];
      const avaLessons: AvaLesson[] = [];

      for (const les of lessons) {
        const lesId = `lesson-${c.wpId}-${les.wpId}`;
        avaLessons.push({
          id: lesId,
          moduleId: modId,
          courseId: String(c.wpId),
          title: les.title,
          durationMinutes: 15, // default — can be refined from Vimeo API
          description: les.description,
          content: les.content,
          ...(les.videoUrl ? { videoUrl: les.videoUrl } : {}),
          isMandatory: true,
          order: les.order,
        });
        totalLessons++;
      }

      avaModules.push({
        id: modId,
        courseId: String(c.wpId),
        title: mod.title,
        description: mod.description,
        order: mod.order,
        lessons: avaLessons,
      });
    }

    avaCourses.push({
      id: String(c.wpId),
      slug: c.slug,
      title: c.title,
      shortTitle: truncate(c.title, 60),
      description: truncate(c.description, 2000),
      coverColor: COVER_COLORS[ci % COVER_COLORS.length],
      modules: avaModules,
      totalHours: Math.ceil((totalLessons * 15) / 60),
      certificateAvailable: !!c.certificatePostId,
      active: c.status === 'publish',
      tags: [],
      ...(c.expireDays > 0 ? { expireDays: c.expireDays } : {}),
    });

    console.log(`  [${c.wpId}] ${c.title}: ${avaModules.length} módulos, ${totalLessons} aulas, active=${c.status === 'publish'}`);
  }

  // -----------------------------------------------------------------------
  // 6. Extract users
  // -----------------------------------------------------------------------
  console.log('\n--- Extraindo usuários ---');

  interface AvaUser {
    id: string;
    email: string;
    name: string;
    role: 'student' | 'admin' | 'superadmin';
    passwordHash: string;
    tokenVersion: number;
    createdAt: string;
    updatedAt: string;
    active: boolean;
    document?: string;
  }

  interface AvaStudent {
    id: string;
    name: string;
    email: string;
    enrolledCourseIds: string[];
    progressByCourse: Record<string, number>;
    status: 'ativo' | 'em_risco' | 'inativo' | 'bloqueado';
    riskScore: number;
    lastAccessAt: string;
    createdAt: string;
    enrollmentDates?: Record<string, string>;
  }

  // Keep existing seed users
  const existingUsers: AvaUser[] = JSON.parse(readFileSync(resolve(DATA_DIR, 'users.json'), 'utf-8'));
  const seedEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

  const newUsers: AvaUser[] = [...existingUsers];
  const avaStudents: AvaStudent[] = [];
  const wpIdToAvaId = new Map<number, string>();
  const emailToAvaId = new Map<string, string>();
  let spamCount = 0;
  let dupeCount = 0;

  // Default password hash (bcrypt of "MudarSenha2026!")
  const DEFAULT_PASS = '$2b$11$placeholder.hash.for.imported.students.only';

  for (const u of wpUsers) {
    const wpId = u.ID as number;
    const email = ((u.user_email as string) || '').toLowerCase().trim();
    const displayName = (u.display_name as string) || '';
    const registered = (u.user_registered as string) || '2021-01-01T00:00:00.000Z';

    if (!email) continue;

    // Get first_name / last_name from usermeta
    const metas = usermetaByUser.get(wpId) || [];
    const firstName = (metas.find(m => m.meta_key === 'first_name')?.meta_value as string) || '';
    const lastName = (metas.find(m => m.meta_key === 'last_name')?.meta_value as string) || '';
    const name = (firstName && lastName)
      ? `${firstName} ${lastName}`
      : displayName || email.split('@')[0];

    // Check spam
    if (isSpam(name) || isSpam(displayName)) {
      spamCount++;
      continue;
    }

    // Check role — only import subscribers/students
    const capsMeta = metas.find(m => m.meta_key === 'wp_capabilities');
    let isAdmin = false;
    if (capsMeta?.meta_value) {
      const capsStr = capsMeta.meta_value as string;
      isAdmin = capsStr.includes('administrator') || capsStr.includes('editor');
    }
    if (isAdmin) continue;

    // Skip seeds
    if (seedEmails.has(email)) {
      dupeCount++;
      continue;
    }

    // Dedup by email
    if (emailToAvaId.has(email)) {
      wpIdToAvaId.set(wpId, emailToAvaId.get(email)!);
      dupeCount++;
      continue;
    }

    const avaId = `stude-wp${wpId}`;
    wpIdToAvaId.set(wpId, avaId);
    emailToAvaId.set(email, avaId);

    newUsers.push({
      id: avaId,
      email,
      name,
      role: 'student',
      passwordHash: DEFAULT_PASS,
      tokenVersion: 0,
      createdAt: safeIso(registered),
      updatedAt: new Date().toISOString(),
      active: true,
    });
  }

  console.log(`  ${wpUsers.length} WP users total`);
  console.log(`  ${spamCount} spam filtrados`);
  console.log(`  ${dupeCount} duplicados/seeds ignorados`);
  console.log(`  ${newUsers.length - existingUsers.length} novos alunos importados`);
  console.log(`  ${newUsers.length} users total (com seeds)`);

  // -----------------------------------------------------------------------
  // 7. Enrollments + Progress
  // -----------------------------------------------------------------------
  console.log('\n--- Extraindo matrículas e progressão ---');

  // Build enrollment data from wp_learndash_user_activity
  // activity_type='course' rows track progress
  // activity_type='access' rows track enrollment dates

  // Enrollment dates from 'access' type
  const enrollmentDates = new Map<string, number>(); // "userId:courseId" → unix ts
  for (const act of ldActivity) {
    if (act.activity_type !== 'access') continue;
    const userId = act.user_id as number;
    const courseId = act.course_id as number;
    const started = act.activity_started as number;
    const key = `${userId}:${courseId}`;
    enrollmentDates.set(key, started);
  }

  // Progress from 'course' type activities
  const courseActivities = ldActivity.filter(a => a.activity_type === 'course');
  console.log(`  ${courseActivities.length} course activity rows`);
  console.log(`  ${enrollmentDates.size} enrollment (access) rows`);

  // Also get progress from wp_usermeta._sfwd-course_progress for more detail
  const progressByUser = new Map<number, Record<number, { completed: number; total: number }>>();
  for (const m of wpUsermeta) {
    if (m.meta_key !== '_sfwd-course_progress') continue;
    const userId = m.user_id as number;
    const parsed = phpUnserialize(m.meta_value as string) as PhpArray | null;
    if (!parsed) continue;

    const userProgress: Record<number, { completed: number; total: number }> = {};
    for (const [courseIdStr, courseData] of Object.entries(parsed)) {
      const courseId = parseInt(courseIdStr, 10);
      if (!courseId || typeof courseData !== 'object' || courseData === null) continue;
      const cd = courseData as PhpArray;
      const completed = typeof cd.completed === 'number' ? cd.completed : 0;
      const total = typeof cd.total === 'number' ? cd.total : 0;
      userProgress[courseId] = { completed, total };
    }
    progressByUser.set(userId, userProgress);
  }

  console.log(`  ${progressByUser.size} users com _sfwd-course_progress`);

  // Course completion timestamps
  const completionDates = new Map<string, number>(); // "userId:courseId" → unix ts
  for (const m of wpUsermeta) {
    const key = m.meta_key as string;
    if (!key?.startsWith('course_completed_')) continue;
    const courseId = parseInt(key.replace('course_completed_', ''), 10);
    if (!courseId) continue;
    const userId = m.user_id as number;
    const ts = parseInt(m.meta_value as string, 10);
    if (ts) completionDates.set(`${userId}:${courseId}`, ts);
  }

  // Course expiration
  const expirationDates = new Map<string, number>(); // "userId:courseId" → unix ts
  for (const m of wpUsermeta) {
    const key = m.meta_key as string;
    if (!key?.startsWith('learndash_course_expired_')) continue;
    const courseId = parseInt(key.replace('learndash_course_expired_', ''), 10);
    if (!courseId) continue;
    const userId = m.user_id as number;
    const ts = parseInt(m.meta_value as string, 10);
    if (ts) expirationDates.set(`${userId}:${courseId}`, ts);
  }

  console.log(`  ${completionDates.size} course completions`);
  console.log(`  ${expirationDates.size} course expirations`);

  // Build AdminStudent records
  // Collect all enrolled users from course activities
  const enrolledUserCourses = new Map<number, Set<number>>(); // userId → Set<courseId>
  for (const act of courseActivities) {
    const userId = act.user_id as number;
    const courseId = act.course_id as number;
    if (!courseIdMap.has(courseId)) continue; // skip courses we don't have
    if (!enrolledUserCourses.has(userId)) enrolledUserCourses.set(userId, new Set());
    enrolledUserCourses.get(userId)!.add(courseId);
  }
  // Also add from access activities
  for (const act of ldActivity) {
    if (act.activity_type !== 'access') continue;
    const userId = act.user_id as number;
    const courseId = act.course_id as number;
    if (!courseIdMap.has(courseId)) continue;
    if (!enrolledUserCourses.has(userId)) enrolledUserCourses.set(userId, new Set());
    enrolledUserCourses.get(userId)!.add(courseId);
  }

  let enrollmentCount = 0;
  let progressRecords = 0;

  // Keep existing seed students
  const existingStudents: AvaStudent[] = JSON.parse(readFileSync(resolve(DATA_DIR, 'admin-students.json'), 'utf-8'));
  const seedStudentIds = new Set(existingStudents.map(s => s.id));

  for (const [wpUserId, courseIds] of enrolledUserCourses) {
    const avaId = wpIdToAvaId.get(wpUserId);
    if (!avaId) continue; // user filtered (spam/admin/etc)
    if (seedStudentIds.has(avaId)) continue;

    const user = newUsers.find(u => u.id === avaId);
    if (!user) continue;

    const enrolledCourseIds: string[] = [];
    const progressByCourse: Record<string, number> = {};
    const enrollDates: Record<string, string> = {};
    let lastAccess = 0;

    const userProgress = progressByUser.get(wpUserId) || {};

    for (const courseWpId of courseIds) {
      const avaCourseId = courseIdMap.get(courseWpId);
      if (!avaCourseId) continue;

      enrolledCourseIds.push(avaCourseId);
      enrollmentCount++;

      // Progress percentage
      const prog = userProgress[courseWpId];
      if (prog && prog.total > 0) {
        progressByCourse[avaCourseId] = Math.round((prog.completed / prog.total) * 100);
        progressRecords++;
      } else {
        // Try from activity meta
        const courseAct = courseActivities.find(a =>
          a.user_id === wpUserId && a.course_id === courseWpId
        );
        if (courseAct) {
          const actMeta = actMetaByActivity.get(courseAct.activity_id as number) || [];
          const stepsCompleted = actMeta.find(m => m.activity_meta_key === 'steps_completed');
          const stepsTotal = actMeta.find(m => m.activity_meta_key === 'steps_total');
          if (stepsCompleted && stepsTotal) {
            const completed = parseInt(stepsCompleted.activity_meta_value as string, 10) || 0;
            const total = parseInt(stepsTotal.activity_meta_value as string, 10) || 1;
            progressByCourse[avaCourseId] = Math.round((completed / total) * 100);
            progressRecords++;
          } else {
            progressByCourse[avaCourseId] = courseAct.activity_status === 1 ? 100 : 0;
          }
        } else {
          progressByCourse[avaCourseId] = 0;
        }
      }

      // Completion check — override to 100% if completed
      const completionKey = `${wpUserId}:${courseWpId}`;
      if (completionDates.has(completionKey)) {
        progressByCourse[avaCourseId] = 100;
      }

      // Enrollment date
      const enrollKey = `${wpUserId}:${courseWpId}`;
      const enrollTs = enrollmentDates.get(enrollKey);
      if (enrollTs) {
        enrollDates[avaCourseId] = new Date(enrollTs * 1000).toISOString();
      }

      // Track last access
      const courseAct = courseActivities.find(a =>
        a.user_id === wpUserId && a.course_id === courseWpId
      );
      if (courseAct) {
        const updated = courseAct.activity_updated as number;
        if (updated > lastAccess) lastAccess = updated;
      }
    }

    if (enrolledCourseIds.length === 0) continue;

    // Determine status
    let status: AvaStudent['status'] = 'ativo';
    const allExpired = enrolledCourseIds.every(cid => {
      const courseWpId = parseInt(cid, 10);
      return expirationDates.has(`${wpUserId}:${courseWpId}`);
    });
    if (allExpired && expirationDates.size > 0) status = 'inativo';

    avaStudents.push({
      id: avaId,
      name: user.name,
      email: user.email,
      enrolledCourseIds,
      progressByCourse,
      status,
      riskScore: 0,
      lastAccessAt: lastAccess ? new Date(lastAccess * 1000).toISOString() : user.createdAt,
      createdAt: user.createdAt,
      enrollmentDates: Object.keys(enrollDates).length > 0 ? enrollDates : undefined,
    });
  }

  console.log(`  ${avaStudents.length} alunos com matrícula`);
  console.log(`  ${enrollmentCount} matrículas totais`);
  console.log(`  ${progressRecords} registros de progresso`);

  // -----------------------------------------------------------------------
  // 8. Lesson-level progress
  // -----------------------------------------------------------------------
  console.log('\n--- Extraindo progresso por aula ---');

  interface LessonProgress {
    userId: string;
    lessonId: string;
    courseId: string;
    moduleId: string;
    completedAt: string;
  }

  const lessonProgressRecords: LessonProgress[] = [];

  // From wp_learndash_user_activity where activity_type='topic' and status=1
  const completedTopics = ldActivity.filter(a =>
    a.activity_type === 'topic' && a.activity_status === 1
  );

  // Build a lookup: topicWpId → { courseWpId, moduleWpId (=lessonWpId) }
  const topicParents = new Map<number, { courseWpId: number; moduleWpId: number }>();
  for (const lessons of lessonsByModule.values()) {
    for (const les of lessons) {
      topicParents.set(les.wpId, { courseWpId: les.courseWpId, moduleWpId: les.moduleWpId });
    }
  }

  for (const act of completedTopics) {
    const userId = act.user_id as number;
    const topicWpId = act.post_id as number;
    const courseWpId = act.course_id as number;
    const completedTs = act.activity_completed as number;

    const avaUserId = wpIdToAvaId.get(userId);
    if (!avaUserId) continue;

    const parent = topicParents.get(topicWpId);
    if (!parent) continue;

    const avaCourseId = courseIdMap.get(courseWpId);
    if (!avaCourseId) continue;

    lessonProgressRecords.push({
      userId: avaUserId,
      lessonId: `lesson-${courseWpId}-${topicWpId}`,
      courseId: avaCourseId,
      moduleId: `mod-${courseWpId}-${parent.moduleWpId}`,
      completedAt: isoFromUnix(completedTs) || new Date().toISOString(),
    });
  }

  console.log(`  ${lessonProgressRecords.length} registros de progresso por aula`);

  // -----------------------------------------------------------------------
  // 9. Quiz questions
  // -----------------------------------------------------------------------
  console.log('\n--- Extraindo questões ---');

  interface AvaQuestion {
    id: string;
    courseId: string;
    moduleId?: string;
    type: 'multiple_choice' | 'true_false' | 'open_ended';
    prompt: string;
    options: Array<{ id: string; text: string; correct: boolean }>;
    explanation: string;
    tags: string[];
    difficulty: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }

  // Build quiz → course mapping from sfwd-quiz posts
  const quizPosts = postsByType.get('sfwd-quiz') || [];
  const quizToCourse = new Map<number, number>(); // proQuizId → courseWpId

  for (const q of quizPosts) {
    const qpId = q.ID as number;
    const meta = postmetaByPost.get(qpId) || [];
    const sfwdMeta = meta.find(m => m.meta_key === '_sfwd-quiz');
    if (!sfwdMeta?.meta_value) continue;

    const parsed = phpUnserialize(sfwdMeta.meta_value as string) as PhpArray | null;
    if (!parsed) continue;

    const courseId = parsed['sfwd-quiz_course'];
    const proQuizId = parsed['sfwd-quiz_quiz_pro'];

    if (courseId && proQuizId) {
      const cid = typeof courseId === 'number' ? courseId : parseInt(String(courseId), 10);
      const pqid = typeof proQuizId === 'number' ? proQuizId : parseInt(String(proQuizId), 10);
      if (cid && pqid) quizToCourse.set(pqid, cid);
    }
  }

  const avaQuestions: AvaQuestion[] = [];

  for (const q of ldQuizQuestions) {
    const quizId = q.quiz_id as number;
    const courseWpId = quizToCourse.get(quizId);
    if (!courseWpId) continue;

    const avaCourseId = courseIdMap.get(courseWpId);
    if (!avaCourseId) continue;

    const answerType = q.answer_type as string;
    let avaType: AvaQuestion['type'] = 'multiple_choice';
    if (answerType === 'single') avaType = 'multiple_choice';
    else if (answerType === 'multiple') avaType = 'multiple_choice';
    else if (answerType === 'free') avaType = 'open_ended';
    else if (answerType === 'cloze_answer') avaType = 'open_ended';
    else if (answerType === 'essay') avaType = 'open_ended';

    const prompt = stripHtml((q.question as string) || (q.title as string) || '');
    if (!prompt) continue;

    // Parse answer_data (PHP serialized)
    const options: AvaQuestion['options'] = [];
    if (q.answer_data && avaType !== 'open_ended') {
      const answerData = phpUnserialize(q.answer_data as string) as PhpArray | null;
      if (answerData) {
        let optIndex = 0;
        for (const [, val] of Object.entries(answerData)) {
          if (typeof val !== 'object' || val === null) continue;
          const av = val as PhpArray;
          const text = stripHtml(String(av._answer || av.answer || ''));
          const correct = av._correct === true || av._correct === 1 || av.correct === true || av.correct === 1;
          if (text) {
            options.push({
              id: `opt-${optIndex}`,
              text,
              correct,
            });
            optIndex++;
          }
        }
      }
    }

    // Detect true/false
    if (options.length === 2) {
      const texts = options.map(o => o.text.toLowerCase());
      if (
        (texts.includes('verdadeiro') && texts.includes('falso')) ||
        (texts.includes('true') && texts.includes('false')) ||
        (texts.includes('v') && texts.includes('f'))
      ) {
        avaType = 'true_false';
      }
    }

    const correctMsg = (q.correct_msg as string) || '';
    const incorrectMsg = (q.incorrect_msg as string) || '';
    const explanation = stripHtml(correctMsg || incorrectMsg);

    avaQuestions.push({
      id: `q-ld${q.id}`,
      courseId: avaCourseId,
      type: avaType,
      prompt,
      options,
      explanation,
      tags: [],
      difficulty: 3,
      active: (q.online as number) === 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`  ${ldQuizQuestions.length} questões LD raw`);
  console.log(`  ${avaQuestions.length} questões importadas para AVA`);
  console.log(`  ${avaQuestions.filter(q => q.options.length > 0).length} com opções parseadas`);

  // -----------------------------------------------------------------------
  // 10. External references
  // -----------------------------------------------------------------------
  console.log('\n--- Gerando external references ---');

  interface ExternalRef {
    id: string;
    sourceType: 'learndash';
    externalEntityType: string;
    externalId: string;
    internalEntityType: string;
    internalId: string;
    metadata: Record<string, unknown>;
    jobId: string;
    createdAt: string;
    updatedAt: string;
  }

  const jobId = `sql-migration-${Date.now()}`;
  const now = new Date().toISOString();
  const refs: ExternalRef[] = [];

  // Course refs
  for (const c of coursesInfo) {
    refs.push({
      id: uid('xref'),
      sourceType: 'learndash',
      externalEntityType: 'course',
      externalId: `portal:${c.wpId}`,
      internalEntityType: 'course',
      internalId: String(c.wpId),
      metadata: { slug: c.slug, title: c.title, status: c.status },
      jobId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // User refs
  for (const [wpId, avaId] of wpIdToAvaId) {
    refs.push({
      id: uid('xref'),
      sourceType: 'learndash',
      externalEntityType: 'student',
      externalId: `portal:${wpId}`,
      internalEntityType: 'student',
      internalId: avaId,
      metadata: {},
      jobId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Enrollment refs
  for (const student of avaStudents) {
    for (const courseId of student.enrolledCourseIds) {
      refs.push({
        id: uid('xref'),
        sourceType: 'learndash',
        externalEntityType: 'enrollment',
        externalId: `portal:${student.id}:${courseId}`,
        internalEntityType: 'enrollment',
        internalId: `${student.id}:${courseId}`,
        metadata: {
          enrollmentDate: student.enrollmentDates?.[courseId] || null,
        },
        jobId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(`  ${refs.length} external references`);

  // -----------------------------------------------------------------------
  // 11. Write output
  // -----------------------------------------------------------------------
  console.log('\n--- Escrevendo JSONs ---');

  const allStudents = [...existingStudents, ...avaStudents];

  const outputs: Record<string, unknown> = {
    'users.json': newUsers,
    'admin-students.json': allStudents,
    'courses.json': avaCourses,
    'lesson-progress.json': lessonProgressRecords,
    'question-bank.json': avaQuestions,
    'external-references.json': refs,
  };

  if (dryRun) {
    console.log('\n  [DRY RUN] Nenhum arquivo escrito.\n');
    for (const [file, data] of Object.entries(outputs)) {
      const arr = data as unknown[];
      console.log(`  ${file}: ${arr.length} registros`);
    }
  } else {
    for (const [file, data] of Object.entries(outputs)) {
      const path = resolve(DATA_DIR, file);
      writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
      const arr = data as unknown[];
      console.log(`  ✓ ${file}: ${arr.length} registros`);
    }
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n=== RESUMO DA MIGRAÇÃO ===');
  console.log(`  Cursos:     ${avaCourses.length} (${avaCourses.filter(c => c.active).length} ativos)`);
  console.log(`  Módulos:    ${avaCourses.reduce((s, c) => s + c.modules.length, 0)}`);
  console.log(`  Aulas:      ${avaCourses.reduce((s, c) => s + c.modules.reduce((s2, m) => s2 + m.lessons.length, 0), 0)}`);
  console.log(`  Vídeos:     ${videoCount}`);
  console.log(`  Alunos:     ${newUsers.length - existingUsers.length} novos + ${existingUsers.length} seeds`);
  console.log(`  Matrículas: ${enrollmentCount}`);
  console.log(`  Progresso:  ${lessonProgressRecords.length} lesson-level`);
  console.log(`  Questões:   ${avaQuestions.length}`);
  console.log(`  Refs:       ${refs.length}`);
  console.log(`  Spam:       ${spamCount} filtrados`);
  if (dryRun) console.log('\n  ⚠ DRY RUN — nada foi escrito no disco');
  console.log();
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
