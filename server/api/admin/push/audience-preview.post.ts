import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { resolveAudienceUserIds } from '~~/utils/audienceResolver'
import { deviceTokens } from '../../../../drizzle/schema'

interface Payload {
  audienceType: 'ALL' | 'USER_IDS' | 'TAGS'
  audienceUserIds?: number[]
  audienceTagIds?: number[]
  audienceTagOp?: 'AND' | 'OR'
}

/**
 * 预览受众规模：表单实时调用，给运营看"这一波要推给多少人 / 多少设备"
 */
export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const rule
    = body.audienceType === 'ALL'
      ? { type: 'ALL' as const }
      : body.audienceType === 'USER_IDS'
        ? { type: 'USER_IDS' as const, userIds: body.audienceUserIds ?? [] }
        : { type: 'TAGS' as const, tagIds: body.audienceTagIds ?? [], op: body.audienceTagOp === 'OR' ? 'OR' as const : 'AND' as const }

  const userIds = await resolveAudienceUserIds(rule)

  // 算设备数
  let deviceCount = 0
  if (userIds.length > 0) {
    const rows = await db.select({ id: deviceTokens.id })
      .from(deviceTokens)
      .where(and(
        eq(deviceTokens.isActive, 1),
        eq(deviceTokens.platform, 'IOS'),
        isNotNull(deviceTokens.apnsToken),
        inArray(deviceTokens.userId, userIds),
      ))
    deviceCount = rows.length
  }

  return { userCount: userIds.length, deviceCount }
})
