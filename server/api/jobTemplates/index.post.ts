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

  // 用 mysql2 ResultSetHeader.insertId 取自增 id（对齐本库 usagePlatforms 写法）；
  // $returningId() 在当前 drizzle-orm/mysql2 组合下返回空数组，故不用。
  const result = await db.insert(jobTemplate).values({
    ...toJobTemplateMutation(parsed.data),
    adminUserId,
    createdAt: Date.now(),
  })
  const id = Number((result as unknown as [{ insertId: number }])[0].insertId)

  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  return row
})
