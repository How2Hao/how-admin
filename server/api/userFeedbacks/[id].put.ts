import { and, eq, isNotNull } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { sendPushToDevice } from '~~/utils/apnsClient'
import { deviceTokens, notificationMessage, notificationUserInbox, userFeedback } from '../../../drizzle/schema'

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

  // 反馈被回复时通知用户（仅当 状态变为 RESOLVED + 有 resolutionNote + 之前不是 RESOLVED）
  if (
    status === 'RESOLVED'
    && resolutionNote
    && existing.prevStatus !== 'RESOLVED'
    && existing.userId
  ) {
    try {
      await notifyFeedbackResolved(existing.userId, id, resolutionNote)
    }
    catch (e: any) {
      console.error('[feedback resolve push] failed:', e?.message ?? e)
      // 不阻塞主流程
    }
  }

  return { id, success: true }
})

/**
 * 反馈被回复时：写 inbox + 给该用户所有 active iOS 设备推送
 * 复用 audienceResolver 思路，简化版（仅 1 个用户）
 */
async function notifyFeedbackResolved(userId: number, feedbackId: number, resolutionNote: string) {
  const now = Date.now()
  const title = '管理员已回复你的反馈'
  const body = resolutionNote.slice(0, 200)

  // 1) 写 notification_message
  const [insertedMsg] = await db.insert(notificationMessage).values({
    type: 'FEEDBACK_REPLY',
    title,
    body,
    imageUrl: null,
    landingType: 'DEEPLINK',
    landingPayload: { route: '/profile/feedback', params: { feedbackId } } as any,
    sourcePushTaskId: null,
    targetUserId: userId,
    createdAt: now,
  } as any)
  const messageId = (insertedMsg as any)?.insertId as number

  // 2) 写 notification_user_inbox
  await db.insert(notificationUserInbox).values({
    userId,
    messageId,
    readAt: null,
    archivedAt: null,
    createdAt: now,
  } as any)

  // 3) 给该用户所有 active iOS 设备发 APNs
  const devices = await db.select({
    apnsToken: deviceTokens.apnsToken,
    apnsEnv: deviceTokens.apnsEnv,
  }).from(deviceTokens).where(and(
    eq(deviceTokens.userId, userId),
    eq(deviceTokens.isActive, 1),
    eq(deviceTokens.platform, 'IOS'),
    isNotNull(deviceTokens.apnsToken),
  ))

  await Promise.all(devices.map(d =>
    sendPushToDevice(d.apnsToken!, d.apnsEnv === 'production' ? 'production' : 'sandbox', {
      title,
      body,
      data: {
        type: 'FEEDBACK_REPLY',
        messageId,
        feedbackId,
        landing: { type: 'DEEPLINK', payload: { route: '/profile/feedback', params: { feedbackId } } },
      },
    }),
  ))
}
