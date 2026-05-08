import { eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { getBankTaskCreateSchema } from '~~/utils/bankCardActivityForm'
import { buildRuleSourceJson, commitTemplateImages } from '~~/utils/ruleSourceImages'
import { toTemplateMutation } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  await referenceData.ensureInitialized()
  const adminUserId = event.context.adminUser?.id ?? 1
  const body = await event.req.json()
  const parsed = getBankTaskCreateSchema().safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const tpl = parsed.data
  const isNonExclusive = tpl.tierExclusive === false && tpl.tiers.length > 1

  const sharedFields = {
    highPriority: 0,
    isCompleted: 0,
    status: 'PENDING' as const,
    publisher: null,
    publishTime: null,
    likes: 0,
    addCount: 0,
    createdAt: Date.now(),
  }

  if (!isNonExclusive) {
    // 互斥多档 / 单档：1 行，tiers JSON 包含全部档位
    const inserted = await db.insert(taskTemplate).values({
      ...toTemplateMutation(tpl, adminUserId),
      ...sharedFields,
    })
    const id = Number((inserted as unknown as [{ insertId: number }])[0].insertId)
    if (!id) throw createError({ statusCode: 500, statusMessage: '创建失败：未获取到自增 ID' })

    await commitRuleSourceForRows(id, tpl, [id])

    return { id, ids: [id], title: tpl.title, groupId: tpl.groupId ?? null, tierExclusive: tpl.tierExclusive ?? null }
  }

  // 非互斥多档 fan out：按 tiers 拆 N 行，第一行 id 写回作为 groupId
  const tiers = tpl.tiers
  const createdIds: number[] = []
  for (const tier of tiers) {
    const inserted = await db.insert(taskTemplate).values({
      ...toTemplateMutation(tpl, adminUserId, { tiers: [tier] }),
      ...sharedFields,
    })
    const id = Number((inserted as unknown as [{ insertId: number }])[0].insertId)
    if (!id) throw createError({ statusCode: 500, statusMessage: '创建失败：未获取到自增 ID' })
    createdIds.push(id)
  }

  const groupId = createdIds[0]
  await db.update(taskTemplate)
    .set({ groupId })
    .where(inArray(taskTemplate.id, createdIds))

  await commitRuleSourceForRows(createdIds[0], tpl, createdIds)

  return { id: groupId, ids: createdIds, title: tpl.title, groupId, tierExclusive: false }
})

/** 创建后处理 rule_source（含上传新图）；失败不回滚 */
async function commitRuleSourceForRows(
  imageRootId: number,
  tpl: { ruleSourceImageUrls?: string[] | null; ruleSourceImageBase64s?: string[] | null; ruleSourceLinkUrl?: string | null },
  rowIds: number[],
) {
  try {
    const keptUrls = tpl.ruleSourceImageUrls ?? []
    const newBase64s = tpl.ruleSourceImageBase64s ?? []
    const finalUrls = await commitTemplateImages(imageRootId, keptUrls, newBase64s)
    const ruleSource = buildRuleSourceJson(tpl.ruleSourceLinkUrl ?? null, finalUrls)
    if (rowIds.length === 1) {
      await db.update(taskTemplate).set({ ruleSource }).where(eq(taskTemplate.id, rowIds[0]))
    }
    else {
      await db.update(taskTemplate).set({ ruleSource }).where(inArray(taskTemplate.id, rowIds))
    }
  }
  catch (e: any) {
    console.warn(`[web/create] rule_source commit failed for rows=${rowIds.join(',')}:`, e?.message ?? e)
  }
}
