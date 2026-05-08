import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { couponCategory } from '../../../drizzle/schema'

export interface CouponCategoryDto {
  id: number
  parentId: number
  name: string
  sortOrder: number
  logoUrl: string | null
  skuQueryName: string | null
  isVisible: boolean
}

export interface CouponCategoryTreeNode extends CouponCategoryDto {
  children: CouponCategoryDto[]
}

function toDto(row: typeof couponCategory.$inferSelect): CouponCategoryDto {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    sortOrder: row.sortOrder,
    logoUrl: row.logoUrl,
    skuQueryName: row.skuQueryName,
    isVisible: !!row.isVisible,
  }
}

export default defineHandler(async () => {
  const rows = await db
    .select()
    .from(couponCategory)
    .orderBy(asc(couponCategory.parentId), asc(couponCategory.sortOrder), asc(couponCategory.id))

  const firstLevels = rows.filter(r => r.parentId === 0)
  const children = rows.filter(r => r.parentId > 0)

  const tree: CouponCategoryTreeNode[] = firstLevels.map(fl => ({
    ...toDto(fl),
    children: children.filter(c => c.parentId === fl.id).map(toDto),
  }))

  return { tree }
})
