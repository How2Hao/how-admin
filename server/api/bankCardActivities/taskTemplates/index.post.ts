import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankTaskCreateSchema } from '~~/utils/bankCardActivityForm'
import { toTaskTemplateMutation } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const body = await event.req.json()
  const parsed = bankTaskCreateSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const payload = parsed.data
  const [created] = await db.insert(taskTemplate).values({
    ...toTaskTemplateMutation(payload),
    highPriority: 0,
    isCompleted: 0,
    status: 'PENDING',
    publisher: null,
    publishTime: null,
    likes: 0,
    addCount: 0,
    createdAt: Date.now(),
  }).$returningId()

  return {
    id: Number((created as { id: number }).id),
    title: payload.title,
  }
})
