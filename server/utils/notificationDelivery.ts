/** 用户通知偏好（来自 user_settings.settings_json.notification） */
export interface NotificationPrefs {
  masterEnabled: boolean
  typeActivity: boolean
  typeAnnouncement: boolean
  typeFeedbackReply: boolean
  typeTaskReminder: boolean
}

export const DEFAULT_PREFS: NotificationPrefs = {
  masterEnabled: true,
  typeActivity: true,
  typeAnnouncement: true,
  typeFeedbackReply: true,
  typeTaskReminder: true,
}

/** push_task.type → 子开关字段；null 表示强制下发（不看子开关） */
export function typeToSubscriptionKey(type: string): keyof NotificationPrefs | null {
  switch (type) {
    case 'ACTIVITY': return 'typeActivity'
    case 'ANNOUNCEMENT': return 'typeAnnouncement'
    case 'FEEDBACK_REPLY': return 'typeFeedbackReply'
    case 'SYSTEM': return null
    default: return null
  }
}

export type DeliveryChannel = 'APNS' | 'INBOX_ONLY'

export interface DeliveryDecision {
  channel: DeliveryChannel
  suppressedBy: 'TYPE' | 'MASTER' | null
}

/**
 * 单用户横幅模式下的投递判定：开关只挡横幅，inbox 必达。
 *   类型子开关关 → INBOX_ONLY(TYPE)；否则总开关关 → INBOX_ONLY(MASTER)；否则 APNS。
 */
export function decideDelivery(prefs: NotificationPrefs, subKey: keyof NotificationPrefs | null): DeliveryDecision {
  if (subKey && !prefs[subKey]) return { channel: 'INBOX_ONLY', suppressedBy: 'TYPE' }
  if (!prefs.masterEnabled) return { channel: 'INBOX_ONLY', suppressedBy: 'MASTER' }
  return { channel: 'APNS', suppressedBy: null }
}
