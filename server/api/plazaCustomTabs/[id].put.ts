import { eq, inArray } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { plazaCustomTab, taskTemplate } from '../../../drizzle/schema'

interface Payload {
  name?: string
  logo?: string | null
  templateIds?: number[]
  isVisible?: number
  startTime?: number | null
  endTime?: number | null
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const [existing] = await db.select().from(plazaCustomTab).where(eq(plazaCustomTab.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'tab 不存在' })

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })
    if (name.length > 20) throw createError({ statusCode: 400, statusMessage: 'name 不能超过 20 个字符' })
    update.name = name
  }
  if ('logo' in body) update.logo = body.logo ?? null
  if (body.templateIds !== undefined) {
    const ids = body.templateIds.filter(v => Number.isInteger(v) && v > 0)
    if (ids.length === 0) throw createError({ statusCode: 400, statusMessage: 'templateIds 不能为空' })
    const rows = await db.select({ id: taskTemplate.id }).from(taskTemplate).where(inArray(taskTemplate.id, ids))
    const set = new Set(rows.map(r => r.id))
    const missing = ids.filter(i => !set.has(i))
    if (missing.length > 0) throw createError({ statusCode: 400, statusMessage: `templateId 不存在: ${missing.join(',')}` })
    update.templateIds = ids
  }
  if (body.isVisible !== undefined) update.isVisible = body.isVisible ? 1 : 0
  if ('startTime' in body) update.startTime = body.startTime ?? null
  if ('endTime' in body) update.endTime = body.endTime ?? null

  const finalStart = ('startTime' in body ? body.startTime : existing.startTime) ?? null
  const finalEnd = ('endTime' in body ? body.endTime : existing.endTime) ?? null
  if (finalStart != null && finalEnd != null && finalStart >= finalEnd)
    throw createError({ statusCode: 400, statusMessage: 'startTime 必须早于 endTime' })

  if (Object.keys(update).length === 0) return { ok: true }
  update.updatedAt = Date.now()

  await db.update(plazaCustomTab).set(update).where(eq(plazaCustomTab.id, id))
  return { ok: true }
})
