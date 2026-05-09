import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankCardTemplate } from '../../../../drizzle/schema'

interface Payload {
  is_visible?: 0 | 1 | boolean
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })
  }
  const body = await readBody<Payload>(event)
  if (!body || body.is_visible === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'is_visible 不能为空' })
  }
  const v = body.is_visible
  if (v !== 0 && v !== 1 && typeof v !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'is_visible 必须为 0、1 或 boolean' })
  }
  const next = v === 1 || v === true ? 1 : 0

  const [existing] = await db
    .select({ id: bankCardTemplate.id })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  }

  await db
    .update(bankCardTemplate)
    .set({ isVisible: next, updatedAt: Date.now() })
    .where(eq(bankCardTemplate.id, id))

  return { id, isVisible: next, success: true }
})
