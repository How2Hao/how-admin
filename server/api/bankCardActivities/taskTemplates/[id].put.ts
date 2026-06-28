import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { getBankTaskCreateSchema } from '~~/utils/bankCardActivityForm'
import { buildRuleSourceJson, commitTemplateImages } from '~~/utils/ruleSourceImages'
import { parseTaskTemplateId, syncTaskTemplateJobTemplate, toTemplateMutation } from '~~/utils/taskTemplate'
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

  const [existing] = await db.select({
    id: taskTemplate.id,
    jobTemplateId: taskTemplate.jobTemplateId,
  })
    .from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: '模板不存在',
    })
  }

  const tpl = parsed.data

  await db.update(taskTemplate).set({
    ...toTemplateMutation(tpl),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(taskTemplate.id, id))
  await syncTaskTemplateJobTemplate(id, existing.jobTemplateId, tpl.jobTemplateId ?? null)

  // 编辑路径同样支持新增/删除原图：keptUrls + base64s 合并写到本行 rule_source
  try {
    const keptUrls = tpl.ruleSourceImageUrls ?? []
    const newBase64s = tpl.ruleSourceImageBase64s ?? []
    const finalUrls = await commitTemplateImages(id, keptUrls, newBase64s)
    const ruleSource = buildRuleSourceJson(tpl.ruleSourceLinkUrl ?? null, finalUrls)
    await db.update(taskTemplate).set({ ruleSource }).where(eq(taskTemplate.id, id))
  }
  catch (e: any) {
    console.warn(`[taskTemplates PUT] rule_source commit failed for id=${id}:`, e?.message ?? e)
  }

  return {
    id,
    title: tpl.title,
    groupId: tpl.groupId ?? null,
  }
})
