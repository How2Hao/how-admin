import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank } from '../../../drizzle/schema'

const BANK_TYPE_VALUES = [
  'STATE_OWNED',
  'JOINT_STOCK',
  'CITY_COMMERCIAL',
  'RURAL_COMMERCIAL',
  'RURAL_CREDIT_COOP',
  'JOINT_VENTURE',
  'VILLAGE',
  'PRIVATE',
] as const

type BankType = typeof BANK_TYPE_VALUES[number]

interface Payload {
  isVisible?: boolean | 0 | 1
  isHot?: boolean | 0 | 1
  bankType?: BankType | null
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '银行 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body || (body.isVisible === undefined && body.isHot === undefined && body.bankType === undefined))
    throw createError({ statusCode: 400, statusMessage: '至少需要 isVisible / isHot / bankType 之一' })

  if (
    body.bankType !== undefined
    && body.bankType !== null
    && !BANK_TYPE_VALUES.includes(body.bankType as BankType)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'bankType 取值不合法' })
  }

  const [existing] = await db
    .select({ id: bank.id })
    .from(bank)
    .where(eq(bank.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '银行不存在' })

  const patch: { isVisible?: number, isHot?: number, bankType?: BankType | null } = {}
  if (body.isVisible !== undefined) patch.isVisible = body.isVisible ? 1 : 0
  if (body.isHot !== undefined) patch.isHot = body.isHot ? 1 : 0
  if (body.bankType !== undefined) patch.bankType = body.bankType

  try {
    await db.update(bank).set(patch).where(eq(bank.id, id))
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
