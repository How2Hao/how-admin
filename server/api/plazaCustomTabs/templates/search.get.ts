import { and, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm'
import { getQuery } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { activityCategory, bank, taskTemplate } from '../../../../drizzle/schema'

/** 选择活动用的富字段：状态 / 分类 / 日期，供前端展示徽标、避免误加已结束活动 */
const SELECT = {
  id: taskTemplate.id,
  title: taskTemplate.title,
  bankName: bank.name,
  status: taskTemplate.status,
  categoryName: activityCategory.name,
  date: taskTemplate.date,
}

function baseQuery() {
  return db
    .select(SELECT)
    .from(taskTemplate)
    .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
    .leftJoin(activityCategory, eq(taskTemplate.activityCategoryId, activityCategory.id))
}

export default defineHandler(async (event) => {
  const q = getQuery(event)
  const keyword = String(q.keyword ?? '').trim()
  const idsRaw = String(q.ids ?? '').trim()
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)))
  const bankId = Number(q.bankId)
  const activityCategoryId = Number(q.activityCategoryId)
  const status = String(q.status ?? '').trim().toUpperCase()

  // ids 回填已选项：不分页、返回富字段
  const ids = idsRaw ? idsRaw.split(',').map(s => Number(s)).filter(n => Number.isFinite(n) && n > 0) : []
  if (ids.length > 0) {
    const rows = await baseQuery().where(inArray(taskTemplate.id, ids))
    return { list: rows }
  }

  // 关键词 + 结构化筛选（银行 / 活动分类 / 状态），全部 AND
  const conds: SQL[] = []
  if (keyword) {
    const kw = `%${keyword}%`
    conds.push(or(like(taskTemplate.title, kw), like(bank.name, kw))!)
  }
  if (Number.isFinite(bankId) && bankId > 0) conds.push(eq(taskTemplate.bankId, bankId))
  if (Number.isFinite(activityCategoryId) && activityCategoryId > 0)
    conds.push(eq(taskTemplate.activityCategoryId, activityCategoryId))
  if (status === 'PENDING' || status === 'EXPIRED') conds.push(eq(taskTemplate.status, status))

  const rows = await baseQuery()
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(taskTemplate.id))
    .limit(limit)
  return { list: rows }
})
