import { eq, sql } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCard } from '../../../../drizzle/schema'

interface Payload {
  isVisible: boolean | 0 | 1
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '银行 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body || body.isVisible === undefined)
    throw createError({ statusCode: 400, statusMessage: '缺少 isVisible 字段' })

  const [existing] = await db
    .select({ id: bank.id })
    .from(bank)
    .where(eq(bank.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '银行不存在' })

  const value = body.isVisible ? 1 : 0

  // 隐藏时校验：如果存在用户银行卡引用，禁止隐藏（避免存量卡指向不可见银行）
  if (value === 0) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(bankCard)
      .where(eq(bankCard.bankId, String(id)))
    if (Number(n) > 0)
      throw createError({ statusCode: 409, statusMessage: `存在 ${n} 张关联银行卡，无法隐藏` })
  }

  try {
    await db.update(bank).set({ isVisible: value }).where(eq(bank.id, id))
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
  }

  const [row] = await db
    .select()
    .from(bank)
    .where(eq(bank.id, id))
    .limit(1)
  return row
})
