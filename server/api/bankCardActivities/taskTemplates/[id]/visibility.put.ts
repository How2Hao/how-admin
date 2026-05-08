import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { taskTemplate } from '../../../../../drizzle/schema'

interface Payload {
  isVisible: boolean | 0 | 1
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body || body.isVisible === undefined)
    throw createError({ statusCode: 400, statusMessage: '缺少 isVisible 字段' })

  const [existing] = await db
    .select({ id: taskTemplate.id })
    .from(taskTemplate)
    .where(eq(taskTemplate.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })

  const value = body.isVisible ? 1 : 0
  try {
    await db.update(taskTemplate).set({ isVisible: value }).where(eq(taskTemplate.id, id))
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
  }

  return { id, isVisible: value }
})
