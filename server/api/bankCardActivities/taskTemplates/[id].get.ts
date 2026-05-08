import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseTaskTemplateId, toTaskTemplateDetail } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseTaskTemplateId(event.context.params?.id)

  const [row] = await db.select().from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: '模板不存在',
    })
  }

  return toTaskTemplateDetail(row)
})
