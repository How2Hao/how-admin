import { createError } from 'h3'
import * as z from 'zod'

export const REMINDER_TEMPLATE_KINDS = ['REMINDER', 'EXPIRY_REMINDER'] as const
export const REMINDER_TEMPLATE_REPEAT_TYPES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const

const reminderTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const nullableNumber = z.number().int().nullish().transform(v => v ?? null)
const nullableText = (max: number) =>
  z.string().max(max).nullish().transform((value) => {
    const text = value?.trim() ?? ''
    return text ? text : null
  })

export function getReminderTemplateSchema() {
  return z.object({
    title: z.string().trim().min(1, '标题不能为空').max(200),
    description: z.string().nullish().transform((value) => {
      const text = value?.trim() ?? ''
      return text ? text : null
    }),
    repeatType: z.enum(REMINDER_TEMPLATE_REPEAT_TYPES),
    date: nullableNumber,
    startDate: nullableNumber,
    endDate: nullableNumber,
    daysOfWeek: nullableText(50),
    daysOfMonth: nullableText(200),
    yearlyMonths: nullableText(100),
    yearlyDaysOfMonth: nullableText(200),
    reminderTime: z.string().nullish().transform((value, ctx) => {
      const text = value?.trim() ?? ''
      if (!text) return null
      if (!reminderTimePattern.test(text)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '提醒时间格式必须为 HH:mm',
        })
        return z.NEVER
      }
      return text
    }),
    advanceReminderMinutes: z.number().int().min(0).max(60).nullish().transform(v => v ?? null),
    isVisible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
}

export type ReminderTemplateInput = z.infer<ReturnType<typeof getReminderTemplateSchema>>

export function toReminderTemplateMutation(input: ReminderTemplateInput) {
  return {
    title: input.title,
    description: input.description,
    repeatType: input.repeatType,
    date: input.repeatType === 'ONE_TIME' ? input.date : null,
    startDate: input.startDate,
    endDate: input.endDate,
    daysOfWeek: input.repeatType === 'WEEKLY' ? input.daysOfWeek : null,
    daysOfMonth: input.repeatType === 'MONTHLY' ? input.daysOfMonth : null,
    yearlyMonths: input.repeatType === 'YEARLY' ? input.yearlyMonths : null,
    yearlyDaysOfMonth: input.repeatType === 'YEARLY' ? input.yearlyDaysOfMonth : null,
    reminderTime: input.reminderTime,
    advanceReminderMinutes: input.advanceReminderMinutes,
    isVisible: input.isVisible ? 1 : 0,
  }
}

export function parseReminderTemplateId(rawId: string | undefined) {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '无效的提醒模板 ID' })
  }
  return id
}
