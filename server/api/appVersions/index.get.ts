import { desc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { appRelease } from '../../../drizzle/schema'

// 返回全部版本（含草稿），按 id DESC（最新在前）。admin 端需要看到草稿与已发布。
export default defineHandler(async () => {
  const list = await db
    .select()
    .from(appRelease)
    .orderBy(desc(appRelease.id))
  return { list }
})
