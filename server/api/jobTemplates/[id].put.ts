import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { getJobTemplateSchema, parseJobTemplateId, toJobTemplateMutation } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseJobTemplateId(event.context.params?.id)
  const body = await event.req.json()
  const parsed = getJobTemplateSchema().safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [existing] = await db.select({ id: jobTemplate.id })
    .from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })
  }

  await db.update(jobTemplate).set({
    ...toJobTemplateMutation(parsed.data),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(jobTemplate.id, id))

  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  return row
})
