/**
 * 通用手动 migration 执行器：从 drizzle/manual/<file>.sql 读取 SQL 并执行。
 *
 * 用法（在 how-admin 目录）：
 *   pnpm dlx tsx scripts/run-manual-migration.ts drizzle/manual/0002_add_quota_description.sql
 *
 * 行为：
 *   - 按 ; 拆分语句逐条执行（注释行 -- 自动跳过）
 *   - 每条语句执行前先 echo
 *   - 失败立即抛出（不部分提交）
 */
import process from 'node:process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: tsx scripts/run-manual-migration.ts <path/to/file.sql>')
  process.exit(1)
}

async function main() {
  const fullPath = path.resolve(process.cwd(), sqlFile)
  const raw = await readFile(fullPath, 'utf8')

  // 去掉行注释 -- ...，按 ; 拆语句
  const stripped = raw
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (statements.length === 0) {
    console.error('[migration] no statements to execute')
    return
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('[migration] DATABASE_URL not set')
    process.exit(1)
  }

  // 脱敏显示连接目标
  const masked = url.replace(/:[^:@/]+@/, ':****@')
  console.log(`[migration] target: ${masked}`)
  console.log(`[migration] file:   ${fullPath}`)
  console.log(`[migration] ${statements.length} statement(s) to run\n`)

  const conn = await mysql.createConnection(url)
  try {
    for (const [idx, stmt] of statements.entries()) {
      console.log(`[migration] (${idx + 1}/${statements.length}) ${stmt.slice(0, 200)}${stmt.length > 200 ? '...' : ''}`)
      const result = await conn.query(stmt)
      console.log(`[migration]   → OK (info: ${JSON.stringify((result[0] as any)?.info ?? 'no info')})\n`)
    }
    console.log('[migration] ALL DONE ✓')
  }
  finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('[migration] FAILED:', e?.message ?? e)
  process.exit(1)
})
