import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTag, pushUserTag } from '../../../../../drizzle/schema'

/**
 * 删除标签：硬删除 push_tag + 清空成员关联
 * 软删字段（is_archived）已移除，简化为直接 DELETE
 */
export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'tag id 不合法' })

  await db.delete(pushUserTag).where(eq(pushUserTag.tagId, id))
  await db.delete(pushTag).where(eq(pushTag.id, id))
  return { id, deleted: true }
})
