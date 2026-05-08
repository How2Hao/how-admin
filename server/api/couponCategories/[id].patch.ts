import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { couponCategory } from '../../../drizzle/schema'

interface Payload {
  name?: string
  sortOrder?: number
  isVisible?: boolean
  logoUrl?: string | null
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '无效的分类 ID' })

  const body = (await readBody<Payload>(event)) ?? {}
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })
    patch.name = name
  }
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder
  if (body.isVisible !== undefined) patch.isVisible = body.isVisible ? 1 : 0
  if (body.logoUrl !== undefined) patch.logoUrl = body.logoUrl

  if (Object.keys(patch).length === 0) {
    const [existing] = await db.select().from(couponCategory).where(eq(couponCategory.id, id)).limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
    return existing
  }

  const [existing] = await db.select({ id: couponCategory.id }).from(couponCategory)
    .where(eq(couponCategory.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: '分类不存在' })

  try {
    await db.update(couponCategory).set(patch).where(eq(couponCategory.id, id))
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY')
      throw createError({ statusCode: 409, statusMessage: '同 parent 下已存在同名分类' })
    throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
  }

  const [row] = await db.select().from(couponCategory).where(eq(couponCategory.id, id)).limit(1)
  return row
})
