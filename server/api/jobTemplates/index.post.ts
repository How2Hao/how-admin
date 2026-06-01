import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { getJobTemplateSchema, toJobTemplateMutation } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  // 经过 admin-auth middleware 后 event.context.adminUser 必有值；fallback 1 兜底
  const adminUserId = event.context.adminUser?.id ?? 1
  const body = await event.req.json()
  const parsed = getJobTemplateSchema().safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [created] = await db.insert(jobTemplate).values({
    ...toJobTemplateMutation(parsed.data),
    adminUserId,
    createdAt: Date.now(),
  }).$returningId()
  const id = Number((created as { id: number }).id)

  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  return row
})
