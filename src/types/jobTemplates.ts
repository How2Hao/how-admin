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
  isVisible: number
  updatedAt: string | null
}
