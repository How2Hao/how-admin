import type { taskTemplate } from '../../drizzle/schema'
import type { BankTaskCreateInput } from './bankCardActivityForm'
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

export function toTaskTemplateMutation(payload: BankTaskCreateInput) {
  return {
    title: payload.title,
    ruleBrief: payload.ruleBrief,
    ruleDetail: payload.ruleDetail,
    ruleSource: null,
    date: null,
    bankId: payload.bankId,
    bankCardOrganization: String(payload.bankCardOrganization),
    bankCardTemplateId: payload.bankCardTemplateId,
    bankCardType: payload.bankCardType,
    bankCardLevel: null,
    regionCode: payload.regionCode,
    regionMatchStrategy: payload.regionMatchStrategy,
    repeatType: payload.repeatType,
    reminderTime: payload.reminderTime,
    startDate: toTimestamp(payload.startDate),
    endDate: toTimestamp(payload.endDate),
    daysOfWeek: serializeNumberArray(payload.daysOfWeek),
    yearlyMonths: serializeNumberArray(payload.yearlyMonths),
    daysOfMonth: serializeNumberArray(payload.daysOfMonth),
    yearlyDaysOfMonth: serializeNumberArray(payload.yearlyDaysOfMonth),
    frequencyControl: payload.frequencyControl,
    benefitCategoryId: payload.benefitCategoryId,
    benefitAmount: payload.benefitAmount.toString(),
    benefitDescription: payload.benefitDescription,
    benefitPayPlatformId: payload.benefitPayPlatformId,
    benefitUsagePlatformId: payload.benefitUsagePlatformId,
    activityCategoryId: payload.activityCategoryId,
    participationDifficulty: payload.participationDifficulty,
    extraConditionsText: payload.extraConditionsText,
    guideText: payload.guideText,
    requiresQualify: payload.requiresQualify ? 1 : 0,
    qualifyCycle: payload.qualifyCycle,
    tierMode: payload.tierMode,
    tiers: payload.tiers,
    qualifyDeadline: payload.qualifyDeadline ? toTimestamp(payload.qualifyDeadline) : null,
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
    requiresQualify: Boolean(row.requiresQualify),
    qualifyCycle: row.qualifyCycle,
    tierMode: row.tierMode,
    tiers: row.tiers,
    qualifyDeadline: formatTimestamp(row.qualifyDeadline),
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
