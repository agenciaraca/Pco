// Health check agregado para admin. Combina sinais de todos os módulos
// (gateways, e-mail, webhooks, AI, erros recentes, disco) em um único snapshot.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as gatewaysRepo from '../payments/gateways-repo';
import * as emailConfigs from '../notifications/config-store';
import * as emailLogs from '../notifications/log-store';
import * as webhookEndpoints from '../webhooks/endpoints-store';
import * as webhookDeliveries from '../webhooks/delivery-store';
import * as aiConfigs from '../repositories/ai-configs';
import { listErrors } from '../errors/store';
import { hasDb } from '../db/client';

export type HealthStatus = 'ok' | 'warn' | 'error' | 'na';

export interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  message: string;
  metric?: string | number;
}

export interface HealthSnapshot {
  generatedAt: string;
  overall: HealthStatus;
  checks: HealthCheckItem[];
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

export async function buildSnapshot(): Promise<HealthSnapshot> {
  const checks: HealthCheckItem[] = [];

  // 1) Storage backend
  checks.push({
    id: 'storage',
    label: 'Storage',
    status: 'ok',
    message: hasDb() ? 'Postgres conectado' : 'JSON local (DATA_DIR)',
  });

  // 2) Gateways
  try {
    const gws = await gatewaysRepo.listAll();
    const active = gws.filter((g) => g.active);
    checks.push({
      id: 'gateways',
      label: 'Gateways de pagamento',
      status: active.length === 0 ? 'warn' : 'ok',
      message:
        active.length === 0
          ? 'Nenhum gateway ativo — checkout não funciona'
          : `${active.length} ativo(s) de ${gws.length}`,
      metric: active.length,
    });
  } catch (err) {
    checks.push({
      id: 'gateways',
      label: 'Gateways de pagamento',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro ao listar',
    });
  }

  // 3) E-mail config
  try {
    const cfgs = await emailConfigs.listConfigs();
    const active = cfgs.find((c) => c.enabled && c.provider !== 'mock');
    if (!active) {
      checks.push({
        id: 'email',
        label: 'E-mail transacional',
        status: 'warn',
        message:
          cfgs.length === 0
            ? 'Nenhuma configuração — alunos não recebem e-mails'
            : 'Apenas mock ativo (sem provider real)',
      });
    } else {
      checks.push({
        id: 'email',
        label: 'E-mail transacional',
        status: active.lastTestStatus === 'error' ? 'error' : 'ok',
        message: `Provider: ${active.provider}${active.lastTestStatus ? ` · último teste: ${active.lastTestStatus}` : ''}`,
      });
    }
  } catch (err) {
    checks.push({
      id: 'email',
      label: 'E-mail transacional',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro',
    });
  }

  // 4) E-mail entregas recentes (últimas 24h)
  try {
    const logs = await emailLogs.listLogs(500);
    const cutoff = Date.now() - 24 * 60 * 60_000;
    const recent = logs.filter((l) => new Date(l.ts).getTime() >= cutoff);
    const failed = recent.filter((l) => l.status === 'failed').length;
    const sent = recent.filter((l) => l.status === 'sent').length;
    checks.push({
      id: 'email_recent',
      label: 'Envios de e-mail (24h)',
      status: failed > sent ? 'warn' : 'ok',
      message: `${sent} enviados, ${failed} falhos`,
      metric: sent,
    });
  } catch {
    // ignora — pode não existir log ainda
  }

  // 5) Webhooks
  try {
    const eps = await webhookEndpoints.listEndpoints();
    const active = eps.filter((e) => e.enabled);
    const recentFailed = active.filter(
      (e) =>
        e.lastFailureAt &&
        (!e.lastSuccessAt || e.lastFailureAt > e.lastSuccessAt),
    ).length;
    checks.push({
      id: 'webhooks',
      label: 'Webhooks de saída',
      status: recentFailed > 0 ? 'warn' : 'ok',
      message:
        eps.length === 0
          ? 'Nenhum endpoint configurado'
          : `${active.length} ativos${recentFailed > 0 ? `, ${recentFailed} com falha recente` : ''}`,
      metric: active.length,
    });
  } catch (err) {
    checks.push({
      id: 'webhooks',
      label: 'Webhooks de saída',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro',
    });
  }

  // 6) Webhook deliveries recentes
  try {
    const dl = await webhookDeliveries.listAll(200);
    const cutoff = Date.now() - 60 * 60_000;
    const recent = dl.filter((d) => new Date(d.createdAt).getTime() >= cutoff);
    const failed = recent.filter((d) => d.status === 'failed').length;
    const success = recent.filter((d) => d.status === 'success').length;
    checks.push({
      id: 'webhook_deliveries',
      label: 'Entregas webhook (1h)',
      status: failed > 0 && failed >= success ? 'warn' : 'ok',
      message: `${success} ok, ${failed} falhas`,
      metric: success,
    });
  } catch {
    // ignora
  }

  // 7) AI providers
  try {
    const configs = await aiConfigs.listConfigs();
    const active = configs.filter((c) => c.active);
    checks.push({
      id: 'ai',
      label: 'IAs',
      status: active.length === 0 ? 'warn' : 'ok',
      message:
        active.length === 0
          ? 'Nenhuma IA habilitada — Tutor não responde'
          : `${active.length} habilitada(s) de ${configs.length}`,
      metric: active.length,
    });
  } catch (err) {
    checks.push({
      id: 'ai',
      label: 'IAs',
      status: 'error',
      message: err instanceof Error ? err.message : 'Erro',
    });
  }

  // 8) Erros do servidor (últimas 24h)
  try {
    const errs = await listErrors({ limit: 500 });
    const cutoff = Date.now() - 24 * 60 * 60_000;
    const recent = errs.filter((e) => new Date(e.ts).getTime() >= cutoff);
    checks.push({
      id: 'errors',
      label: 'Erros 5xx (24h)',
      status: recent.length > 50 ? 'error' : recent.length > 10 ? 'warn' : 'ok',
      message: `${recent.length} ocorrências`,
      metric: recent.length,
    });
  } catch {
    // ignora
  }

  // 9) Disk usage (data dir)
  try {
    const usage = await diskUsage(DATA_DIR);
    checks.push({
      id: 'disk',
      label: 'Disco (data/)',
      status: usage > 1024 * 1024 * 1024 ? 'warn' : 'ok',
      message: formatBytes(usage),
      metric: usage,
    });
  } catch {
    // ignora
  }

  const overall: HealthStatus = checks.some((c) => c.status === 'error')
    ? 'error'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'ok';

  return {
    generatedAt: new Date().toISOString(),
    overall,
    checks,
  };
}

async function diskUsage(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += await diskUsage(full);
      } else if (e.isFile()) {
        const st = await fs.stat(full);
        total += st.size;
      }
    }
  } catch {
    // ignora dirs sem permissão
  }
  return total;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
