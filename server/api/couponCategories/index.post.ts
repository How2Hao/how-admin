import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { couponCategory } from '../../../drizzle/schema'

interface Payload {
  parentId: number
  name?: string
  sortOrder?: number
  logoUrl?: string | null
  skuQueryName?: string | null
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)

  if (!body?.name?.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })
  if (typeof body?.parentId !== 'number' || body.parentId < 0)
    throw createError({ statusCode: 400, statusMessage: 'parentId 非法' })

  if (body.parentId !== 0) {
    const [parent] = await db.select({ id: couponCategory.id, parentId: couponCategory.parentId })
      .from(couponCategory).where(eq(couponCategory.id, body.parentId)).limit(1)
    if (!parent)
      throw createError({ statusCode: 400, statusMessage: '父分类不存在' })
    if (parent.parentId !== 0)
      throw createError({ statusCode: 400, statusMessage: '父分类必须是一级（parent_id=0）' })
  }

  const name = body.name.trim()
  const skuQueryName = body.skuQueryName ?? (body.parentId > 0 ? name : null)

  let id: number
  try {
    const result = await db.insert(couponCategory).values({
      source: 'quanma51',
      parentId: body.parentId,
      name,
      sortOrder: body.sortOrder ?? 0,
      logoUrl: body.logoUrl ?? null,
      logoOriginUrl: null,
      skuQueryName,
      isVisible: 1,
      createdAt: Date.now(),
    })
    id = Number((result as unknown as [{ insertId: number }])[0].insertId)
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY')
      throw createError({ statusCode: 409, statusMessage: '同 parent 下已存在同名分类' })
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }

  const [row] = await db.select().from(couponCategory).where(eq(couponCategory.id, id)).limit(1)
  return row
})
