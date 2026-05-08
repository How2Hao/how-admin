import type { CouponCategoryDto, CouponCategoryTreeNode } from '@/types/couponCategory'
import { requestJson } from '@/composables/useJsonRequest'

export interface CouponCategoryUpdatePayload {
  name?: string
  sortOrder?: number
  isVisible?: boolean
  logoUrl?: string | null
}

export interface CouponCategoryCreatePayload {
  parentId: number
  name: string
  sortOrder?: number
  logoUrl?: string | null
  skuQueryName?: string | null
}

export async function fetchCouponCategoryTree(): Promise<CouponCategoryTreeNode[]> {
  const res = await requestJson<{ tree: CouponCategoryTreeNode[] }>('/api/couponCategories/tree')
  return res?.tree ?? []
}

export async function createCouponCategory(payload: CouponCategoryCreatePayload): Promise<CouponCategoryDto> {
  const body: Record<string, unknown> = { ...payload }
  return requestJson<CouponCategoryDto>('/api/couponCategories', {
    method: 'POST',
    body,
  })
}

export async function updateCouponCategory(
  id: number,
  patch: CouponCategoryUpdatePayload,
): Promise<CouponCategoryDto> {
  const body: Record<string, unknown> = { ...patch }
  return requestJson<CouponCategoryDto>(`/api/couponCategories/${id}`, {
    method: 'PATCH',
    body,
  })
}
