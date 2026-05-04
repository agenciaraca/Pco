// Ring buffer in-memory das últimas linhas de console.log/warn/error.
// Útil para o admin inspecionar o que aconteceu sem precisar de SSH no servidor.
//
// Em produção a fonte canônica de logs deve ser journalctl/Sentry. Este buffer
// é só uma janela rápida (últimos N).

const MAX_LINES = 5000;

export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

export interface LogLine {
  ts: string;
  level: LogLevel;
  message: string;
}

const buffer: LogLine[] = [];
let installed = false;

function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 5000);
}

function push(level: LogLevel, args: unknown[]): void {
  buffer.push({ ts: new Date().toISOString(), level, message: format(args) });
  if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
}

export function installConsoleCapture(): void {
  if (installed) return;
  installed = true;

  const orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  console.log = (...args) => {
    push('log', args);
    orig.log.apply(console, args);
  };
  console.warn = (...args) => {
    push('warn', args);
    orig.warn.apply(console, args);
  };
  console.error = (...args) => {
    push('error', args);
    orig.error.apply(console, args);
  };
  console.info = (...args) => {
    push('info', args);
    orig.info.apply(console, args);
  };
  console.debug = (...args) => {
    push('debug', args);
    orig.debug.apply(console, args);
  };
}

export interface LogQuery {
  level?: LogLevel;
  q?: string;
  limit?: number;
}

export function query(opts: LogQuery = {}): LogLine[] {
  let r = buffer;
  if (opts.level) r = r.filter((l) => l.level === opts.level);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    r = r.filter((l) => l.message.toLowerCase().includes(q));
  }
  // mais recentes primeiro
  return [...r]
    .reverse()
    .slice(0, Math.max(1, Math.min(opts.limit ?? 500, MAX_LINES)));
}

export function size(): number {
  return buffer.length;
}
