import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { getBankTaskCreateSchema } from '~~/utils/bankCardActivityForm'
import { toTemplateMutation } from '~~/utils/taskTemplate'
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

  const { templates, tierExclusive } = parsed.data
  const effectiveTierExclusive = templates.length > 1 ? tierExclusive : null

  const sortedTemplates = [...templates].sort((a, b) => {
    const aMin = a.minAmount ?? 0
    const bMin = b.minAmount ?? 0
    return aMin - bMin
  })

  // 第一条作为主档，先插入并拿到 id 后用作 root_template_id
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

  const [firstCreated] = await db.insert(taskTemplate).values({
    ...toTemplateMutation(sortedTemplates[0], effectiveTierExclusive),
    ...sharedFields,
  }).$returningId()
  const rootId = Number((firstCreated as { id: number }).id)

  // 主档自指 root_template_id
  await db.update(taskTemplate)
    .set({ rootTemplateId: rootId })
    .where(eq(taskTemplate.id, rootId))

  const createdIds: number[] = [rootId]

  // 其余档位 insert，root_template_id 直接指向主档
  for (let i = 1; i < sortedTemplates.length; i++) {
    const [row] = await db.insert(taskTemplate).values({
      ...toTemplateMutation(sortedTemplates[i], effectiveTierExclusive),
      rootTemplateId: rootId,
      ...sharedFields,
    }).$returningId()
    createdIds.push(Number((row as { id: number }).id))
  }

  return {
    rootId,
    ids: createdIds,
    title: sortedTemplates[0].title,
  }
})
