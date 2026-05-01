import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { getBankTaskCreateSchema } from '~~/utils/bankCardActivityForm'
import { parseTaskTemplateId, toTemplateMutation } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  await referenceData.ensureInitialized()
  const id = parseTaskTemplateId(event.context.params?.id)
  const body = await event.req.json()
  const parsed = getBankTaskCreateSchema().safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [existing] = await db.select({ id: taskTemplate.id, rootTemplateId: taskTemplate.rootTemplateId })
    .from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: '模板不存在',
    })
  }

  // 编辑当前档：用 templates[0] 作为本档新内容，不动 root_template_id；
  // tier_exclusive 同步更新到同组所有档（按当前 PUT 提交的值）。
  const { templates, tierExclusive } = parsed.data
  const effectiveTierExclusive = templates.length > 1 || (existing.rootTemplateId && existing.rootTemplateId !== id)
    ? tierExclusive
    : null

  await db.update(taskTemplate).set({
    ...toTemplateMutation(templates[0], effectiveTierExclusive),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(taskTemplate.id, id))

  // 主档变更 tier_exclusive 时同步给同组其他档
  const rootId = existing.rootTemplateId ?? id
  if (rootId === id && effectiveTierExclusive !== null) {
    await db.update(taskTemplate)
      .set({ tierExclusive: effectiveTierExclusive ? 1 : 0 })
      .where(eq(taskTemplate.rootTemplateId, rootId))
  }

  return {
    id,
    title: templates[0].title,
  }
})
