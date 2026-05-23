import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { plazaCustomTab } from '../../../drizzle/schema'

interface OrderItem { id: number, sortOrder: number }

export default defineHandler(async (event) => {
  const body = await readBody<{ orders?: OrderItem[] }>(event)
  const orders = body?.orders
  if (!Array.isArray(orders) || orders.length === 0)
    throw createError({ statusCode: 400, statusMessage: 'orders 不能为空' })
  for (const o of orders) {
    if (!Number.isInteger(o?.id) || o.id <= 0)
      throw createError({ statusCode: 400, statusMessage: 'orders.id 不合法' })
    if (!Number.isInteger(o?.sortOrder))
      throw createError({ statusCode: 400, statusMessage: 'orders.sortOrder 必须是整数' })
  }

  const now = Date.now()
  for (const o of orders)
    await db.update(plazaCustomTab).set({ sortOrder: o.sortOrder, updatedAt: now }).where(eq(plazaCustomTab.id, o.id))

  return { ok: true }
})
