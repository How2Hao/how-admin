export type ParseBankCardActivityResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/parseUrl').default> extends Promise<infer T>
  ? T
  : never

export type ReferenceOptionsResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/referenceOptions.get').default>

export type SearchBanksResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/searchBanks.get').default>
export type SearchBankCardTemplatesResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/searchBankCardTemplates.get').default>
export type SearchRegionsResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/searchRegions.get').default>
export type SearchBenefitUsagePlatformsResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/searchBenefitUsagePlatforms.get').default>
export type SearchActivityCategoriesResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/searchActivityCategories.get').default>
export type ResolveSelectionsResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/resolveSelections.post').default> extends Promise<infer T>
  ? T
  : never
export type CreateBankCardActivityResponse = ReturnType<typeof import('../../server/api/bankCardActivities/web/create.post').default> extends Promise<infer T>
  ? T
  : never
export type TaskTemplateListResponse = ReturnType<typeof import('../../server/api/bankCardActivities/taskTemplates/index.get').default> extends Promise<infer T>
  ? T
  : never
export type TaskTemplateDetailResponse = ReturnType<typeof import('../../server/api/bankCardActivities/taskTemplates/[id].get').default> extends Promise<infer T>
  ? T
  : never
export type CreateTaskTemplateResponse = ReturnType<typeof import('../../server/api/bankCardActivities/taskTemplates/index.post').default> extends Promise<infer T>
  ? T
  : never
export type UpdateTaskTemplateResponse = ReturnType<typeof import('../../server/api/bankCardActivities/taskTemplates/[id].put').default> extends Promise<infer T>
  ? T
  : never

export type BankTaskPayload = ParseBankCardActivityResponse
export type TaskTemplateListItem = TaskTemplateListResponse['list'][number]

export interface BankTaskFormData {
  title: string
  ruleBrief: string
  ruleDetail: string
  bankId: number | null
  bankCardOrganization: number | null
  bankCardTemplateId: number | null
  bankCardType: 'CREDIT' | 'DEBIT'
  regionCode: string
  regionMatchStrategy: 'EXACT' | 'EXCLUDE_PLAN_SINGLE_CITY'
  repeatType: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  daysOfWeek: number[]
  yearlyMonths: number[]
  daysOfMonth: number[]
  yearlyDaysOfMonth: number[]
  frequencyControl: string
  reminderTime: string | null
  startDate: string
  endDate: string
  extraConditionsText: string
  ruleSourceLinkUrl: string
  /** 编辑时进入此页的"已上传图片 URL 列表"——保存时回传 server，server 据此判断哪些是保留的 */
  ruleSourceImageUrls: string[]
  /** 用户新加未上传的 data URL 列表——server 在保存时实际上传到 OSS */
  ruleSourceImageBase64s: string[]
  benefitCategoryId: number | null
  benefitPayPlatformId: number | null
  benefitUsagePlatformId: number | null
  activityCategoryId: number | null
  participationDifficulty: string
  guideText: string
  /** 档位数组。单档长度为 1；多档时按门槛由低到高 */
  tiers: BankTaskTierForm[]
  /** 多档是否互斥取一。单档时为 null；true=互斥（保存为 1 行 + tiers JSON）；false=非互斥（保存为 N 行 + 同 groupId） */
  tierExclusive: boolean | null
  /** UI 聚合分组 ID。独立任务为 null；非互斥多档保存时由后端自动分配 */
  groupId: number | null
  /** 关联卡券明细（仅 benefitCategoryId in (1, 2) 时使用）；同 couponId 多 SKU = 数组多行 */
  linkedCoupons: BankTaskLinkedCouponForm[]
}

export interface BankTaskLinkedCouponForm {
  couponId: number
  /** UI 展示用：从 couponCategory tree 拿来的中文名 */
  couponName: string
  /** UI 展示用：从 couponCategory tree 拿来的 logo URL */
  couponLogoUrl: string | null
  /** SKU 文本（如 "20元券" / "月卡"），可空 */
  sku: string
  /** 购买花费（元）。0 = 免费领；空字符串/null = 待录入 */
  purchasePrice: number | null
  /** 实际价值（元） */
  actualValue: number | null
}

export interface BankTaskTierForm {
  minAmount: number | null
  benefitAmountFixed: number | null
  benefitAmountMin: number | null
  benefitAmountMax: number | null
  benefitDescription: string
  quotaPerCycleText: string
  quotaTotalText: string
}

export interface SelectOption {
  label: string
  value: string | number
  icon?: string | null
  parentId?: number | null
  parentName?: string | null
  parentIcon?: string | null
}
