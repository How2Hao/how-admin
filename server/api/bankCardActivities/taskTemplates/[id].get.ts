import { asc, eq, or } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseTaskTemplateId, toTaskTemplateGroupEntry } from '~~/utils/taskTemplate'
import { taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseTaskTemplateId(event.context.params?.id)

  const [row] = await db.select().from(taskTemplate).where(eq(taskTemplate.id, id)).limit(1)
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: '模板不存在',
    })
  }

  const rootId = row.rootTemplateId ?? row.id

  const rows = await db
    .select()
    .from(taskTemplate)
    .where(or(eq(taskTemplate.id, rootId), eq(taskTemplate.rootTemplateId, rootId)))
    .orderBy(asc(taskTemplate.id))

  const firstRow = rows[0]
  const tierExclusive = firstRow?.tierExclusive === null || firstRow?.tierExclusive === undefined
    ? null
    : Number(firstRow.tierExclusive) === 1

  return {
    id: rootId,
    tierExclusive,
    templates: rows.map(toTaskTemplateGroupEntry),
  }
})
