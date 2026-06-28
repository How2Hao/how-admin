import { inArray } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { plazaCustomTab, taskTemplate } from '../../../drizzle/schema'

const CODE_REGEX = /^[A-Z][A-Z0-9_]{1,31}$/
const RESERVED_CODES = new Set(['FOLLOWED', 'ALL'])

interface Payload {
  code?: string
  name?: string
  logo?: string | null
  templateIds?: number[]
  sortOrder?: number
  isVisible?: number
  startTime?: number | null
  endTime?: number | null
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  const code = (body?.code ?? '').trim()
  const name = (body?.name ?? '').trim()
  const logo = (body?.logo ?? '').trim()

  if (!code) throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (!CODE_REGEX.test(code)) throw createError({ statusCode: 400, statusMessage: 'code 格式不合法：^[A-Z][A-Z0-9_]{1,31}$' })
  if (RESERVED_CODES.has(code)) throw createError({ statusCode: 400, statusMessage: `code 不能使用保留字 ${code}` })
  // 三形态兼容：name 与 logo 至少填一个（纯图片 tab 可不填 name）
  if (!name && !logo) throw createError({ statusCode: 400, statusMessage: 'name 与 logo 至少填一个' })
  if (name.length > 20) throw createError({ statusCode: 400, statusMessage: 'name 不能超过 20 个字符' })

  const templateIds = Array.isArray(body?.templateIds) ? body!.templateIds.filter(v => Number.isInteger(v) && v > 0) : []
  if (templateIds.length === 0) throw createError({ statusCode: 400, statusMessage: 'templateIds 不能为空' })

  const existing = await db
    .select({ id: taskTemplate.id })
    .from(taskTemplate)
    .where(inArray(taskTemplate.id, templateIds))
  const existingSet = new Set(existing.map(r => r.id))
  const missing = templateIds.filter(id => !existingSet.has(id))
  if (missing.length > 0) throw createError({ statusCode: 400, statusMessage: `templateId 不存在: ${missing.join(',')}` })

  const startTime = body?.startTime ?? null
  const endTime = body?.endTime ?? null
  if (startTime != null && endTime != null && startTime >= endTime)
    throw createError({ statusCode: 400, statusMessage: 'startTime 必须早于 endTime' })

  const now = Date.now()
  try {
    const result = await db.insert(plazaCustomTab).values({
      code,
      name,
      logo: logo || null,
      templateIds,
      sortOrder: body?.sortOrder ?? 0,
      isVisible: body?.isVisible ?? 1,
      startTime,
      endTime,
      createdAt: now,
      updatedAt: now,
    })
    const id = Number((result as unknown as [{ insertId: number }])[0].insertId)
    return { id }
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }
})
