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
