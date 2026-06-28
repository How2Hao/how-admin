export const REMINDER_TEMPLATE_KIND_OPTIONS = [
  { label: '参与提醒', value: 'REMINDER' },
  { label: '到期提醒', value: 'EXPIRY_REMINDER' },
] as const

export type ReminderTemplateKind = (typeof REMINDER_TEMPLATE_KIND_OPTIONS)[number]['value']

export const REMINDER_REPEAT_TYPE_OPTIONS = [
  { label: '一次性', value: 'ONE_TIME' },
  { label: '每日', value: 'DAILY' },
  { label: '每周', value: 'WEEKLY' },
  { label: '每月', value: 'MONTHLY' },
  { label: '每年', value: 'YEARLY' },
] as const

export type ReminderRepeatType = (typeof REMINDER_REPEAT_TYPE_OPTIONS)[number]['value']

export interface ReminderTemplateRow {
  id: number
  taskTemplateId: number
  taskTemplateTitle?: string | null
  title: string
  description: string | null
  kind: ReminderTemplateKind
  repeatType: ReminderRepeatType
  date: number | null
  startDate: number | null
  endDate: number | null
  daysOfWeek: string | null
  daysOfMonth: string | null
  yearlyMonths: string | null
  yearlyDaysOfMonth: string | null
  reminderTime: string | null
  advanceReminderMinutes: number | null
  isVisible: number
  createdAt: number | null
  updatedAt: string | null
}
