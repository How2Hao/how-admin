import { desc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { appReleaseDraft } from '../../../drizzle/schema'

// 草稿箱列表（仅 how-admin 使用，ha/hi 不读本表）
export default defineHandler(async () => {
  const list = await db
    .select()
    .from(appReleaseDraft)
    .orderBy(desc(appReleaseDraft.updatedAt))
  return { list }
})
