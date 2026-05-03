// Popula a base remota com dados iniciais. Idempotente (upsert por id).
// Uso: DATABASE_URL=... npm run db:seed

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql as sqlT } from 'drizzle-orm';
import * as schema from './schema';
import {
  courses as seedCourses,
  newsArticles as seedNews,
  podcasts as seedPodcasts,
  libraryItems as seedLibrary,
  professionals as seedProfessionals,
  sessionServices as seedSessionServices,
  certificates as seedCertificates,
  retentionRisks as seedRetentionRisks,
  adminStudents as seedAdminStudents,
  currentStudent as seedCurrentStudent,
} from '../../src/app/data/seed';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[seed] DATABASE_URL ausente.');
    process.exit(1);
  }

  const sql = neon(url);
  const db = drizzle(sql, { schema });

  console.log('[seed] populando users e students...');

  // Demo user (currentStudent + adminStudents)
  await db
    .insert(schema.users)
    .values({
      id: seedCurrentStudent.id,
      email: seedCurrentStudent.email,
      name: seedCurrentStudent.name,
      role: 'student',
    })
    .onConflictDoNothing();

  await db
    .insert(schema.students)
    .values({
      id: seedCurrentStudent.id,
      userId: seedCurrentStudent.id,
      weeklyGoalMinutes: seedCurrentStudent.weeklyGoalMinutes,
      totalStudyMinutes: seedCurrentStudent.totalStudyMinutes,
      riskScore: seedCurrentStudent.riskScore ?? 0,
      status: 'ativo',
    })
    .onConflictDoNothing();

  for (const s of seedAdminStudents) {
    await db
      .insert(schema.users)
      .values({ id: s.id, email: s.email, name: s.name, role: 'student' })
      .onConflictDoNothing();
    await db
      .insert(schema.students)
      .values({
        id: s.id,
        userId: s.id,
        weeklyGoalMinutes: 180,
        totalStudyMinutes: 0,
        riskScore: s.riskScore,
        status: s.status,
        lastAccessAt: new Date(s.lastAccessAt),
      })
      .onConflictDoNothing();
  }

  console.log('[seed] populando cursos, módulos, aulas, avaliações...');

  for (const c of seedCourses) {
    await db
      .insert(schema.courses)
      .values({
        id: c.id,
        slug: c.slug,
        title: c.title,
        shortTitle: c.shortTitle,
        description: c.description,
        coverColor: c.coverColor,
        totalHours: c.totalHours,
        certificateAvailable: c.certificateAvailable,
        active: true,
      })
      .onConflictDoNothing();

    for (const m of c.modules) {
      await db
        .insert(schema.modules)
        .values({
          id: m.id,
          courseId: c.id,
          title: m.title,
          description: m.description ?? null,
          order: m.order,
        })
        .onConflictDoNothing();

      for (const l of m.lessons) {
        await db
          .insert(schema.lessons)
          .values({
            id: l.id,
            moduleId: m.id,
            courseId: c.id,
            title: l.title,
            durationMinutes: l.durationMinutes,
            videoUrl: l.videoUrl ?? null,
            description: l.description ?? null,
            isMandatory: l.isMandatory,
            order: l.order,
          })
          .onConflictDoNothing();
      }

      if (m.assessment) {
        await db
          .insert(schema.assessments)
          .values({
            id: m.assessment.id,
            moduleId: m.id,
            courseId: c.id,
            title: m.assessment.title,
            questionCount: m.assessment.questionCount,
            passingScore: m.assessment.passingScore,
            timeLimitMinutes: m.assessment.timeLimitMinutes ?? null,
          })
          .onConflictDoNothing();
      }
    }
  }

  console.log('[seed] populando news, podcasts, library...');

  for (const n of seedNews) {
    await db
      .insert(schema.newsArticles)
      .values({
        id: n.id,
        title: n.title,
        excerpt: n.excerpt,
        body: n.body ?? null,
        category: n.category,
        tags: n.tags,
        coverColor: n.coverColor,
        authorName: n.authorName,
        publishedAt: n.publishedAt,
        featured: n.featured ?? false,
        relatedCourseIds: n.relatedCourseIds ?? [],
      })
      .onConflictDoNothing();
  }

  for (const p of seedPodcasts) {
    await db
      .insert(schema.podcasts)
      .values({
        id: p.id,
        title: p.title,
        description: p.description,
        durationMinutes: p.durationMinutes,
        publishedAt: p.publishedAt,
        coverColor: p.coverColor,
        audioUrl: p.audioUrl ?? null,
        relatedCourseIds: p.relatedCourseIds ?? [],
        relatedModuleIds: p.relatedModuleIds ?? [],
      })
      .onConflictDoNothing();
  }

  for (const i of seedLibrary) {
    await db
      .insert(schema.libraryItems)
      .values({
        id: i.id,
        title: i.title,
        author: i.author,
        type: i.type,
        mandatory: i.mandatory,
        fileMockUrl: i.fileMockUrl,
        relatedCourseIds: i.relatedCourseIds ?? [],
        relatedModuleIds: i.relatedModuleIds ?? [],
        theme: i.theme ?? null,
      })
      .onConflictDoNothing();
  }

  console.log('[seed] populando certificates, retention risks...');

  for (const cert of seedCertificates) {
    await db
      .insert(schema.certificates)
      .values({
        id: cert.id,
        courseId: cert.courseId,
        studentId: cert.studentId,
        validationCode: cert.validationCode,
        qrCodeMockUrl: cert.qrCodeMockUrl,
        status: cert.status,
        progress: cert.progress,
      })
      .onConflictDoNothing();
  }

  for (const r of seedRetentionRisks) {
    await db
      .insert(schema.retentionRisks)
      .values({
        studentId: r.studentId,
        score: r.score,
        level: r.level,
        reasons: r.reasons,
        expectedProgress: r.expectedProgress,
        realProgress: r.realProgress,
        pendingAssessments: r.pendingAssessments,
        tutorUsage: r.tutorUsage,
        podConsumption: r.podConsumption,
        libraryInteractions: r.libraryInteractions,
        recommendedAction: r.recommendedAction,
      })
      .onConflictDoNothing();
  }

  console.log('[seed] populando profissionais e serviços...');

  for (const p of seedProfessionals) {
    await db
      .insert(schema.professionals)
      .values({
        id: p.id,
        name: p.name,
        avatarColor: p.avatarColor,
        bio: p.bio,
        email: p.email,
        hourlyRate: p.hourlyRate,
        specialties: p.specialties,
        serviceIds: p.serviceIds,
      })
      .onConflictDoNothing();
  }

  for (const s of seedSessionServices) {
    await db
      .insert(schema.sessionServices)
      .values({
        id: s.id,
        name: s.name,
        type: s.type,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price,
        active: s.active,
        paymentBeforeConfirmation: s.paymentBeforeConfirmation,
      })
      .onConflictDoNothing();
  }

  console.log('[seed] populando configurações iniciais de IA (sem chaves)...');

  await db
    .insert(schema.aiConfigurations)
    .values([
      {
        id: 'ai-tutor',
        module: 'tutor',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKeyEncrypted: '',
        temperature: 0.3,
        maxTokens: 1200,
        perStudentLimit: 50,
        perDayLimit: 5000,
        perMonthLimit: 120000,
        monthlyCostCap: 800,
        systemMessage: `Você é o Tutor Virtual da PCO. Responde apenas dúvidas pedagógicas dos cursos.
NUNCA fornece diagnóstico, orientação médica/jurídica ou substitui profissional qualificado.
Linguagem em PT-BR, adulta e acolhedora.`,
        allowedScopes: ['cursos PCO', 'aulas', 'leituras', 'avaliações'],
        blockedTopics: [
          'diagnóstico psicológico',
          'orientação médica',
          'orientação jurídica',
          'supervisão clínica individual',
          'prescrição de tratamento',
        ],
        fallbackResponse:
          'Esta pergunta está fora do escopo pedagógico do Tutor Virtual da PCO.',
        active: true,
      },
      {
        id: 'ai-recovery',
        module: 'recovery_plan',
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKeyEncrypted: '',
        temperature: 0.5,
        maxTokens: 1500,
        perStudentLimit: 4,
        perDayLimit: 200,
        perMonthLimit: 6000,
        monthlyCostCap: 200,
        systemMessage: 'Gere planos de retomada acolhedores baseados em dados do aluno.',
        allowedScopes: ['retenção', 'reengajamento'],
        blockedTopics: ['cobrança', 'venda'],
        fallbackResponse: 'Plano não pôde ser gerado automaticamente.',
        active: true,
      },
    ])
    .onConflictDoNothing();

  // Garante que tabelas têm pelo menos um registro
  const counts = {
    courses: await db.select({ n: sqlT<number>`count(*)` }).from(schema.courses),
    aiConfigurations: await db.select({ n: sqlT<number>`count(*)` }).from(schema.aiConfigurations),
  };
  console.log('[seed] OK. Counts:', {
    courses: counts.courses[0]?.n,
    aiConfigurations: counts.aiConfigurations[0]?.n,
  });
}

main().catch((err) => {
  console.error('[seed] falhou:', err);
  process.exit(1);
});
