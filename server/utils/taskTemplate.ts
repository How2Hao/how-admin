import type { taskTemplate } from '../../drizzle/schema'
import type { BankTaskCreateInput, BankTemplateInput } from './bankCardActivityForm'
import { createError } from 'h3'
import { serializeNumberArray, toTimestamp } from './bankCardActivityForm'

type TaskTemplateRow = typeof taskTemplate.$inferSelect

function parseSerializedNumberArray(value: string | null) {
  if (!value) {
    return null
  }

  return value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => !Number.isNaN(item))
}

function formatDatePart(value: number) {
  return String(value).padStart(2, '0')
}

export function formatTimestamp(value: number | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return `${[
    date.getFullYear(),
    formatDatePart(date.getMonth() + 1),
    formatDatePart(date.getDate()),
  ].join('-')} ${[
    formatDatePart(date.getHours()),
    formatDatePart(date.getMinutes()),
    formatDatePart(date.getSeconds()),
  ].join(':')}`
}

/** 单档原子的 insert payload。tierExclusive / rootTemplateId 由调用方在 batch 写入时设置。 */
export function toTemplateMutation(tpl: BankTemplateInput, tierExclusive: boolean | null) {
  return {
    title: tpl.title,
    ruleBrief: tpl.ruleBrief,
    ruleDetail: tpl.ruleDetail,
    ruleSource: null,
    date: null,
    bankId: tpl.bankId,
    bankCardOrganization: String(tpl.bankCardOrganization),
    bankCardTemplateId: tpl.bankCardTemplateId,
    bankCardType: tpl.bankCardType,
    bankCardLevel: null,
    regionCode: tpl.regionCode,
    regionMatchStrategy: tpl.regionMatchStrategy,
    repeatType: tpl.repeatType,
    reminderTime: tpl.reminderTime,
    startDate: toTimestamp(tpl.startDate),
    endDate: toTimestamp(tpl.endDate),
    daysOfWeek: serializeNumberArray(tpl.daysOfWeek),
    yearlyMonths: serializeNumberArray(tpl.yearlyMonths),
    daysOfMonth: serializeNumberArray(tpl.daysOfMonth),
    yearlyDaysOfMonth: serializeNumberArray(tpl.yearlyDaysOfMonth),
    frequencyControl: tpl.frequencyControl,
    benefitCategoryId: tpl.benefitCategoryId,
    benefitAmount: tpl.benefitAmount.toString(),
    benefitDescription: tpl.benefitDescription,
    benefitPayPlatformId: tpl.benefitPayPlatformId,
    benefitUsagePlatformId: tpl.benefitUsagePlatformId,
    activityCategoryId: tpl.activityCategoryId,
    participationDifficulty: tpl.participationDifficulty,
    extraConditionsText: tpl.extraConditionsText,
    guideText: tpl.guideText,
    minAmount: tpl.minAmount === null ? null : tpl.minAmount.toString(),
    minCount: tpl.minCount,
    tierExclusive: tierExclusive === null ? null : (tierExclusive ? 1 : 0),
  }
}

export function toTaskTemplateDetail(row: TaskTemplateRow) {
  return {
    id: row.id,
    title: row.title,
    ruleBrief: row.ruleBrief,
    ruleDetail: row.ruleDetail,
    bankId: row.bankId,
    bankCardOrganization: row.bankCardOrganization ? Number(row.bankCardOrganization) : 1,
    bankCardTemplateId: row.bankCardTemplateId,
    bankCardType: (row.bankCardType ?? 'CREDIT') as 'CREDIT' | 'DEBIT',
    regionCode: row.regionCode,
    regionMatchStrategy: (row.regionMatchStrategy ?? 'EXACT') as 'EXACT' | 'EXCLUDE_PLAN_SINGLE_CITY',
    repeatType: row.repeatType,
    daysOfWeek: parseSerializedNumberArray(row.daysOfWeek),
    yearlyMonths: parseSerializedNumberArray(row.yearlyMonths),
    daysOfMonth: parseSerializedNumberArray(row.daysOfMonth),
    yearlyDaysOfMonth: parseSerializedNumberArray(row.yearlyDaysOfMonth),
    frequencyControl: row.frequencyControl,
    reminderTime: row.reminderTime ?? '10:00',
    startDate: formatTimestamp(row.startDate),
    endDate: formatTimestamp(row.endDate),
    benefitAmount: row.benefitAmount === null ? null : Number(row.benefitAmount),
    benefitDescription: row.benefitDescription,
    extraConditionsText: row.extraConditionsText,
    benefitCategoryId: row.benefitCategoryId,
    benefitPayPlatformId: row.benefitPayPlatformId,
    benefitUsagePlatformId: row.benefitUsagePlatformId,
    activityCategoryId: row.activityCategoryId,
    participationDifficulty: row.participationDifficulty,
    guideText: row.guideText,
    rootTemplateId: row.rootTemplateId ?? row.id,
    tierExclusive: row.tierExclusive === null || row.tierExclusive === undefined
      ? null
      : Number(row.tierExclusive) === 1,
    minAmount: row.minAmount === null ? null : Number(row.minAmount),
    minCount: row.minCount,
  }
}

export function parseTaskTemplateId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: '无效的模板 ID',
    })
  }

  return id
}
