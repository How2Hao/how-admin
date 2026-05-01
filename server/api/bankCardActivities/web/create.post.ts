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

  const firstResult = await db.insert(taskTemplate).values({
    ...toTemplateMutation(sortedTemplates[0], effectiveTierExclusive),
    ...sharedFields,
  })

  const rootId = Number((firstResult as unknown as [{ insertId: number }])[0].insertId)
  if (!rootId) {
    throw createError({ statusCode: 500, statusMessage: '创建失败：未获取到自增 ID' })
  }

  await db.update(taskTemplate)
    .set({ rootTemplateId: rootId })
    .where(eq(taskTemplate.id, rootId))

  const createdIds: number[] = [rootId]

  for (let i = 1; i < sortedTemplates.length; i++) {
    const result = await db.insert(taskTemplate).values({
      ...toTemplateMutation(sortedTemplates[i], effectiveTierExclusive),
      rootTemplateId: rootId,
      ...sharedFields,
    })
    const id = Number((result as unknown as [{ insertId: number }])[0].insertId)
    if (id) createdIds.push(id)
  }

  return {
    rootId,
    ids: createdIds,
    title: sortedTemplates[0].title,
  }
})
