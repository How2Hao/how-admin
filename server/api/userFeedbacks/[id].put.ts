import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { userFeedback } from '../../../drizzle/schema'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX'] as const
const RESOLUTION_TYPES = ['NONE', 'NO_UPDATE', 'NEEDS_UPDATE'] as const

type Status = typeof STATUSES[number]
type ResolutionType = typeof RESOLUTION_TYPES[number]

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '反馈 ID 不合法' })
  }

  const body = await readBody<{
    status?: string
    resolutionType?: string
    minAppVersion?: string | null
    resolutionNote?: string | null
  }>(event)

  const status = body?.status as Status | undefined
  if (!status || !STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'status 不合法' })
  }

  const resolutionType = (body?.resolutionType ?? 'NONE') as ResolutionType
  if (!RESOLUTION_TYPES.includes(resolutionType)) {
    throw createError({ statusCode: 400, statusMessage: 'resolutionType 不合法' })
  }

  if (resolutionType === 'NEEDS_UPDATE' && !body?.minAppVersion?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: '需更新时必须填写最低版本号 minAppVersion',
    })
  }

  const minAppVersion = resolutionType === 'NEEDS_UPDATE'
    ? (body?.minAppVersion ?? '').trim() || null
    : null

  const resolutionNote = body?.resolutionNote?.trim()
    ? body.resolutionNote.trim().slice(0, 500)
    : null

  const [existing] = await db
    .select({ id: userFeedback.id })
    .from(userFeedback)
    .where(eq(userFeedback.id, id))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '反馈不存在' })
  }

  // RESOLVED / WONT_FIX 视为终态，自动落 resolved_at；
  // 状态改回 OPEN/IN_PROGRESS 时清空 resolved_at（让"重新打开 issue"可被时间戳反映）
  const isTerminal = status === 'RESOLVED' || status === 'WONT_FIX'
  const resolvedAt = isTerminal ? Date.now() : null

  await db
    .update(userFeedback)
    .set({
      status,
      resolutionType,
      minAppVersion,
      resolutionNote,
      resolvedAt,
    })
    .where(eq(userFeedback.id, id))

  return { id, success: true }
})
