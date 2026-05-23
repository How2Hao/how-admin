import { desc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTag } from '../../../../../drizzle/schema'

/**
 * 标签列表（包含缓存的 user_count）
 * user_count 在每次导入用户时更新，列表场景直接读缓存
 */
export default defineHandler(async () => {
  const tags = await db.select().from(pushTag).orderBy(desc(pushTag.createdAt))
  return {
    list: tags,
    total: tags.length,
  }
})
