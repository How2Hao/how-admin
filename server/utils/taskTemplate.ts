import type { taskTemplate as taskTemplateSchema } from '../../drizzle/schema'
import type { BankTemplateInput } from './bankCardActivityForm'
import { and, eq, ne, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '~~/db'
import { jobTemplate, taskTemplate as taskTemplateTable } from '../../drizzle/schema'
import { serializeNumberArray, toTimestamp } from './bankCardActivityForm'

type TaskTemplateRow = typeof taskTemplateSchema.$inferSelect

export function parseSerializedNumberArray(value: string | null) {
  if (!value) {
    return null
  }

  // 兼容两种历史格式：JSON "[1,3,5]"（新格式）+ 逗号分隔 "1,3,5"（旧格式，DB migration 后会消失）
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => Number(item))
        .filter((n: number) => !Number.isNaN(n))
    }
  }
  catch {
    // 非合法 JSON → 走逗号 split fallback
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

/**
 * 单 task_template 行的 insert/update payload。
 * @param adminUserId
 *   - 创建路径传入 → 写入实际创建者
 *   - 编辑路径不传（undefined） → 不覆盖原 admin_user_id
 * @param overrides
 *   - 非互斥多档 fan-out 时，每行写自己的子集 tiers / groupId
 */
export function toTemplateMutation(
  tpl: BankTemplateInput,
  adminUserId?: number,
  overrides?: { tiers?: BankTemplateInput['tiers']; groupId?: number | null },
) {
  const base = {
    title: tpl.title,
    ruleBrief: tpl.ruleBrief,
    ruleDetail: tpl.ruleDetail,
    // rule_source 不在 toTemplateMutation 写入；统一交给 commitTemplateRuleSource()
    // 处理（在拿到 id 之后才能写图片路径，所以分两步）
    date: null,
    jobTemplateId: tpl.jobTemplateId ?? null,
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
    benefitPayPlatformId: tpl.benefitPayPlatformId,
    benefitUsagePlatformId: tpl.benefitUsagePlatformId,
    activityCategoryId: tpl.activityCategoryId,
    participationDifficulty: tpl.participationDifficulty,
    extraConditionsText: tpl.extraConditionsText,
    guideText: tpl.guideText,
    tiers: overrides?.tiers ?? tpl.tiers,
    groupId: overrides?.groupId !== undefined ? overrides.groupId : ((tpl as { groupId?: number | null }).groupId ?? null),
    linkedCoupons: tpl.linkedCoupons ?? null,
  }
  return adminUserId != null ? { ...base, adminUserId } : base
}

export function toTaskTemplateDetail(row: TaskTemplateRow) {
  const tiers = Array.isArray(row.tiers) ? row.tiers : []
  return {
    id: row.id,
    title: row.title,
    ruleBrief: row.ruleBrief,
    ruleDetail: row.ruleDetail,
    jobTemplateId: row.jobTemplateId ?? null,
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
    reminderTime: row.reminderTime,
    startDate: formatTimestamp(row.startDate),
    endDate: formatTimestamp(row.endDate),
    extraConditionsText: row.extraConditionsText,
    ruleSourceLinkUrl: (row.ruleSource as { linkUrl?: string } | null)?.linkUrl ?? null,
    ruleSourceImageUrls: (row.ruleSource as { imageUrls?: string[] } | null)?.imageUrls ?? null,
    benefitCategoryId: row.benefitCategoryId,
    benefitPayPlatformId: row.benefitPayPlatformId,
    benefitUsagePlatformId: row.benefitUsagePlatformId,
    activityCategoryId: row.activityCategoryId,
    participationDifficulty: row.participationDifficulty,
    guideText: row.guideText,
    tiers: tiers.map(t => ({
      minAmount: t.minAmount ?? null,
      benefitAmountFixed: t.benefitAmountFixed ?? null,
      benefitAmountMin: t.benefitAmountMin ?? null,
      benefitAmountMax: t.benefitAmountMax ?? null,
      benefitDescription: t.benefitDescription ?? null,
      quotaPerCycleText: t.quotaPerCycleText ?? null,
      quotaTotalText: t.quotaTotalText ?? null,
    })),
    groupId: row.groupId ?? null,
    linkedCoupons: Array.isArray(row.linkedCoupons)
      ? row.linkedCoupons.map(c => ({
          couponId: Number(c.couponId),
          purchasePrice: c.purchasePrice ?? null,
          sku: c.sku ?? null,
          actualValue: c.actualValue ?? null,
        }))
      : [],
    /**
     * 编辑回显时按数据形态推断：
     * - tiers.length > 1 → 互斥（true）
     * - 行级有 groupId 同伙 → 非互斥（false）；这里仅靠本行无法判断"是否真有同伙"，
     *   保守处理：本行 tiers.length == 1 且有 groupId → false；都没有 → null
     */
    tierExclusive: tiers.length > 1
      ? true
      : (row.groupId != null ? false : null),
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

/**
 * task_template 侧现在也保存 job_template_id；保存活动模板后同步 job_template.task_template_id，
 * 避免两个 admin 页面看到不同的关联状态。
 */
export async function syncTaskTemplateJobTemplate(
  taskTemplateId: number,
  previousJobTemplateId: number | null | undefined,
  nextJobTemplateId: number | null | undefined,
) {
  const prevId = previousJobTemplateId ?? null
  const nextId = nextJobTemplateId ?? null

  if (prevId && prevId !== nextId) {
    await db.update(jobTemplate)
      .set({
        taskTemplateId: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(jobTemplate.id, prevId), eq(jobTemplate.taskTemplateId, taskTemplateId)))
  }

  if (nextId) {
    await db.update(taskTemplateTable)
      .set({
        jobTemplateId: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(taskTemplateTable.jobTemplateId, nextId), ne(taskTemplateTable.id, taskTemplateId)))

    await db.update(jobTemplate)
      .set({
        taskTemplateId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(jobTemplate.id, nextId))
  }
}
