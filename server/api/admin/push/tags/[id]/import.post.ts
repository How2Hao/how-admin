import { eq, sql } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTag, pushUserTag, users } from '../../../../../../drizzle/schema'

interface Payload {
  /** append = 追加（保留已有成员）；replace = 覆盖（先清空再插入）*/
  mode: 'append' | 'replace'
  /** 解析后的 user_id 数组，前端粘贴文本/CSV 解析后传过来 */
  userIds: number[]
}

/**
 * 批量导入用户到标签
 * - replace: 先 DELETE 整张 (tag_id, *) 再 INSERT
 * - append: 直接 INSERT IGNORE
 * - 自动跳过不存在的 user_id（关联 users 校验）
 * - 完成后刷新 push_tag.user_count
 */
export default defineHandler(async (event) => {
  const tagId = Number(event.context.params?.id)
  if (!Number.isInteger(tagId) || tagId <= 0)
    throw createError({ statusCode: 400, statusMessage: 'tag id 不合法' })

  const body = await readBody<Payload>(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const mode = body.mode === 'replace' ? 'replace' : 'append'
  const rawIds = Array.from(new Set((body.userIds ?? []).filter(u => Number.isInteger(u) && u > 0)))
  if (rawIds.length === 0)
    throw createError({ statusCode: 400, statusMessage: 'userIds 为空' })
  if (rawIds.length > 100_000)
    throw createError({ statusCode: 400, statusMessage: '单次导入 ≤ 10 万' })

  const [tag] = await db.select().from(pushTag).where(eq(pushTag.id, tagId)).limit(1)
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'tag 不存在' })

  // 校验：只保留 users 表里真实存在的 id
  const validIds: number[] = []
  for (let i = 0; i < rawIds.length; i += 1000) {
    const slice = rawIds.slice(i, i + 1000)
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(slice.map(v => sql`${v}`), sql`, `)})`)
    for (const r of rows) validIds.push(r.id)
  }
  const skippedCount = rawIds.length - validIds.length

  const now = Date.now()

  if (mode === 'replace') {
    await db.delete(pushUserTag).where(eq(pushUserTag.tagId, tagId))
  }

  // 分批 INSERT IGNORE（drizzle 没有这语法糖，走原生）
  let insertedTotal = 0
  for (let i = 0; i < validIds.length; i += 1000) {
    const slice = validIds.slice(i, i + 1000)
    const valuesSql = sql.join(
      slice.map(uid => sql`(${uid}, ${tagId}, ${now})`),
      sql`, `,
    )
    const result = await db.execute(sql`
      INSERT IGNORE INTO push_user_tag (user_id, tag_id, created_at)
      VALUES ${valuesSql}
    `) as any
    insertedTotal += Number(result?.affectedRows ?? 0)
  }

  // 刷新 user_count
  const countRows = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(pushUserTag)
    .where(eq(pushUserTag.tagId, tagId))
  const userCount = Number(countRows[0]?.cnt ?? 0)
  await db.update(pushTag).set({ userCount, updatedAt: now }).where(eq(pushTag.id, tagId))

  return {
    tagId,
    mode,
    requested: rawIds.length,
    valid: validIds.length,
    inserted: insertedTotal,
    skipped: skippedCount,
    userCount,
  }
})
