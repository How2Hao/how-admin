import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { pushTask } from '../../../../../drizzle/schema'
import { resolveAudienceUserIds } from '~~/utils/audienceResolver'

const ALLOWED_TYPES = ['ACTIVITY', 'ANNOUNCEMENT', 'FEEDBACK_REPLY', 'SYSTEM'] as const

interface CreatePayload {
  name: string
  type: typeof ALLOWED_TYPES[number]
  audienceType: 'ALL' | 'USER_IDS' | 'TAGS'
  audienceUserIds?: number[]
  audienceTagIds?: number[]
  audienceTagOp?: 'AND' | 'OR'

  title: string
  body: string
  imageUrl?: string | null

  landingType?: 'NONE' | 'DEEPLINK' | 'WEB'
  landingPayload?: Record<string, unknown> | null

  /** 'send' 立即发；'draft' 仅存草稿；'schedule' 定时（未实现） */
  action?: 'send' | 'draft' | 'schedule'
  scheduledAt?: number
  /** audienceType=ALL 时必须显式置 true（防误推全员）*/
  confirmAll?: boolean
}

/**
 * 创建推送任务。
 *   action=draft → 仅 INSERT 草稿
 *   action=send  → INSERT + 由 /tasks/:id/send 触发发送
 */
export default defineHandler(async (event) => {
  const body = await readBody<CreatePayload>(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const name = body.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: '任务名称不能为空' })

  const type = body.type
  if (!ALLOWED_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: `type 必须是 ${ALLOWED_TYPES.join('/')}` })
  }

  const title = body.title?.trim()
  const text = body.body?.trim()
  if (!title || title.length > 200) throw createError({ statusCode: 400, statusMessage: 'title 必填且 ≤ 200 字' })
  if (!text || text.length > 2000) throw createError({ statusCode: 400, statusMessage: 'body 必填且 ≤ 2000 字' })

  const audienceType = body.audienceType
  if (!['ALL', 'USER_IDS', 'TAGS'].includes(audienceType)) {
    throw createError({ statusCode: 400, statusMessage: 'audienceType 不合法' })
  }
  if (audienceType === 'ALL' && !body.confirmAll) {
    throw createError({ statusCode: 400, statusMessage: '全员推送需 confirmAll=true 二次确认' })
  }
  if (audienceType === 'USER_IDS' && (!body.audienceUserIds || body.audienceUserIds.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: '指定用户时 audienceUserIds 不能为空' })
  }
  if (audienceType === 'TAGS' && (!body.audienceTagIds || body.audienceTagIds.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: '按标签时 audienceTagIds 不能为空' })
  }

  const landingType = body.landingType ?? 'NONE'
  if (!['NONE', 'DEEPLINK', 'WEB'].includes(landingType)) {
    throw createError({ statusCode: 400, statusMessage: 'landingType 不合法' })
  }

  // 估算受众规模（快照）
  const userIds = await resolveAudienceUserIds(
    audienceType === 'ALL'
      ? { type: 'ALL' }
      : audienceType === 'USER_IDS'
        ? { type: 'USER_IDS', userIds: body.audienceUserIds! }
        : { type: 'TAGS', tagIds: body.audienceTagIds!, op: body.audienceTagOp === 'OR' ? 'OR' : 'AND' },
  )

  const now = Date.now()
  const action = body.action ?? 'draft'
  const initialStatus = action === 'schedule' ? 'SCHEDULED' : 'DRAFT'

  const adminUserId = (event.context.adminUser as any)?.id ?? null

  const [res] = await db.insert(pushTask).values({
    name,
    status: initialStatus,
    triggerSource: 'ADMIN',
    type,
    audienceType,
    audienceUserIds: body.audienceUserIds ?? null as any,
    audienceTagIds: body.audienceTagIds ?? null as any,
    audienceTagOp: body.audienceTagOp ?? null,
    audienceSnapshotCount: userIds.length,
    title,
    body: text,
    imageUrl: body.imageUrl ?? null,
    landingType,
    landingPayload: (body.landingPayload ?? null) as any,
    scheduledAt: body.scheduledAt ?? null,
    sentStartedAt: null,
    sentFinishedAt: null,
    statsTotal: 0,
    statsInboxWritten: 0,
    statsSent: 0,
    statsFailed: 0,
    statsOpened: 0,
    statsFilteredByType: 0,
    statsFilteredByMaster: 0,
    createdByAdminId: adminUserId,
    createdAt: now,
    updatedAt: now,
  } as any)
  const newId = (res as any)?.insertId as number
  if (!Number.isInteger(newId)) {
    throw createError({ statusCode: 500, statusMessage: '创建失败：未返回 id' })
  }

  return { id: newId, status: initialStatus, audienceSnapshotCount: userIds.length, type }
})
