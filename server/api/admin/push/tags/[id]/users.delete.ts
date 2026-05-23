import { and, eq, inArray, sql } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTag, pushUserTag } from '../../../../../../drizzle/schema'

interface Payload {
  userIds: number[]
}

/**
 * 从标签批量移除用户，同时刷新 pushTag.user_count
 */
export default defineHandler(async (event) => {
  const tagId = Number(event.context.params?.id)
  if (!Number.isInteger(tagId) || tagId <= 0)
    throw createError({ statusCode: 400, statusMessage: 'tag id 不合法' })

  const body = await readBody<Payload>(event)
  const userIds = (body?.userIds ?? []).filter(u => Number.isInteger(u) && u > 0)
  if (userIds.length === 0)
    throw createError({ statusCode: 400, statusMessage: 'userIds 不能为空' })

  const result = await db.delete(pushUserTag)
    .where(and(eq(pushUserTag.tagId, tagId), inArray(pushUserTag.userId, userIds))) as any

  // 重算 user_count
  const countRows = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(pushUserTag)
    .where(eq(pushUserTag.tagId, tagId))
  const userCount = Number(countRows[0]?.cnt ?? 0)
  await db.update(pushTag).set({ userCount, updatedAt: Date.now() }).where(eq(pushTag.id, tagId))

  return { tagId, removed: Number(result?.affectedRows ?? userIds.length), userCount }
})
