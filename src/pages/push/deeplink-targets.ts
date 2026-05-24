export interface DeeplinkTarget {
  key: string
  label: string
  route: string
  /** 该页支持的参数；目前仅 plazaCustomTab（活动 code）。无参则省略 */
  param?: { key: string, label: string, source: 'plazaCustomTab', required: boolean }
}

export const DEEPLINK_TARGETS: DeeplinkTarget[] = [
  { key: 'card-pack', label: '卡包', route: '/card-pack' },
  { key: 'task', label: '任务', route: '/task' },
  { key: 'plaza', label: '活动广场', route: '/plaza', param: { key: 'code', label: '活动 Tab', source: 'plazaCustomTab', required: false } },
  { key: 'finance', label: '财务', route: '/finance' },
  { key: 'mine', label: '我的', route: '/settings' },
  { key: 'feedback', label: '意见反馈', route: '/feedback' },
  { key: 'inbox', label: '消息中心', route: '/inbox' },
  { key: 'changelog', label: '版本记录', route: '/changelog' },
  { key: 'contact', label: '联系客服', route: '/contact' },
]

export interface RouteLandingPayload {
  type: 'route'
  route: string
  params?: Record<string, string>
}

/** 由所选目标 + 参数值构造 route 落地 payload；无 param 声明或值为空则不带 params */
export function buildRoutePayload(target: DeeplinkTarget, paramValue: string): RouteLandingPayload {
  const payload: RouteLandingPayload = { type: 'route', route: target.route }
  if (target.param && paramValue)
    payload.params = { [target.param.key]: paramValue }
  return payload
}
