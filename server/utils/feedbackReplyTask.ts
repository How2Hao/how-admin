/** 反馈回复推送的固定标题 */
export const FEEDBACK_REPLY_TITLE = '管理员已回复你的反馈'

export interface FeedbackReplyTaskInput {
  userId: number
  feedbackId: number
  resolutionNote: string
  adminId: number | null
  now: number
}

/**
 * 构造一条「反馈回复」push_task 插入值：
 *   单用户、APNS（横幅+消息中心）、deeplink 到 ha 反馈历史页 /feedback。
 * 返回普通对象交给 db.insert(pushTask).values(...)；不引 DB，便于单测。
 */
export function buildFeedbackReplyTaskValues(input: FeedbackReplyTaskInput) {
  const { userId, feedbackId, resolutionNote, adminId, now } = input
  return {
    name: `反馈回复 #${feedbackId}`,
    status: 'DRAFT' as const,
    triggerSource: 'FEEDBACK' as const,
    type: 'FEEDBACK_REPLY' as const,
    deliveryMode: 'APNS' as const,
    audienceType: 'USER_IDS' as const,
    audienceUserIds: [userId],
    audienceTagIds: null,
    audienceTagOp: null,
    audienceSnapshotCount: 1,
    title: FEEDBACK_REPLY_TITLE,
    body: resolutionNote.slice(0, 2000),
    imageUrl: null,
    landingType: 'DEEPLINK' as const,
    landingPayload: { route: '/feedback', params: { feedbackId } },
    scheduledAt: null,
    sentStartedAt: null,
    sentFinishedAt: null,
    statsTotal: 0,
    statsInboxWritten: 0,
    statsSent: 0,
    statsFailed: 0,
    statsOpened: 0,
    statsFilteredByType: 0,
    statsFilteredByMaster: 0,
    createdByAdminId: adminId,
    createdAt: now,
    updatedAt: now,
  }
}
