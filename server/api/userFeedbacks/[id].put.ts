import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { executePushTask } from '~~/utils/batchSender'
import { buildFeedbackReplyTaskValues } from '~~/utils/feedbackReplyTask'
import { pushTask, userFeedback } from '../../../drizzle/schema'

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
    notifyUser?: boolean
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
    .select({ id: userFeedback.id, userId: userFeedback.userId, prevStatus: userFeedback.status })
    .from(userFeedback)
    .where(eq(userFeedback.id, id))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '反馈不存在' })
  }

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

  // 显式通知：运营勾选「通知用户」且有回复说明时，复用推送任务能力下发
  if (body?.notifyUser === true && resolutionNote && existing.userId) {
    try {
      await sendFeedbackReplyPush(existing.userId, id, resolutionNote, event)
    }
    catch (e: any) {
      console.error('[feedback reply push] failed:', e?.message ?? e)
      // 不阻塞主流程：反馈状态已保存
    }
  }

  return { id, success: true }
})

/**
 * 反馈回复推送：建一条单用户 FEEDBACK_REPLY push_task，再走标准 executePushTask。
 * inbox 必达由 batchSender 统一语义保证（关推送/子开关仅不推横幅）。
 */
async function sendFeedbackReplyPush(userId: number, feedbackId: number, resolutionNote: string, event: any) {
  const adminId = (event.context.adminUser as any)?.id ?? null
  const values = buildFeedbackReplyTaskValues({ userId, feedbackId, resolutionNote, adminId, now: Date.now() })
  const [res] = await db.insert(pushTask).values(values as any)
  const taskId = (res as any)?.insertId as number
  if (!Number.isInteger(taskId)) throw new Error('创建反馈回复 push_task 未返回 id')
  await executePushTask(taskId)
}
