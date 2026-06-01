export const REPEAT_TYPE_OPTIONS = [
  { label: '一次性', value: 'ONE_TIME' },
  { label: '每日', value: 'DAILY' },
  { label: '每周', value: 'WEEKLY' },
  { label: '每月', value: 'MONTHLY' },
  { label: '每年', value: 'YEARLY' },
] as const

export type RepeatType = (typeof REPEAT_TYPE_OPTIONS)[number]['value']

export interface JobTemplateTier {
  minAmount: number | null
  minCount: number | null
  logic: 'AND' | 'OR'
  description: string | null
}

export interface JobTemplateRow {
  id: number
  title: string
  repeatType: RepeatType
  startDate: number | null
  endDate: number | null
  tiers: JobTemplateTier[]
  taskTemplateId: number | null
  bankId: number | null
  bankName: string | null
  bankCardTemplateId: number | null
  regionCode: string | null
  regionMatchStrategy: string | null
  isVisible: number
  updatedAt: string | null
}

export type RegionMatchStrategy = 'EXACT' | 'INCLUDE_ALL' | 'EXCLUDE_PLAN_SINGLE_CITY'

export const REGION_MATCH_STRATEGY_OPTIONS = [
  { label: '精确匹配', value: 'EXACT' },
  { label: '省（含全部地市）', value: 'INCLUDE_ALL' },
  { label: '省（排除计划单列市）', value: 'EXCLUDE_PLAN_SINGLE_CITY' },
]
