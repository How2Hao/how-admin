import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { taskTemplate } from '../../../../../drizzle/schema'

// 复制活动：克隆当前活动为新一行
// 行为约束（与产品确认）：
//  - groupId != null（聚合组活动）暂不支持，返回 422
//  - 标题加 "（副本）"
//  - is_visible 强制为 0，等管理员手动开启
//  - admin_user_id 写当前操作者
//  - createdAt 当前时间；updatedAt 由 DB 默认 CURRENT_TIMESTAMP 填
//  - 其余字段（含 tiers / linkedCoupons / ruleSource 等）整体复用源行
//  - jobTemplateId 不复制，避免副本和原活动同时指向同一个 job_template
export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '活动 ID 不合法' })
  }

  const [src] = await db.select().from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)
  if (!src) {
    throw createError({ statusCode: 404, statusMessage: '活动不存在' })
  }
  if (src.groupId != null) {
    throw createError({ statusCode: 422, statusMessage: '暂不支持复制聚合组活动' })
  }

  const adminUserId = event.context.adminUser?.id ?? src.adminUserId ?? 1
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = src

  const insertData = {
    ...rest,
    title: `${src.title}（副本）`,
    jobTemplateId: null,
    isVisible: 0,
    adminUserId,
    createdAt: Date.now(),
  } as typeof taskTemplate.$inferInsert

  const [created] = await db.insert(taskTemplate).values(insertData).$returningId()
  const newId = Number((created as { id: number }).id)
  return { id: newId, success: true }
})
