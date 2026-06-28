import { and, desc, eq, like, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { activityCategory, bank, benefitPayPlatform, benefitUsagePlatform, cardOrganization, jobTemplate, region, taskTemplate } from '../../../../drizzle/schema'
import { formatTimestamp, parseSerializedNumberArray } from '../../../utils/taskTemplate'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '10') || 10, 1), 50)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const bankIdParam = url.searchParams.get('bankId')
  const bankIdFilter = bankIdParam ? (Number(bankIdParam) || null) : null

  const keywordClause = keyword ? like(taskTemplate.title, `%${keyword}%`) : undefined
  const bankIdClause = bankIdFilter ? eq(taskTemplate.bankId, bankIdFilter) : undefined
  const whereClause = and(keywordClause, bankIdClause)

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(taskTemplate)
    .where(whereClause)

  const rows = await db
    .select({
      id: taskTemplate.id,
      title: taskTemplate.title,
      jobTemplateId: taskTemplate.jobTemplateId,
      jobTemplateTitle: jobTemplate.title,
      bankId: taskTemplate.bankId,
      bankName: bank.name,
      bankLogo: bank.logo,
      bankCardType: taskTemplate.bankCardType,
      bankCardOrganization: taskTemplate.bankCardOrganization,
      cardOrganizationName: cardOrganization.name,
      cardOrganizationLogo: cardOrganization.logo,
      ruleSource: taskTemplate.ruleSource,
      repeatType: taskTemplate.repeatType,
      regionCode: taskTemplate.regionCode,
      regionMatchStrategy: taskTemplate.regionMatchStrategy,
      regionName: region.regionName,
      reminderTime: taskTemplate.reminderTime,
      daysOfWeek: taskTemplate.daysOfWeek,
      daysOfMonth: taskTemplate.daysOfMonth,
      yearlyMonths: taskTemplate.yearlyMonths,
      yearlyDaysOfMonth: taskTemplate.yearlyDaysOfMonth,
      startDate: taskTemplate.startDate,
      endDate: taskTemplate.endDate,
      updatedAt: taskTemplate.updatedAt,
      tiers: taskTemplate.tiers,
      groupId: taskTemplate.groupId,
      payPlatformName: benefitPayPlatform.name,
      payPlatformIcon: benefitPayPlatform.icon,
      usagePlatformName: benefitUsagePlatform.name,
      usagePlatformIcon: benefitUsagePlatform.icon,
      activityCategoryName: activityCategory.name,
      activityCategoryIcon: activityCategory.icon,
      activityCategoryParentId: activityCategory.parentId,
      isVisible: taskTemplate.isVisible,
    })
    .from(taskTemplate)
    .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
    .leftJoin(benefitPayPlatform, eq(taskTemplate.benefitPayPlatformId, benefitPayPlatform.id))
    .leftJoin(benefitUsagePlatform, eq(taskTemplate.benefitUsagePlatformId, benefitUsagePlatform.id))
    .leftJoin(activityCategory, eq(taskTemplate.activityCategoryId, activityCategory.id))
    .leftJoin(jobTemplate, eq(taskTemplate.jobTemplateId, jobTemplate.id))
    .leftJoin(region, eq(taskTemplate.regionCode, region.regionCode))
    .leftJoin(cardOrganization, sql`${taskTemplate.bankCardOrganization} = ${cardOrganization.id}`)
    .where(whereClause)
    .orderBy(desc(taskTemplate.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows.map(row => ({
      id: row.id,
      title: row.title,
      jobTemplateId: row.jobTemplateId ?? null,
      jobTemplateTitle: row.jobTemplateTitle ?? null,
      bankId: row.bankId,
      bankName: row.bankName,
      bankLogo: row.bankLogo,
      bankCardType: row.bankCardType,
      bankCardOrganization: row.bankCardOrganization,
      cardOrganizationName: row.cardOrganizationName ?? null,
      cardOrganizationLogo: row.cardOrganizationLogo ?? null,
      ruleSourceLinkUrl: (row.ruleSource as { linkUrl?: string } | null)?.linkUrl ?? null,
      ruleSourceImageUrls: (row.ruleSource as { imageUrls?: string[] } | null)?.imageUrls ?? null,
      repeatType: row.repeatType,
      regionCode: row.regionCode,
      regionMatchStrategy: row.regionMatchStrategy,
      regionName: row.regionName ?? null,
      reminderTime: row.reminderTime,
      daysOfWeek: parseSerializedNumberArray(row.daysOfWeek),
      daysOfMonth: parseSerializedNumberArray(row.daysOfMonth),
      yearlyMonths: parseSerializedNumberArray(row.yearlyMonths),
      yearlyDaysOfMonth: parseSerializedNumberArray(row.yearlyDaysOfMonth),
      startDate: formatTimestamp(row.startDate),
      endDate: formatTimestamp(row.endDate),
      // updatedAt 来自 datetime 列，drizzle 返回字符串 'YYYY-MM-DD HH:mm:ss[.ms]'；列表只展示日期
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt.slice(0, 10) : row.updatedAt,
      tiers: Array.isArray(row.tiers)
        ? row.tiers.map(t => ({
            minAmount: t.minAmount ?? null,
            benefitAmountFixed: t.benefitAmountFixed ?? null,
            benefitAmountMin: t.benefitAmountMin ?? null,
            benefitAmountMax: t.benefitAmountMax ?? null,
            benefitDescription: t.benefitDescription ?? null,
            quotaPerCycleText: t.quotaPerCycleText ?? null,
            quotaTotalText: t.quotaTotalText ?? null,
          }))
        : [],
      groupId: row.groupId ?? null,
      payPlatformName: row.payPlatformName ?? null,
      payPlatformIcon: row.payPlatformIcon ?? null,
      usagePlatformName: row.usagePlatformName ?? null,
      usagePlatformIcon: row.usagePlatformIcon ?? null,
      activityCategoryName: row.activityCategoryName ?? null,
      activityCategoryIcon: row.activityCategoryIcon ?? null,
      activityCategoryParentId: row.activityCategoryParentId ?? null,
      isVisible: row.isVisible,
    })),
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
    bankId: bankIdFilter,
  }
})
