import { describe, expect, it } from 'vitest'
import { decideDelivery, typeToSubscriptionKey } from '../server/utils/notificationDelivery'
import type { NotificationPrefs } from '../server/utils/notificationDelivery'

const base: NotificationPrefs = {
  masterEnabled: true,
  typeActivity: true,
  typeAnnouncement: true,
  typeFeedbackReply: true,
  typeTaskReminder: true,
}

describe('typeToSubscriptionKey', () => {
  it('maps known types and force-delivers SYSTEM/unknown', () => {
    expect(typeToSubscriptionKey('FEEDBACK_REPLY')).toBe('typeFeedbackReply')
    expect(typeToSubscriptionKey('ACTIVITY')).toBe('typeActivity')
    expect(typeToSubscriptionKey('SYSTEM')).toBeNull()
    expect(typeToSubscriptionKey('WHATEVER')).toBeNull()
  })
})

describe('decideDelivery', () => {
  it('both switches on → APNS', () => {
    expect(decideDelivery(base, 'typeFeedbackReply')).toEqual({ channel: 'APNS', suppressedBy: null })
  })
  it('type switch off → INBOX_ONLY (TYPE)', () => {
    expect(decideDelivery({ ...base, typeFeedbackReply: false }, 'typeFeedbackReply'))
      .toEqual({ channel: 'INBOX_ONLY', suppressedBy: 'TYPE' })
  })
  it('master off but type on → INBOX_ONLY (MASTER)', () => {
    expect(decideDelivery({ ...base, masterEnabled: false }, 'typeFeedbackReply'))
      .toEqual({ channel: 'INBOX_ONLY', suppressedBy: 'MASTER' })
  })
  it('type off precedence over master off', () => {
    expect(decideDelivery({ ...base, masterEnabled: false, typeFeedbackReply: false }, 'typeFeedbackReply'))
      .toEqual({ channel: 'INBOX_ONLY', suppressedBy: 'TYPE' })
  })
  it('subKey null respects master only', () => {
    expect(decideDelivery(base, null)).toEqual({ channel: 'APNS', suppressedBy: null })
    expect(decideDelivery({ ...base, masterEnabled: false }, null))
      .toEqual({ channel: 'INBOX_ONLY', suppressedBy: 'MASTER' })
  })
})
