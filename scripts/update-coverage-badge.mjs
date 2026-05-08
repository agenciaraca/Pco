#!/usr/bin/env node
// Atualiza o badge de coverage no README a partir de coverage/coverage-summary.json.
//
// Uso:
//   npm run test:coverage    # gera coverage/coverage-summary.json
//   node scripts/update-coverage-badge.mjs
//
// Lê pct de statements e reescreve a linha:
//   ![Coverage](https://img.shields.io/badge/coverage-XX%25-color)
//
// Cor: >=80 brightgreen, >=70 green, >=60 yellowgreen, >=50 yellow, >=40 orange, else red.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SUMMARY = path.join(ROOT, 'coverage', 'coverage-summary.json');
const README = path.join(ROOT, 'README.md');

const BADGE_LINE_RE = /^!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[^)]+\)$/m;
const TESTS_BADGE_LINE_RE = /^!\[Tests\]\([^)]+\)$/m;

export function colorForPct(pct) {
  if (pct >= 80) return 'brightgreen';
  if (pct >= 70) return 'green';
  if (pct >= 60) return 'yellowgreen';
  if (pct >= 50) return 'yellow';
  if (pct >= 40) return 'orange';
  return 'red';
}

export function buildBadge(pct) {
  const rounded = Math.round(pct);
  const color = colorForPct(pct);
  return `![Coverage](https://img.shields.io/badge/coverage-${rounded}%25-${color})`;
}

export function applyBadge(readme, pct) {
  const badge = buildBadge(pct);
  if (BADGE_LINE_RE.test(readme)) {
    return readme.replace(BADGE_LINE_RE, badge);
  }
  // Insert after the Tests badge line if present, else after first line.
  if (TESTS_BADGE_LINE_RE.test(readme)) {
    return readme.replace(TESTS_BADGE_LINE_RE, (m) => `${m}\n${badge}`);
  }
  const lines = readme.split('\n');
  lines.splice(1, 0, badge);
  return lines.join('\n');
}

export function readPct(summary) {
  const totalPct = summary?.total?.statements?.pct;
  if (typeof totalPct !== 'number' || Number.isNaN(totalPct)) {
    throw new Error('coverage-summary.json sem total.statements.pct numérico');
  }
  return totalPct;
}

async function main() {
  if (!existsSync(SUMMARY)) {
    console.error(
      `[coverage-badge] coverage-summary.json não encontrado em ${SUMMARY}.\n` +
        `Rode \`npm run test:coverage\` antes.`,
    );
    process.exit(1);
  }
  const raw = await readFile(SUMMARY, 'utf8');
  const summary = JSON.parse(raw);
  const pct = readPct(summary);

  const readme = await readFile(README, 'utf8');
  const next = applyBadge(readme, pct);

  if (next === readme) {
    console.log(`[coverage-badge] coverage = ${pct.toFixed(2)}% — README já atualizado.`);
    return;
  }
  await writeFile(README, next, 'utf8');
  console.log(`[coverage-badge] coverage = ${pct.toFixed(2)}% — README atualizado.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
