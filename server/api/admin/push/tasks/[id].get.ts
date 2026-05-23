import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTask } from '../../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'task id 不合法' })

  const [row] = await db.select().from(pushTask).where(eq(pushTask.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'task 不存在' })

  return row
})
