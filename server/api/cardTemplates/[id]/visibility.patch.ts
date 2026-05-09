import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankCardTemplate } from '../../../../drizzle/schema'

interface Payload {
  is_visible?: 0 | 1 | boolean
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })
  }
  const body = await readBody<Payload>(event)
  if (!body || body.is_visible === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'is_visible 不能为空' })
  }
  const v = body.is_visible
  if (v !== 0 && v !== 1 && typeof v !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'is_visible 必须为 0、1 或 boolean' })
  }
  const next = v === 1 || v === true ? 1 : 0

  const [existing] = await db
    .select({ id: bankCardTemplate.id, dataSource: bankCardTemplate.dataSource })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  }

  // C 端目前仍按 data_source='flyert' 取数据。is_visible=1 时若来源不是 flyert，
  // 同步把 data_source 升级为 flyert，让 C 端立刻可见（C 端切到 is_visible 过滤前的过渡逻辑）
  const upgradeDataSource = next === 1 && existing.dataSource !== 'flyert'
  const update: Record<string, unknown> = { isVisible: next, updatedAt: Date.now() }
  if (upgradeDataSource) {
    update.dataSource = 'flyert'
  }

  await db
    .update(bankCardTemplate)
    .set(update)
    .where(eq(bankCardTemplate.id, id))

  return {
    id,
    isVisible: next,
    dataSource: upgradeDataSource ? 'flyert' : existing.dataSource,
    success: true,
  }
})
