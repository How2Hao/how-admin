import { eq, sql } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTag, pushUserTag } from '../../../../../../drizzle/schema'

interface Payload {
  userIds: number[]
}

/**
 * 给标签批量添加用户（追加模式，已存在的 (user_id, tag_id) 跳过）
 * 同时刷新 pushTag.user_count
 */
export default defineHandler(async (event) => {
  const tagId = Number(event.context.params?.id)
  if (!Number.isInteger(tagId) || tagId <= 0)
    throw createError({ statusCode: 400, statusMessage: 'tag id 不合法' })

  const body = await readBody<Payload>(event)
  const userIds = Array.from(new Set((body?.userIds ?? []).filter(u => Number.isInteger(u) && u > 0)))
  if (userIds.length === 0)
    throw createError({ statusCode: 400, statusMessage: 'userIds 不能为空' })

  const [tag] = await db.select().from(pushTag).where(eq(pushTag.id, tagId)).limit(1)
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'tag 不存在' })

  const now = Date.now()

  // INSERT IGNORE 跳过已存在的 (user_id, tag_id)。drizzle 没有这个语法糖，走原生
  const valuesSql = sql.join(
    userIds.map(uid => sql`(${uid}, ${tagId}, ${now})`),
    sql`, `,
  )
  await db.execute(sql`
    INSERT IGNORE INTO push_user_tag (user_id, tag_id, created_at)
    VALUES ${valuesSql}
  `)

  // 重新统计 user_count 并写回
  const countRows = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(pushUserTag)
    .where(eq(pushUserTag.tagId, tagId))
  const userCount = Number(countRows[0]?.cnt ?? 0)
  await db.update(pushTag).set({ userCount, updatedAt: now }).where(eq(pushTag.id, tagId))

  return { tagId, added: userIds.length, userCount }
})
