import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { getBankTaskCreateSchema } from '~~/utils/bankCardActivityForm'
import { parseTaskTemplateId, toTaskTemplateMutation } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  await referenceData.ensureInitialized()
  const id = parseTaskTemplateId(event.context.params?.id)
  const body = await event.req.json()
  const parsed = getBankTaskCreateSchema().safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [existing] = await db.select({ id: taskTemplate.id }).from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: '模板不存在',
    })
  }

  const payload = parsed.data

  await db.update(taskTemplate).set({
    ...toTaskTemplateMutation(payload),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(taskTemplate.id, id))

  return {
    id,
    title: payload.title,
  }
})
