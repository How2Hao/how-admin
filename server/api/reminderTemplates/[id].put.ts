import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { getReminderTemplateSchema, parseReminderTemplateId, toReminderTemplateMutation } from '~~/utils/reminderTemplate'
import { reminderTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseReminderTemplateId(event.context.params?.id)
  const body = await event.req.json()
  const parsed = getReminderTemplateSchema().safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [existing] = await db.select({ id: reminderTemplate.id })
    .from(reminderTemplate)
    .where(eq(reminderTemplate.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '提醒模板不存在' })
  }

  await db.update(reminderTemplate).set({
    ...toReminderTemplateMutation(parsed.data),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(reminderTemplate.id, id))

  const [row] = await db.select().from(reminderTemplate).where(eq(reminderTemplate.id, id)).limit(1)
  return row
})
