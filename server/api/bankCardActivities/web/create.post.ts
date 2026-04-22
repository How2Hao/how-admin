import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankTaskCreateSchema, serializeNumberArray, toTimestamp } from '~~/utils/bankCardActivityForm'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const body = await event.req.json()
  const parsed = bankTaskCreateSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const payload = parsed.data
  const [created] = await db.insert(taskTemplate).values({
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
    createdAt: Date.now(),
  }).$returningId()

  const createdId = Number((created as { id: number }).id)

  return {
    id: createdId,
    title: payload.title,
  }
})
