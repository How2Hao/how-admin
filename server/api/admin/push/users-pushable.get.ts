import { sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'

/**
 * 列出全部用户（给推送任务「指定用户」/ 标签「加用户」选择用）。
 * 附 hasActiveDevice：是否有活跃 iOS 设备（能否额外收到横幅）；inbox 对所有人必达，故不按设备过滤。
 */
export default defineHandler(async () => {
  const raw = await db.execute(sql`
    SELECT
      u.id AS userId,
      u.username AS username,
      u.uid6 AS uid6,
      u.phone AS phone,
      MAX(CASE WHEN dt.is_active = 1 AND dt.platform = 'IOS' AND dt.apns_token IS NOT NULL THEN 1 ELSE 0 END) AS hasActiveDevice
    FROM users u
    LEFT JOIN device_tokens dt ON dt.user_id = u.id
    GROUP BY u.id, u.username, u.uid6, u.phone
    ORDER BY hasActiveDevice DESC, u.last_login_at DESC
    LIMIT 1000
  `)
  const rows = (Array.isArray(raw) && Array.isArray((raw as any)[0]) ? (raw as any)[0] : raw) as any[]
  const list = rows.map(r => ({
    userId: Number(r.userId),
    username: r.username ?? null,
    uid6: r.uid6 ?? null,
    phone: r.phone ?? null,
    hasActiveDevice: Number(r.hasActiveDevice) === 1,
  }))
  return { list, total: list.length }
})
