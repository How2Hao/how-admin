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
  reminderTime: string
  startDate: string
  endDate: string
  extraConditionsText: string
  benefitCategoryId: number | null
  benefitPayPlatformId: number | null
  benefitUsagePlatformId: number | null
  activityCategoryId: number | null
  participationDifficulty: string
  guideText: string
  /** 多档活动是否互斥取一。null 表示单档 */
  tierExclusive: boolean | null
  /** 档位数组。单档活动长度为 1（minAmount/minCount 可为 null 表示无门槛）；多档时按门槛由低到高 */
  tiers: BankTaskTierForm[]
}

export interface BankTaskTierForm {
  minAmount: number | null
  minCount: number | null
  benefitAmount: number | null
  benefitDescription: string
}

export interface SelectOption {
  label: string
  value: string | number
  icon?: string | null
}
