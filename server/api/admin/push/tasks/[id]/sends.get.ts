import { and, desc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import {
  notificationMessage,
  notificationUserInbox,
  users,
} from '../../../../../../drizzle/schema'

/**
 * 某 push_task 的投递明细：从 notification_user_inbox JOIN message JOIN users 查。
 * 兼容旧路径名 sends.get，逻辑上读的是 inbox。
 */
export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'task id 不合法' })

  const url = new URL(event.req.url ?? '', 'http://localhost')
  const statusFilter = url.searchParams.get('status')?.trim() ?? ''

  const rows = await db
    .select({
      id: notificationUserInbox.id,
      userId: notificationUserInbox.userId,
      username: users.username,
      uid6: users.uid6,
      channel: notificationUserInbox.deliveryChannel,
      status: notificationUserInbox.deliveryStatus,
      errorCode: notificationUserInbox.deliveryErrorCode,
      errorReason: notificationUserInbox.deliveryErrorReason,
      attemptedAt: notificationUserInbox.deliveryAttemptedAt,
      sentAt: notificationUserInbox.deliverySentAt,
      readAt: notificationUserInbox.readAt,
      openedVia: notificationUserInbox.openedVia,
    })
    .from(notificationUserInbox)
    .innerJoin(notificationMessage, eq(notificationMessage.id, notificationUserInbox.messageId))
    .leftJoin(users, eq(users.id, notificationUserInbox.userId))
    .where(eq(notificationMessage.sourcePushTaskId, id))
    .orderBy(desc(notificationUserInbox.id))
    .limit(1000)

  const filtered = statusFilter ? rows.filter(r => r.status === statusFilter) : rows

  // 按 delivery_status 聚合（看板用）
  const summary: Record<string, number> = {}
  for (const r of rows) {
    const k = r.status ?? 'UNKNOWN'
    summary[k] = (summary[k] ?? 0) + 1
  }

  return { list: filtered, total: filtered.length, summary }
})
