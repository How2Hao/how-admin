import { eq } from 'drizzle-orm'
import { createError, getHeader, getRequestIP, readBody, setCookie } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { adminUser } from '../../../../drizzle/schema'
import { ADMIN_SESSION_COOKIE, adminCookieOptions, createSession, verifyPassword } from '~~/utils/adminAuth'

interface LoginPayload {
  username?: string
  password?: string
}

export default defineHandler(async (event) => {
  const body = await readBody<LoginPayload>(event)
  const username = (body?.username ?? '').trim()
  const password = body?.password ?? ''

  if (!username || username.length > 64) {
    throw createError({ statusCode: 400, statusMessage: '用户名不合法' })
  }
  if (!password || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '密码长度至少 8 位' })
  }

  // 查 admin_user。出于防枚举攻击考虑，"用户不存在"和"密码错"返回同样错误信息
  const [row] = await db
    .select({
      id: adminUser.id,
      username: adminUser.username,
      passwordHash: adminUser.passwordHash,
      displayName: adminUser.displayName,
      avatar: adminUser.avatar,
      role: adminUser.role,
      status: adminUser.status,
    })
    .from(adminUser)
    .where(eq(adminUser.username, username))
    .limit(1)

  const ok = row && row.status === 'ACTIVE'
    ? await verifyPassword(password, row.passwordHash)
    : false

  if (!ok || !row) {
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  }

  // 创建 session 并 set-cookie
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null
  const userAgent = getHeader(event, 'user-agent') ?? null
  const token = await createSession({ adminUserId: row.id, ip, userAgent })
  setCookie(event, ADMIN_SESSION_COOKIE, token, adminCookieOptions())

  // 更新 lastLoginAt
  await db
    .update(adminUser)
    .set({ lastLoginAt: Date.now(), updatedAt: Date.now() })
    .where(eq(adminUser.id, row.id))

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    role: row.role,
  }
})
