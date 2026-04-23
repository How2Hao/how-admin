import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseTaskTemplateId } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseTaskTemplateId(event.context.params?.id)
  const [existing] = await db.select({ id: taskTemplate.id }).from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: '模板不存在',
    })
  }

  await db.delete(taskTemplate).where(eq(taskTemplate.id, id))

  return {
    id,
    success: true,
  }
})
