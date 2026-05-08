/**
 * 一次性 seed：创建首个管理员账号。
 *
 * 用法：在 .env 设置后跑（在 how-admin 目录）
 *   BOOTSTRAP_ADMIN_USERNAME=admin
 *   BOOTSTRAP_ADMIN_PASSWORD=<至少 8 位>
 *   BOOTSTRAP_ADMIN_DISPLAY_NAME=Super Admin       # 可选
 *   BOOTSTRAP_ADMIN_ROLE=SUPER_ADMIN               # 可选，默认 SUPER_ADMIN
 *
 *   pnpm dlx tsx scripts/seed-admin.ts
 *
 * 行为：
 *   - 同 username 已存在 → 跳过（**不覆盖**密码 / role / status）
 *   - 不存在 → 插入新行（status=ACTIVE）
 *   - 可重跑幂等
 *
 * seed 完成后建议从 .env 删除 BOOTSTRAP_* 变量（敏感）。
 */
import process from 'node:process'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../drizzle/schema'
import 'dotenv/config'

const { adminUser } = schema

const username = (process.env.BOOTSTRAP_ADMIN_USERNAME ?? '').trim()
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''
const displayName = (process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? '').trim() || null
const avatar = (process.env.BOOTSTRAP_ADMIN_AVATAR ?? '').trim() || null
const role = (process.env.BOOTSTRAP_ADMIN_ROLE ?? 'SUPER_ADMIN').trim()

if (!username) {
  console.error('[seed-admin] BOOTSTRAP_ADMIN_USERNAME is required')
  process.exit(1)
}
if (!password || password.length < 8) {
  console.error('[seed-admin] BOOTSTRAP_ADMIN_PASSWORD is required (>= 8 chars)')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[seed-admin] DATABASE_URL not set')
  process.exit(1)
}

async function main() {
  const masked = url!.replace(/:[^:@/]+@/, ':****@')
  console.log(`[seed-admin] target: ${masked}`)
  console.log(`[seed-admin] username: ${username}, role: ${role}`)

  const conn = await mysql.createPool({ uri: url })
  const db = drizzle(conn, { schema, mode: 'default' })

  try {
    const [existing] = await db
      .select({ id: adminUser.id, username: adminUser.username })
      .from(adminUser)
      .where(eq(adminUser.username, username))
      .limit(1)

    if (existing) {
      console.log(`[seed-admin] already exists (id=${existing.id}), skipping (no overwrite)`)
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const now = Date.now()

    await db.insert(adminUser).values({
      username,
      passwordHash,
      displayName,
      avatar,
      role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    })

    console.log(`[seed-admin] CREATED username=${username} role=${role} ✓`)
    console.log('[seed-admin] 提示：建议从 .env 删除 BOOTSTRAP_ADMIN_* 变量')
  }
  finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('[seed-admin] FAILED:', e?.message ?? e)
  process.exit(1)
})
