import { desc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushUserTag, users } from '../../../../../../drizzle/schema'

/**
 * 列出某标签下的所有用户
 */
export default defineHandler(async (event) => {
  const tagId = Number(event.context.params?.id)
  if (!Number.isInteger(tagId) || tagId <= 0)
    throw createError({ statusCode: 400, statusMessage: 'tag id 不合法' })

  const rows = await db
    .select({
      bindingId: pushUserTag.id,
      userId: pushUserTag.userId,
      username: users.username,
      uid6: users.uid6,
      phone: users.phone,
      avatar: users.avatar,
      createdAt: pushUserTag.createdAt,
    })
    .from(pushUserTag)
    .leftJoin(users, eq(users.id, pushUserTag.userId))
    .where(eq(pushUserTag.tagId, tagId))
    .orderBy(desc(pushUserTag.createdAt))
    .limit(1000)

  return { list: rows, total: rows.length }
})
