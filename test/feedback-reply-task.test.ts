import { describe, expect, it } from 'vitest'
import { FEEDBACK_REPLY_TITLE, buildFeedbackReplyTaskValues } from '../server/utils/feedbackReplyTask'

describe('buildFeedbackReplyTaskValues', () => {
  const now = 1_700_000_000_000

  it('builds a single-user APNS FEEDBACK_REPLY draft with deeplink to /feedback', () => {
    const v = buildFeedbackReplyTaskValues({ userId: 42, feedbackId: 7, resolutionNote: '已修复，请下拉刷新', adminId: 3, now })
    expect(v.type).toBe('FEEDBACK_REPLY')
    expect(v.triggerSource).toBe('FEEDBACK')
    expect(v.deliveryMode).toBe('APNS')
    expect(v.status).toBe('DRAFT')
    expect(v.audienceType).toBe('USER_IDS')
    expect(v.audienceUserIds).toEqual([42])
    expect(v.title).toBe(FEEDBACK_REPLY_TITLE)
    expect(v.body).toBe('已修复，请下拉刷新')
    expect(v.landingType).toBe('DEEPLINK')
    expect(v.landingPayload).toEqual({ route: '/feedback', params: { feedbackId: 7 } })
    expect(v.name).toBe('反馈回复 #7')
    expect(v.createdByAdminId).toBe(3)
    expect(v.createdAt).toBe(now)
    expect(v.updatedAt).toBe(now)
  })

  it('truncates body to 2000 chars and tolerates null adminId', () => {
    const long = 'x'.repeat(2500)
    const v = buildFeedbackReplyTaskValues({ userId: 1, feedbackId: 2, resolutionNote: long, adminId: null, now })
    expect(v.body.length).toBe(2000)
    expect(v.createdByAdminId).toBeNull()
  })
})
