import { createError } from 'h3'
import { and, eq, ne, sql } from 'drizzle-orm'
import * as z from 'zod'
import { db } from '~~/db'
import { jobTemplate, taskTemplate } from '../../drizzle/schema'

export const JOB_TEMPLATE_REPEAT_TYPES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const

const nullableNumber = z.number().nullish().transform(v => v ?? null)
const optionalNullableNumber = z.number().nullish()

const tierSchema = z.object({
  minAmount: nullableNumber,
  minCount: nullableNumber,
  logic: z.enum(['AND', 'OR']).default('AND'),
  description: z.string().nullish().transform(v => v ?? null),
})

const rewardWindowRuleSchema = z.object({
  mode: z.enum(['NEXT_MONTH', 'NEXT_WEEK', 'AFTER_COMPLETION_DAYS', 'FIXED']),
  startDay: z.union([z.number().int().positive(), z.literal('FIRST_DAY')]).optional(),
  endDay: z.union([z.number().int().positive(), z.literal('LAST_DAY')]).optional(),
  startTime: z.string().max(16).optional(),
  endTime: z.string().max(16).optional(),
  weekStartsOn: z.number().int().min(1).max(7).optional(),
  startOffsetDays: z.number().int().min(0).optional(),
  durationDays: z.number().int().positive().optional(),
  startAt: z.number().optional(),
  endAt: z.number().optional(),
}).passthrough()

export function getJobTemplateSchema() {
  return z.object({
    title: z.string().trim().min(1, '标题不能为空').max(200),
    description: z.string().nullish(),
    repeatType: z.enum(JOB_TEMPLATE_REPEAT_TYPES),
    date: optionalNullableNumber,
    startDate: nullableNumber,
    endDate: nullableNumber,
    daysOfWeek: z.string().max(50).nullish(),
    daysOfMonth: z.string().max(200).nullish(),
    yearlyMonths: z.string().max(100).nullish(),
    yearlyDaysOfMonth: z.string().max(200).nullish(),
    tiers: z.array(tierSchema).min(1, '至少需要一个档位'),
    taskTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    reminderTemplateId: z.number().int().positive().nullish(),
    rewardWindowRule: rewardWindowRuleSchema.nullish(),
    rewardDescription: z.string().max(500).nullish(),
    bankId: z.number().int().positive().nullish().transform(v => v ?? null),
    bankCardTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    regionCode: z.string().max(20).nullish().transform(v => v ?? null),
    regionMatchStrategy: z.string().max(255).nullish().transform(v => v ?? null),
    isVisible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
}

export type JobTemplateInput = z.infer<ReturnType<typeof getJobTemplateSchema>>
type JobTemplateMutation = {
  title: string
  repeatType: typeof JOB_TEMPLATE_REPEAT_TYPES[number]
  startDate: number | null
  endDate: number | null
  tiers: z.infer<typeof tierSchema>[]
  taskTemplateId: number | null
  bankId: number | null
  bankCardTemplateId: number | null
  regionCode: string | null
  regionMatchStrategy: string | null
  isVisible: number
  description?: string | null
  date?: number | null
  daysOfWeek?: string | null
  daysOfMonth?: string | null
  yearlyMonths?: string | null
  yearlyDaysOfMonth?: string | null
  reminderTemplateId?: number | null
  rewardWindowRule?: z.infer<typeof rewardWindowRuleSchema> | null
  rewardDescription?: string | null
}

/** 把已校验的表单映射为 job_template 可写列（不含 id/adminUserId/createdAt/updatedAt，由 handler 补） */
export function toJobTemplateMutation(input: JobTemplateInput) {
  const mutation: JobTemplateMutation = {
    title: input.title,
    repeatType: input.repeatType,
    startDate: input.startDate,
    endDate: input.endDate,
    tiers: input.tiers,
    taskTemplateId: input.taskTemplateId,
    bankId: input.bankId,
    bankCardTemplateId: input.bankCardTemplateId,
    regionCode: input.regionCode,
    regionMatchStrategy: input.regionMatchStrategy,
    isVisible: input.isVisible ? 1 : 0,
  }

  if (input.description !== undefined) mutation.description = input.description ?? null
  if (input.date !== undefined) mutation.date = input.date ?? null
  if (input.daysOfWeek !== undefined) mutation.daysOfWeek = input.daysOfWeek ?? null
  if (input.daysOfMonth !== undefined) mutation.daysOfMonth = input.daysOfMonth ?? null
  if (input.yearlyMonths !== undefined) mutation.yearlyMonths = input.yearlyMonths ?? null
  if (input.yearlyDaysOfMonth !== undefined) mutation.yearlyDaysOfMonth = input.yearlyDaysOfMonth ?? null
  if (input.reminderTemplateId !== undefined) mutation.reminderTemplateId = input.reminderTemplateId ?? null
  if (input.rewardWindowRule !== undefined) mutation.rewardWindowRule = input.rewardWindowRule ?? null
  if (input.rewardDescription !== undefined) mutation.rewardDescription = input.rewardDescription ?? null

  return mutation
}

export function parseJobTemplateId(rawId: string | undefined) {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '无效的任务模板 ID' })
  }
  return id
}

/**
 * job_template 页面维护 taskTemplateId 时，同步 task_template.job_template_id。
 * 只清理仍指向当前 job_template 的旧活动，避免覆盖其他管理员刚保存的关系。
 */
export async function syncJobTemplateTaskTemplate(
  jobTemplateId: number,
  previousTaskTemplateId: number | null | undefined,
  nextTaskTemplateId: number | null | undefined,
) {
  const prevId = previousTaskTemplateId ?? null
  const nextId = nextTaskTemplateId ?? null

  if (prevId && prevId !== nextId) {
    await db.update(taskTemplate)
      .set({
        jobTemplateId: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(taskTemplate.id, prevId), eq(taskTemplate.jobTemplateId, jobTemplateId)))
  }

  if (nextId) {
    await db.update(jobTemplate)
      .set({
        taskTemplateId: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(jobTemplate.taskTemplateId, nextId), ne(jobTemplate.id, jobTemplateId)))

    await db.update(taskTemplate)
      .set({
        jobTemplateId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(taskTemplate.id, nextId))
  }
}
