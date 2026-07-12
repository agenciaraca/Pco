// Auditoria SOMENTE-LEITURA: compara server/db/schema.ts com o banco real (DivZ).
// Não escreve nada. Uso: DATABASE_URL=... npx tsx <este arquivo>
import 'dotenv/config'
import { Client } from 'pg'
import { getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from '../server/db/schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL ausente')

const clean = url.replace(/[?&](sslmode|channel_binding)=[^&]*/g, '')

async function main() {
  const client = new Client({ connectionString: clean, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const { rows } = await client.query<{ table_name: string; column_name: string; data_type: string }>(
    `select table_name, column_name, data_type
       from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position`,
  )

  const db = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!db.has(r.table_name)) db.set(r.table_name, new Set())
    db.get(r.table_name)!.add(r.column_name)
  }

  const code = new Map<string, Set<string>>()
  for (const value of Object.values(schema)) {
    let cfg
    try {
      cfg = getTableConfig(value as never)
    } catch {
      continue
    }
    code.set(cfg.name, new Set(cfg.columns.map((c) => c.name)))
  }

  const missingTables: string[] = []
  const extraTables: string[] = []
  const missingCols: string[] = []
  const extraCols: string[] = []

  for (const [t, cols] of code) {
    if (!db.has(t)) {
      missingTables.push(t)
      continue
    }
    const dbCols = db.get(t)!
    for (const c of cols) if (!dbCols.has(c)) missingCols.push(`${t}.${c}`)
    for (const c of dbCols) if (!cols.has(c)) extraCols.push(`${t}.${c}`)
  }
  for (const t of db.keys()) if (!code.has(t) && !t.startsWith('__drizzle')) extraTables.push(t)

  const line = (label: string, items: string[]) => {
    console.log(`\n${label} (${items.length})`)
    if (items.length === 0) console.log('  — nenhum')
    else for (const i of items) console.log(`  - ${i}`)
  }

  console.log(`Tabelas no código: ${code.size} | no banco: ${db.size}`)
  line('FALTAM NO BANCO (quebram em runtime)', [...missingTables.map((t) => `TABELA ${t}`), ...missingCols])
  line('EXISTEM SÓ NO BANCO (legado / não mapeado)', [...extraTables.map((t) => `TABELA ${t}`), ...extraCols])

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
