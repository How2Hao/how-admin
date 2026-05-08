import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { userFeedback } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '反馈 ID 不合法' })
  }

  const [existing] = await db
    .select({ id: userFeedback.id })
    .from(userFeedback)
    .where(eq(userFeedback.id, id))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '反馈不存在' })
  }

  await db.delete(userFeedback).where(eq(userFeedback.id, id))

  return { id, success: true }
})
