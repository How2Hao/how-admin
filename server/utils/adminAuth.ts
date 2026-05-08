import { randomBytes } from 'node:crypto'
import process from 'node:process'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../db'
import { adminSession, adminUser } from '../../drizzle/schema'

const BCRYPT_ROUNDS = 12
const DEFAULT_SESSION_DAYS = 14

export const ADMIN_SESSION_COOKIE = 'admin_session'

export type AdminUserContext = {
  id: number
  username: string
  displayName: string | null
  avatar: string | null
  role: string
  status: string
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

function sessionDays(): number {
  const raw = Number(process.env.ADMIN_SESSION_DAYS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_DAYS
}

/**
 * Cookie 选项：httpOnly + sameSite=lax + 生产环境 secure。
 * 同源 SPA 自动带 cookie，XSS 读不到 token。
 */
export function adminCookieOptions() {
  const days = sessionDays()
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: days * 24 * 60 * 60,
  }
}

export async function createSession(params: {
  adminUserId: number
  ip?: string | null
  userAgent?: string | null
}): Promise<string> {
  const token = generateSessionToken()
  const now = Date.now()
  const expiresAt = now + sessionDays() * 24 * 60 * 60 * 1000
  await db.insert(adminSession).values({
    adminUserId: params.adminUserId,
    token,
    expiresAt,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    lastUsedAt: now,
    createdAt: now,
  })
  return token
}

export async function revokeSession(token: string): Promise<void> {
  await db
    .update(adminSession)
    .set({ revokedAt: Date.now() })
    .where(and(eq(adminSession.token, token), isNull(adminSession.revokedAt)))
}

/**
 * 校验 token 有效性：未过期、未撤销、对应 admin_user 仍 ACTIVE。
 * 同时刷新 lastUsedAt 用于审计/最近活跃统计。
 */
export async function findActiveSession(token: string): Promise<{ adminUser: AdminUserContext } | null> {
  const now = Date.now()
  const rows = await db
    .select({
      sessionId: adminSession.id,
      userId: adminUser.id,
      username: adminUser.username,
      displayName: adminUser.displayName,
      avatar: adminUser.avatar,
      role: adminUser.role,
      status: adminUser.status,
    })
    .from(adminSession)
    .innerJoin(adminUser, eq(adminSession.adminUserId, adminUser.id))
    .where(and(
      eq(adminSession.token, token),
      gt(adminSession.expiresAt, now),
      isNull(adminSession.revokedAt),
      eq(adminUser.status, 'ACTIVE'),
    ))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  // 异步刷新 lastUsedAt，不 await 以免拖慢响应（失败也无所谓，下一次 hit 会再写）
  db.update(adminSession)
    .set({ lastUsedAt: now })
    .where(eq(adminSession.id, row.sessionId))
    .catch(() => {})

  return {
    adminUser: {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatar: row.avatar,
      role: row.role,
      status: row.status,
    },
  }
}

/**
 * 角色守卫——后续要差异化拦截时调：
 *   if (!hasRole(event.context.adminUser, ['SUPER_ADMIN'])) throw createError(...)
 * 现阶段先准备好 helper，业务 API 暂不调用（所有登录用户共享所有 API）。
 */
export function hasRole(user: AdminUserContext | undefined, allowed: string[]): boolean {
  if (!user) return false
  return allowed.includes(user.role)
}
