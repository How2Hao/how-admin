import { createError } from 'h3'
import * as z from 'zod'

export const JOB_TEMPLATE_REPEAT_TYPES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const

const nullableNumber = z.number().nullish().transform(v => v ?? null)

const tierSchema = z.object({
  minAmount: nullableNumber,
  minCount: nullableNumber,
  logic: z.enum(['AND', 'OR']).default('AND'),
  description: z.string().nullish().transform(v => v ?? null),
})

export function getJobTemplateSchema() {
  return z.object({
    title: z.string().trim().min(1, '标题不能为空').max(200),
    repeatType: z.enum(JOB_TEMPLATE_REPEAT_TYPES),
    startDate: nullableNumber,
    endDate: nullableNumber,
    tiers: z.array(tierSchema).min(1, '至少需要一个档位'),
    taskTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    bankId: z.number().int().positive().nullish().transform(v => v ?? null),
    bankCardTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    regionCode: z.string().max(20).nullish().transform(v => v ?? null),
    regionMatchStrategy: z.string().max(255).nullish().transform(v => v ?? null),
    isVisible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
}

export type JobTemplateInput = z.infer<ReturnType<typeof getJobTemplateSchema>>

/** 把已校验的表单映射为 job_template 可写列（不含 id/adminUserId/createdAt/updatedAt，由 handler 补） */
export function toJobTemplateMutation(input: JobTemplateInput) {
  return {
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
}

export function parseJobTemplateId(rawId: string | undefined) {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '无效的任务模板 ID' })
  }
  return id
}
