import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCard } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '银行 ID 不合法' })

  const [existing] = await db
    .select({ id: bank.id, name: bank.name })
    .from(bank)
    .where(eq(bank.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '银行不存在' })

  // 删除前校验：如果存在用户银行卡引用，禁止删除
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(bankCard)
    .where(eq(bankCard.bankId, String(id)))
  if (Number(n) > 0)
    throw createError({ statusCode: 409, statusMessage: `存在 ${n} 张关联银行卡，无法删除` })

  try {
    await db.delete(bank).where(eq(bank.id, id))
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `删除失败：${e?.message ?? e}` })
  }

  return { id, name: existing.name, deleted: true }
})
