// Rotaciona app.log quando ultrapassa MAX_SIZE. Mantém N rotações compactadas.
// Worker tick-baseado (a cada 1h verifica).
//
// Cria app.log.1.gz, app.log.2.gz, ... até app.log.MAX_ROTATIONS.gz
// O processo principal continua escrevendo no app.log original (truncado).

import { promises as fs } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { novoRegistro, comRegistro } from '../jobs/registro-de-tick';

const LOG_PATH = process.env.APP_LOG_PATH ?? path.resolve(process.env.HOME ?? '.', 'ava-pco/app.log');
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROTATIONS = 4;

let interval: NodeJS.Timeout | null = null;
let lastRotatedAt: string | null = null;
let totalRotations = 0;

/**
 * O arquivo que este worker deveria vigiar existe?
 *
 * `null` até o primeiro ciclo — ainda não olhou. Depois `true`/`false`.
 *
 * Isto existe porque `rotateIfNeeded` devolvia `false` nos DOIS casos: "não
 * precisou rotacionar" e "o arquivo nem existe". Achatados, o segundo passava
 * por saúde — o worker rodava, contava e reportava sucesso vigiando o nada.
 *
 * Não é hipótese. Medido em produção em 9/set/2026: o alvo é
 * `~/ava-pco/app.log`, parado desde 24/jul, enquanto o log vivo da aplicação é
 * `~/.pm2/logs/ava-pco-out.log`, que cresce e não tem rotação nenhuma
 * (`pm2-logrotate` não está instalado). O worker existe para que o disco cheio
 * não derrube a aplicação, e estava olhando para o arquivo errado desde que o
 * PM2 assumiu.
 */
let alvoExiste: boolean | null = null;

/**
 * Quando o alvo recebeu a última linha. `null` = ainda não olhou, ou não há
 * arquivo.
 *
 * **Este é o caso que de fato acontece**, e o que a primeira versão desta
 * correção não pegava: em produção o alvo EXISTE — `~/ava-pco/app.log`, 918 kB
 * — e está parado desde 24/jul/2026, porque desde que o PM2 assumiu o processo
 * o log vivo é `~/.pm2/logs/ava-pco-out.log`. Um arquivo ausente é fácil de
 * ver; um arquivo morto tem tamanho, data e cara de log, e o worker o vigia
 * para sempre sem nunca ter nada a fazer.
 */
let alvoParadoDesde: string | null = null;

async function rotateIfNeeded(): Promise<boolean> {
  let stat;
  try {
    stat = await fs.stat(LOG_PATH);
    alvoExiste = true;
    alvoParadoDesde = stat.mtime.toISOString();
  } catch {
    // O arquivo não existe. **Não é "não precisou rotacionar"** — é não ter o
    // que vigiar, e quem lê o painel precisa saber a diferença.
    alvoExiste = false;
    alvoParadoDesde = null;
    return false;
  }
  if (stat.size < MAX_SIZE_BYTES) return false;

  // Shift rotations: app.log.3.gz → app.log.4.gz, app.log.2.gz → 3.gz, etc.
  for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
    const src = `${LOG_PATH}.${i}.gz`;
    const dst = `${LOG_PATH}.${i + 1}.gz`;
    try {
      await fs.rename(src, dst);
    } catch {
      /* file doesn't exist, skip */
    }
  }

  // Lê o log atual, gzipa pra .1.gz, trunca o original
  const content = await fs.readFile(LOG_PATH);
  await fs.writeFile(`${LOG_PATH}.1.gz`, gzipSync(content));
  await fs.writeFile(LOG_PATH, '');

  // Remove a rotação mais antiga se passou do limite
  for (let i = MAX_ROTATIONS + 1; i <= 10; i++) {
    try {
      await fs.unlink(`${LOG_PATH}.${i}.gz`);
    } catch {
      break;
    }
  }

  lastRotatedAt = new Date().toISOString();
  totalRotations++;
  return true;
}

/**
 * Saúde do ciclo. A rotação falhando em silêncio deixa o log crescer sem teto —
 * e o disco cheio derruba a app inteira, não só o log.
 */
const registro = novoRegistro();

export function startWorker(intervalMs = 60 * 60_000): void {
  if (interval) return;
  // Tick imediato após 5min (após boot estabilizar)
  setTimeout(() => {
    void comRegistro(registro, rotateIfNeeded, 'log-rotator');
  }, 5 * 60_000);
  interval = setInterval(() => {
    void comRegistro(registro, rotateIfNeeded, 'log-rotator');
  }, intervalMs);
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function getStatus() {
  return {
    name: 'log-rotator',
    enabled: interval !== null,
    ...registro,
    lastRotatedAt,
    totalRotations,
    logPath: LOG_PATH,
    /** `null` = ainda não olhou. `false` = está vigiando um caminho que não existe. */
    alvoExiste,
    /** Última escrita no alvo. Parado há muito significa que a app não escreve mais ali. */
    alvoParadoDesde,
    maxSizeBytes: MAX_SIZE_BYTES,
    maxRotations: MAX_ROTATIONS,
  };
}

/**
 * Só para teste: devolve o worker ao estado de quem ainda não olhou.
 *
 * O módulo guarda estado no fechamento, e os casos precisam distinguir
 * "não olhou" de "olhou e não achou" — que é justamente a diferença que este
 * arquivo passou a fazer.
 */
export function _resetParaTeste(): void {
  alvoExiste = null;
  alvoParadoDesde = null;
  lastRotatedAt = null;
  totalRotations = 0;
}
