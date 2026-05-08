import * as z from 'zod'
import { getBankTemplateSchema } from '../agent/schemas/bankTask'
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
  // 表单提交：单 template + tiers 数组 + tierExclusive 标识 + 可选 groupId
  // tierExclusive=null  → 单档或保存时 1 行
  // tierExclusive=true  → 多档互斥，保存为 1 行 + tiers JSON
  // tierExclusive=false → 多档非互斥，保存为 N 行（每 tier 1 行）+ 同 groupId
  const singleTemplate = getBankTemplateSchema().extend({
    tierExclusive: z.boolean().nullable().optional(),
    groupId: z.number().nullable().optional(),
  })

  return singleTemplate.superRefine((tpl, ctx) => {
    const startDate = parseDateTimeString(tpl.startDate)
    const endDate = parseDateTimeString(tpl.endDate)
    const path = (key: string) => [key]

    if (tpl.tiers.length > 1 && (tpl.tierExclusive === null || tpl.tierExclusive === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '多档活动需要选择"互斥"或"非互斥"',
        path: path('tierExclusive'),
      })
    }

    tpl.tiers.forEach((tier, tIdx) => {
      const tierPath = (key: string) => ['tiers', tIdx, key]
      const hasFixed = tier.benefitAmountFixed != null
      const hasMin = tier.benefitAmountMin != null
      const hasMax = tier.benefitAmountMax != null
      if (!hasFixed && !hasMin && !hasMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '档位优惠金额：固定金额或区间金额至少填一组',
          path: tierPath('benefitAmountFixed'),
        })
      }
      if (hasFixed && (hasMin || hasMax)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '档位优惠金额：固定金额与区间金额不能同时填写',
          path: tierPath('benefitAmountFixed'),
        })
      }
      if (hasMin && hasMax && tier.benefitAmountMin! > tier.benefitAmountMax!) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '档位区间优惠下限不能高于上限',
          path: tierPath('benefitAmountMax'),
        })
      }
    })

    if (!dateTimePattern.test(tpl.startDate) || Number.isNaN(startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate 格式必须为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss',
        path: path('startDate'),
      })
    }
    if (!dateTimePattern.test(tpl.endDate) || Number.isNaN(endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate 格式必须为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss',
        path: path('endDate'),
      })
    }
    if (tpl.reminderTime != null && tpl.reminderTime !== '' && !reminderTimePattern.test(tpl.reminderTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reminderTime 格式必须为 HH:mm',
        path: path('reminderTime'),
      })
    }
    if (!Number.isNaN(startDate) && !Number.isNaN(endDate) && startDate > endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '结束时间不能早于开始时间',
        path: path('endDate'),
      })
    }
    if (tpl.repeatType === 'WEEKLY' && (!tpl.daysOfWeek || tpl.daysOfWeek.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WEEKLY 类型必须提供 daysOfWeek',
        path: path('daysOfWeek'),
      })
    }
    if (tpl.repeatType === 'MONTHLY' && (!tpl.daysOfMonth || tpl.daysOfMonth.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MONTHLY 类型必须提供 daysOfMonth',
        path: path('daysOfMonth'),
      })
    }
    if (tpl.repeatType === 'YEARLY') {
      if (!tpl.yearlyMonths || tpl.yearlyMonths.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'YEARLY 类型必须提供 yearlyMonths',
          path: path('yearlyMonths'),
        })
      }
      if (!tpl.yearlyDaysOfMonth || tpl.yearlyDaysOfMonth.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'YEARLY 类型必须提供 yearlyDaysOfMonth',
          path: path('yearlyDaysOfMonth'),
        })
      }
      if (
        tpl.yearlyMonths
        && tpl.yearlyDaysOfMonth
        && tpl.yearlyMonths.length !== tpl.yearlyDaysOfMonth.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'yearlyMonths 与 yearlyDaysOfMonth 长度必须一致',
          path: path('yearlyDaysOfMonth'),
        })
      }
    }
  })
}

export type BankTaskCreateInput = z.infer<ReturnType<typeof buildBankTaskCreateSchema>>
export type BankTemplateInput = z.infer<ReturnType<typeof getBankTemplateSchema>>

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
    benefitUsagePlatforms: referenceData.benefitUsagePlatforms.map(item => ({
      label: item.name,
      value: item.id,
      code: item.code,
      icon: item.icon,
    })),
    activityCategories: (() => {
      const categoryById = new Map(referenceData.activityCategories.map(c => [c.id, c]))
      return referenceData.activityCategories.map(item => ({
        label: item.name,
        value: item.id,
        icon: item.icon,
        parentId: item.parentId ?? null,
        parentName: item.parentId ? (categoryById.get(item.parentId)?.name ?? null) : null,
        parentIcon: item.parentId ? (categoryById.get(item.parentId)?.icon ?? null) : null,
      }))
    })(),
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

  // JSON 格式存储（如 "[1,3,5]"），跟 how-api 端的 parseJsonArray 对齐
  return JSON.stringify(values)
}
