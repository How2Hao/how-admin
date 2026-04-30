import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { getBankTaskCreateSchema, serializeNumberArray, toTimestamp } from '~~/utils/bankCardActivityForm'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  await referenceData.ensureInitialized()
  const body = await event.req.json()
  const parsed = getBankTaskCreateSchema().safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const payload = parsed.data
  const insertResult = await db.insert(taskTemplate).values({
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
    highPriority: 0,
    isCompleted: 0,
    status: 'PENDING',
    benefitCategoryId: payload.benefitCategoryId,
    benefitAmount: payload.benefitAmount.toString(),
    benefitDescription: payload.benefitDescription,
    benefitPayPlatformId: payload.benefitPayPlatformId,
    benefitUsagePlatformId: payload.benefitUsagePlatformId,
    activityCategoryId: payload.activityCategoryId,
    publisher: null,
    publishTime: null,
    likes: 0,
    addCount: 0,
    participationDifficulty: payload.participationDifficulty,
    extraConditionsText: payload.extraConditionsText,
    guideText: payload.guideText,
    requiresQualify: payload.requiresQualify ? 1 : 0,
    qualifyCycle: payload.qualifyCycle,
    tierMode: payload.tierMode,
    tiers: payload.tiers,
    qualifyDeadline: payload.qualifyDeadline ? toTimestamp(payload.qualifyDeadline) : null,
    createdAt: Date.now(),
  })

  const createdId = Number((insertResult as unknown as [{ insertId: number }])[0].insertId)
  if (!createdId) {
    throw createError({ statusCode: 500, statusMessage: '创建失败：未获取到自增 ID' })
  }

  return {
    id: createdId,
    title: payload.title,
  }
})
