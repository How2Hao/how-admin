import { inArray, sql } from 'drizzle-orm'
import { db } from '~~/db'
import { pushUserTag, users } from '../../drizzle/schema'

export type AudienceRule =
  | { type: 'ALL' }
  | { type: 'USER_IDS', userIds: number[] }
  | { type: 'TAGS', tagIds: number[], op: 'AND' | 'OR' }


// resolveAudienceDevices 已废弃：batchSender 直接走 resolveAudienceUserIds + 内部 fetchActiveDevices

/**
 * 仅算出"目标用户 id 列表"，不区分设备数（用于受众预览 / 写 inbox）
 */
export async function resolveAudienceUserIds(rule: AudienceRule): Promise<number[]> {
  if (rule.type === 'ALL') {
    // ALL = 所有注册用户。没活跃 iOS token 的用户只写 inbox（INBOX_ONLY 通道），
    // 这样 ha 端打开后仍能看到消息。如果运营只想推给"有 token"的用户，
    // 走 TAGS 自己圈一份。
    const rows = await db
      .select({ userId: users.id })
      .from(users)
    return rows.map(r => r.userId)
  }

  if (rule.type === 'USER_IDS') {
    return rule.userIds.filter(id => Number.isInteger(id) && id > 0)
  }

  if (rule.type === 'TAGS') {
    if (rule.tagIds.length === 0) return []
    if (rule.op === 'OR') {
      // OR：命中任一标签
      const rows = await db
        .selectDistinct({ userId: pushUserTag.userId })
        .from(pushUserTag)
        .where(inArray(pushUserTag.tagId, rule.tagIds))
      return rows.map(r => r.userId)
    }
    else {
      // AND：必须命中所有标签 → HAVING COUNT(DISTINCT tag_id) = N
      const rows = await db
        .select({ userId: pushUserTag.userId })
        .from(pushUserTag)
        .where(inArray(pushUserTag.tagId, rule.tagIds))
        .groupBy(pushUserTag.userId)
        .having(sql`COUNT(DISTINCT ${pushUserTag.tagId}) = ${rule.tagIds.length}`)
      return rows.map(r => r.userId)
    }
  }

  return []
}
