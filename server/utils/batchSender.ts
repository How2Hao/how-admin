import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '~~/db'
import {
  deviceTokens,
  notificationMessage,
  notificationUserInbox,
  pushTask,
  userSettings,
} from '../../drizzle/schema'
import { resolveAudienceUserIds } from './audienceResolver'
import { sendPushToDevice } from './apnsClient'
import type { NotificationPrefs } from './notificationDelivery'
import { DEFAULT_PREFS, decideDelivery, typeToSubscriptionKey } from './notificationDelivery'

const APNS_CONCURRENCY = 50

/**
 * 执行一次 push_task 的发送：
 *   1. resolveAudience 拿到候选 user_id 集合
 *   2. 批量读 user_settings.notification 做三桶分流：
 *      - 类型订阅关闭 → 写 inbox channel=INBOX_ONLY，不发 APNs（statsFilteredByType）
 *      - 总开关关闭 → 写 inbox channel=INBOX_ONLY（statsFilteredByMaster）
 *      - 正常 → 写 inbox channel=APNS + 发 APNs
 *   3. 写 1 行 notification_message
 *   4. 批量写 notification_user_inbox
 *   5. 并发 APNs 发送，直接 UPDATE inbox.delivery_*
 *   6. 汇总 stats 回填 push_task
 */
export async function executePushTask(taskId: number): Promise<{
  total: number
  inboxWritten: number
  sent: number
  failed: number
  filteredByType: number
  filteredByMaster: number
}> {
  const [task] = await db.select().from(pushTask).where(eq(pushTask.id, taskId)).limit(1)
  if (!task) throw new Error(`push_task #${taskId} 不存在`)
  if (task.status !== 'DRAFT' && task.status !== 'SCHEDULED') {
    throw new Error(`push_task #${taskId} 状态为 ${task.status}，不能发送`)
  }

  const startedAt = Date.now()
  await db.update(pushTask)
    .set({ status: 'SENDING', sentStartedAt: startedAt, updatedAt: startedAt })
    .where(eq(pushTask.id, taskId))

  try {
    // 1. 候选用户
    const audienceRule = buildAudienceRule(task)
    const userIds = await resolveAudienceUserIds(audienceRule)
    const totalAudience = userIds.length

    if (totalAudience === 0) {
      await db.update(pushTask).set({
        status: 'DONE',
        statsTotal: 0,
        statsInboxWritten: 0,
        statsSent: 0,
        statsFailed: 0,
        statsFilteredByType: 0,
        statsFilteredByMaster: 0,
        audienceSnapshotCount: 0,
        sentFinishedAt: Date.now(),
        updatedAt: Date.now(),
      }).where(eq(pushTask.id, taskId))
      return { total: 0, inboxWritten: 0, sent: 0, failed: 0, filteredByType: 0, filteredByMaster: 0 }
    }

    // 2. 批量读 user_settings.notification，分桶
    const prefsByUser = await loadNotificationPrefs(userIds)
    const subKey = typeToSubscriptionKey(task.type)

    const inboxOnlyUsers: number[] = []  // 写 inbox 不推横幅
    const apnsUsers: number[] = []       // 写 inbox + 推横幅
    let filteredByType = 0    // 类型子开关关：已写 inbox，未推横幅
    let filteredByMaster = 0  // 总开关关（类型开）：已写 inbox，未推横幅

    // 任务级「仅消息中心」：所有人都不发横幅
    const inboxOnlyMode = task.deliveryMode === 'INBOX'

    for (const uid of userIds) {
      const prefs = prefsByUser.get(uid) ?? DEFAULT_PREFS
      const { channel, suppressedBy } = inboxOnlyMode
        ? { channel: 'INBOX_ONLY' as const, suppressedBy: null }
        : decideDelivery(prefs, subKey)
      if (suppressedBy === 'TYPE') filteredByType++
      else if (suppressedBy === 'MASTER') filteredByMaster++
      if (channel === 'APNS') apnsUsers.push(uid)
      else inboxOnlyUsers.push(uid)
    }

    const inboxWrittenTotal = inboxOnlyUsers.length + apnsUsers.length

    // 3. 写 notification_message
    const [insertedMsg] = await db.insert(notificationMessage).values({
      type: task.type,
      title: task.title,
      body: task.body,
      imageUrl: task.imageUrl ?? null,
      landingType: task.landingType,
      landingPayload: task.landingPayload as any ?? null,
      sourcePushTaskId: taskId,
      targetUserId: null,
      createdAt: startedAt,
    } as any)
    const messageId = (insertedMsg as any)?.insertId as number
    if (!Number.isInteger(messageId)) throw new Error('写 notification_message 未返回 id')

    // 4. 批量写 inbox（INBOX_ONLY 桶 + APNS 桶各一批）
    if (inboxOnlyUsers.length > 0) {
      const rows = inboxOnlyUsers.map(uid => ({
        userId: uid,
        messageId,
        deliveryChannel: 'INBOX_ONLY' as const,
        deliveryStatus: 'SENT' as const,    // INBOX_ONLY 视为投递完成
        deliverySentAt: startedAt,
        createdAt: startedAt,
      }))
      for (let i = 0; i < rows.length; i += 1000) {
        await db.insert(notificationUserInbox).values(rows.slice(i, i + 1000) as any)
      }
    }
    if (apnsUsers.length > 0) {
      const rows = apnsUsers.map(uid => ({
        userId: uid,
        messageId,
        deliveryChannel: 'APNS' as const,
        deliveryStatus: 'PENDING' as const,
        deliveryAttemptedAt: startedAt,
        createdAt: startedAt,
      }))
      for (let i = 0; i < rows.length; i += 1000) {
        await db.insert(notificationUserInbox).values(rows.slice(i, i + 1000) as any)
      }
    }

    // 5. 拉 apnsUsers 的活跃 iOS device tokens，并发 APNs 发送
    const devices = apnsUsers.length === 0 ? [] : await fetchActiveDevices(apnsUsers)
    let sent = 0
    let failed = 0
    const failedUsers = new Set<number>()
    const sentUsers = new Set<number>()

    await Promise.all(chunks(devices, APNS_CONCURRENCY).map(async (group) => {
      for (const d of group) {
        if (!d.apnsToken) {
          failedUsers.add(d.userId)
          continue
        }
        const env = d.apnsEnv === 'production' ? 'production' : 'sandbox'
        const res = await sendPushToDevice(d.apnsToken, env, {
          title: task.title,
          body: task.body,
          data: {
            type: task.type,
            messageId,
            pushTaskId: taskId,
            landing: task.landingType === 'NONE' ? null : { type: task.landingType, payload: task.landingPayload },
          },
        })
        if (res.status === 'sent') {
          sentUsers.add(d.userId)
        } else {
          // 多设备时只要任一成功，就算用户级 sent
          if (!sentUsers.has(d.userId)) {
            failedUsers.add(d.userId)
          }
          // 410 Unregistered：标记此设备 token 失效，避免后续重发
          if (res.statusCode === 410 || res.reason === 'Unregistered' || res.reason === 'BadDeviceToken') {
            await db.update(deviceTokens)
              .set({ isActive: 0, updatedAt: Date.now() })
              .where(eq(deviceTokens.id, d.deviceTokenId))
          }
          // 把第一个错误记到 inbox（用户级聚合，多设备失败码用第一次的）
          await db.update(notificationUserInbox)
            .set({
              deliveryStatus: 'FAILED',
              deliveryErrorCode: res.statusCode ? String(res.statusCode) : 'apns_error',
              deliveryErrorReason: (res.reason ?? 'unknown').slice(0, 255),
              deliverySentAt: Date.now(),
            })
            .where(and(
              eq(notificationUserInbox.userId, d.userId),
              eq(notificationUserInbox.messageId, messageId),
              eq(notificationUserInbox.deliveryStatus, 'PENDING'),
            ))
        }
      }
    }))

    // 标 SENT：只要 sentUsers 包含的，把 PENDING 状态翻成 SENT
    if (sentUsers.size > 0) {
      const sentList = Array.from(sentUsers)
      for (let i = 0; i < sentList.length; i += 1000) {
        const slice = sentList.slice(i, i + 1000)
        await db.update(notificationUserInbox)
          .set({ deliveryStatus: 'SENT', deliverySentAt: Date.now() })
          .where(and(
            eq(notificationUserInbox.messageId, messageId),
            inArray(notificationUserInbox.userId, slice),
            eq(notificationUserInbox.deliveryStatus, 'PENDING'),
          ))
      }
    }

    // 处理仅 inbox 写入但没有任何 device 的 apnsUser（即 master 开但没活跃 token）
    // → 已写为 PENDING，这里 fallback 标 SENT + channel=INBOX_ONLY
    const usersWithDevice = new Set(devices.map(d => d.userId))
    const apnsUsersWithoutDevice = apnsUsers.filter(uid => !usersWithDevice.has(uid))
    if (apnsUsersWithoutDevice.length > 0) {
      for (let i = 0; i < apnsUsersWithoutDevice.length; i += 1000) {
        const slice = apnsUsersWithoutDevice.slice(i, i + 1000)
        await db.update(notificationUserInbox)
          .set({
            deliveryChannel: 'INBOX_ONLY',
            deliveryStatus: 'SENT',
            deliverySentAt: Date.now(),
          })
          .where(and(
            eq(notificationUserInbox.messageId, messageId),
            inArray(notificationUserInbox.userId, slice),
            eq(notificationUserInbox.deliveryStatus, 'PENDING'),
          ))
      }
    }

    sent = sentUsers.size
    failed = failedUsers.size

    // 6. 回填 push_task 统计
    await db.update(pushTask).set({
      status: 'DONE',
      statsTotal: totalAudience,
      statsInboxWritten: inboxWrittenTotal,
      statsSent: sent,
      statsFailed: failed,
      statsFilteredByType: filteredByType,
      statsFilteredByMaster: filteredByMaster,
      audienceSnapshotCount: totalAudience,
      sentFinishedAt: Date.now(),
      updatedAt: Date.now(),
    }).where(eq(pushTask.id, taskId))

    return {
      total: totalAudience,
      inboxWritten: inboxWrittenTotal,
      sent,
      failed,
      filteredByType,
      filteredByMaster,
    }
  } catch (e) {
    await db.update(pushTask)
      .set({ status: 'FAILED', sentFinishedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(pushTask.id, taskId))
    throw e
  }
}

function buildAudienceRule(task: typeof pushTask.$inferSelect) {
  if (task.audienceType === 'ALL') return { type: 'ALL' as const }
  if (task.audienceType === 'USER_IDS') {
    return { type: 'USER_IDS' as const, userIds: (task.audienceUserIds as number[]) ?? [] }
  }
  if (task.audienceType === 'TAGS') {
    return {
      type: 'TAGS' as const,
      tagIds: (task.audienceTagIds as number[]) ?? [],
      op: (task.audienceTagOp === 'OR' ? 'OR' : 'AND') as 'AND' | 'OR',
    }
  }
  throw new Error(`未知 audience_type: ${task.audienceType}`)
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 批量读 user_settings.settings_json.notification。
 * 不存在记录的用户视为全默认（all true）。
 */
async function loadNotificationPrefs(userIds: number[]): Promise<Map<number, NotificationPrefs>> {
  const map = new Map<number, NotificationPrefs>()
  if (userIds.length === 0) return map
  for (let i = 0; i < userIds.length; i += 1000) {
    const slice = userIds.slice(i, i + 1000)
    const rows = await db
      .select({ userId: userSettings.userId, settingsJson: userSettings.settingsJson })
      .from(userSettings)
      .where(inArray(userSettings.userId, slice))
    for (const r of rows) {
      const noti = (r.settingsJson as any)?.notification
      if (noti && typeof noti === 'object') {
        map.set(r.userId, {
          masterEnabled: typeof noti.masterEnabled === 'boolean' ? noti.masterEnabled : true,
          typeActivity: typeof noti.typeActivity === 'boolean' ? noti.typeActivity : true,
          typeAnnouncement: typeof noti.typeAnnouncement === 'boolean' ? noti.typeAnnouncement : true,
          typeFeedbackReply: typeof noti.typeFeedbackReply === 'boolean' ? noti.typeFeedbackReply : true,
          typeTaskReminder: typeof noti.typeTaskReminder === 'boolean' ? noti.typeTaskReminder : true,
        })
      }
    }
  }
  return map
}

interface DeviceRow {
  deviceTokenId: number
  userId: number
  apnsToken: string | null
  apnsEnv: string | null
}

async function fetchActiveDevices(userIds: number[]): Promise<DeviceRow[]> {
  const out: DeviceRow[] = []
  for (let i = 0; i < userIds.length; i += 1000) {
    const slice = userIds.slice(i, i + 1000)
    const rows = await db
      .select({
        deviceTokenId: deviceTokens.id,
        userId: deviceTokens.userId,
        apnsToken: deviceTokens.apnsToken,
        apnsEnv: deviceTokens.apnsEnv,
      })
      .from(deviceTokens)
      .where(and(
        eq(deviceTokens.isActive, 1),
        eq(deviceTokens.platform, 'IOS'),
        sql`${deviceTokens.apnsToken} IS NOT NULL`,
        inArray(deviceTokens.userId, slice),
      ))
    for (const r of rows) {
      out.push({
        deviceTokenId: Number(r.deviceTokenId),
        userId: r.userId,
        apnsToken: r.apnsToken,
        apnsEnv: r.apnsEnv,
      })
    }
  }
  return out
}
