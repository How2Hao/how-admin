import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTag } from '../../../../../drizzle/schema'

interface Payload {
  code: string
  name: string
  description?: string | null
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const code = body.code?.trim().toUpperCase()
  if (!code || !/^[A-Z0-9_]+$/.test(code))
    throw createError({ statusCode: 400, statusMessage: 'code 只允许大写字母、数字、下划线' })
  const name = body.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: '名称不能为空' })

  const [existing] = await db.select({ id: pushTag.id }).from(pushTag).where(eq(pushTag.code, code)).limit(1)
  if (existing) throw createError({ statusCode: 409, statusMessage: `code "${code}" 已存在` })

  const now = Date.now()
  const adminUserId = (event.context.adminUser as any)?.id ?? null

  const [res] = await db.insert(pushTag).values({
    code,
    name,
    description: body.description?.trim() || null,
    userCount: 0,
    createdByAdminId: adminUserId,
    createdAt: now,
    updatedAt: now,
  } as any)
  const newId = (res as any)?.insertId as number

  return { id: newId, code, name, userCount: 0 }
})
