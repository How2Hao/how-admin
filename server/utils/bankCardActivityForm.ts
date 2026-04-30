import * as z from 'zod'
import { getBankTaskSchema } from '../agent/schemas/bankTask'
import { referenceData } from '../agent/utils/referenceData'

export const bankCardTypeOptions = [
  { label: '信用卡', value: 'CREDIT' },
  { label: '借记卡', value: 'DEBIT' },
] as const

export const regionMatchStrategyOptions = [
  { label: '精确匹配', value: 'EXACT' },
  { label: '排除计划单列市', value: 'EXCLUDE_PLAN_SINGLE_CITY' },
] as const

export const repeatTypeOptions = [
  { label: '活动期一次', value: 'ONE_TIME' },
  { label: '每日', value: 'DAILY' },
  { label: '每周', value: 'WEEKLY' },
  { label: '每月', value: 'MONTHLY' },
  { label: '每年', value: 'YEARLY' },
] as const

const dateTimePattern = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/
const reminderTimePattern = /^\d{2}:\d{2}$/

// 延迟求值：schema 内的 describe 依赖 referenceData，
// 而 referenceData.initialize() 是 async；模块顶层立即求值会撞到 referenceData 还未 init 的 race。
let _bankTaskCreateSchema: ReturnType<typeof buildBankTaskCreateSchema> | null = null

export function getBankTaskCreateSchema() {
  if (!_bankTaskCreateSchema) {
    _bankTaskCreateSchema = buildBankTaskCreateSchema()
  }
  return _bankTaskCreateSchema
}

function buildBankTaskCreateSchema() {
  return getBankTaskSchema().superRefine((value, ctx) => {
  const startDate = parseDateTimeString(value.startDate)
  const endDate = parseDateTimeString(value.endDate)

  if (!dateTimePattern.test(value.startDate) || Number.isNaN(startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate 格式必须为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss',
      path: ['startDate'],
    })
  }

  if (!dateTimePattern.test(value.endDate) || Number.isNaN(endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate 格式必须为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss',
      path: ['endDate'],
    })
  }

  if (!reminderTimePattern.test(value.reminderTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reminderTime 格式必须为 HH:mm',
      path: ['reminderTime'],
    })
  }

  if (!Number.isNaN(startDate) && !Number.isNaN(endDate) && startDate > endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '结束时间不能早于开始时间',
      path: ['endDate'],
    })
  }

  if (value.repeatType === 'WEEKLY' && (!value.daysOfWeek || value.daysOfWeek.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'WEEKLY 类型必须提供 daysOfWeek',
      path: ['daysOfWeek'],
    })
  }

  if (value.repeatType === 'MONTHLY' && (!value.daysOfMonth || value.daysOfMonth.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'MONTHLY 类型必须提供 daysOfMonth',
      path: ['daysOfMonth'],
    })
  }

  if (value.repeatType === 'YEARLY') {
    if (!value.yearlyMonths || value.yearlyMonths.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'YEARLY 类型必须提供 yearlyMonths',
        path: ['yearlyMonths'],
      })
    }

    if (!value.yearlyDaysOfMonth || value.yearlyDaysOfMonth.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'YEARLY 类型必须提供 yearlyDaysOfMonth',
        path: ['yearlyDaysOfMonth'],
      })
    }

    if (
      value.yearlyMonths
      && value.yearlyDaysOfMonth
      && value.yearlyMonths.length !== value.yearlyDaysOfMonth.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'yearlyMonths 与 yearlyDaysOfMonth 长度必须一致',
        path: ['yearlyDaysOfMonth'],
      })
    }
  }
  })
}

export type BankTaskCreateInput = z.infer<ReturnType<typeof buildBankTaskCreateSchema>>

export function getReferenceOptions() {
  return {
    cardOrganizations: referenceData.cardOrganizations
      .filter(org => org.status === 'ENABLED')
      .map(org => ({
        label: org.name,
        value: org.id,
        supportedCardTypes: org.supportedCardTypes,
      })),
    benefitCategories: referenceData.benefitCategories.map(item => ({
      label: item.name,
      value: item.id,
      icon: item.icon,
    })),
    benefitPayPlatforms: referenceData.benefitPlatforms.map(item => ({
      label: item.name,
      value: item.id,
      code: item.code,
      icon: item.icon,
    })),
    enums: {
      bankCardType: bankCardTypeOptions,
      regionMatchStrategy: regionMatchStrategyOptions,
      repeatType: repeatTypeOptions,
    },
  }
}

export function parseDateTimeString(value: string) {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : `${value}T00:00:00`
  return new Date(normalized).getTime()
}

export function toTimestamp(value: string) {
  return parseDateTimeString(value)
}

export function serializeNumberArray(values: number[] | null) {
  if (!values || values.length === 0)
    return null

  return values.join(',')
}
