import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { deviceTokens, users } from '../../../../drizzle/schema'

/**
 * 列出"有 active iOS device"的用户清单
 * 给推送任务的"指定用户"选择 / 标签管理的"加用户"用
 */
export default defineHandler(async () => {
  const rows = await db
    .selectDistinct({
      userId: deviceTokens.userId,
      username: users.username,
      uid6: users.uid6,
      phone: users.phone,
      lastActiveAt: sql<number>`MAX(${deviceTokens.lastActiveAt})`,
    })
    .from(deviceTokens)
    .leftJoin(users, eq(users.id, deviceTokens.userId))
    .where(and(
      eq(deviceTokens.isActive, 1),
      eq(deviceTokens.platform, 'IOS'),
      isNotNull(deviceTokens.apnsToken),
    ))
    .groupBy(deviceTokens.userId, users.username, users.uid6, users.phone)
    .orderBy(desc(sql`MAX(${deviceTokens.lastActiveAt})`))
    .limit(1000)

  return { list: rows, total: rows.length }
})
