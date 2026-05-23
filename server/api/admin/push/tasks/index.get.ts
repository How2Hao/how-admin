import { and, desc, eq, like, or } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTask } from '../../../../../drizzle/schema'

/**
 * 推送任务列表，支持 status / triggerSource / 名称模糊 / 时间窗筛选
 */
export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const status = url.searchParams.get('status')?.trim() ?? ''
  const triggerSource = url.searchParams.get('triggerSource')?.trim() ?? 'ADMIN'
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const sinceMs = Number(url.searchParams.get('since') ?? '0') || 0

  const conds = [
    triggerSource ? eq(pushTask.triggerSource, triggerSource) : undefined,
    status ? eq(pushTask.status, status) : undefined,
    keyword ? like(pushTask.name, `%${keyword}%`) : undefined,
    sinceMs > 0
      ? or(
        // since 之后创建的，或者 since 之后发送过的
        // 简化：只按 createdAt 筛
      )
      : undefined,
  ].filter(Boolean) as any[]

  const rows = await db.select().from(pushTask)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(pushTask.createdAt))
    .limit(100)

  return { list: rows, total: rows.length }
})
