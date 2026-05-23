import path from 'node:path'
import process from 'node:process'
import apn from 'apn'

/**
 * APNs provider 单例缓存：同一 .p8 通用 Sandbox & Production，但 endpoint 不同，
 * 因此按 production 标志缓存两个 provider 实例（按需 lazy 创建）。
 */
const providerCache = new Map<boolean, apn.Provider>()

function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim())
    throw new Error(`APNs 缺少环境变量 ${name}`)
  return v.trim()
}

function resolveKeyPath(): string {
  const raw = envOrThrow('APNS_KEY_PATH')
  if (path.isAbsolute(raw)) return raw
  // 相对路径基于 admin 项目根
  return path.resolve(process.cwd(), raw)
}

export function getApnsProvider(production: boolean): apn.Provider {
  const cached = providerCache.get(production)
  if (cached) return cached

  const provider = new apn.Provider({
    token: {
      key: resolveKeyPath(),
      keyId: envOrThrow('APNS_KEY_ID'),
      teamId: envOrThrow('APNS_TEAM_ID'),
    },
    production,
  })
  providerCache.set(production, provider)
  return provider
}

export interface SendResult {
  apnsToken: string
  status: 'sent' | 'failed'
  reason?: string
  statusCode?: number
}

export interface SendPayload {
  title: string
  body: string
  /** APP 内深链 / 业务参数，原样下发 */
  data?: Record<string, unknown>
}

/**
 * 给一台设备发推送。
 * @param env 'sandbox' | 'production'，对应 dev / 上线后两套 endpoint
 */
export async function sendPushToDevice(
  apnsToken: string,
  env: 'sandbox' | 'production',
  payload: SendPayload,
): Promise<SendResult> {
  const provider = getApnsProvider(env === 'production')
  const note = new apn.Notification({
    alert: { title: payload.title, body: payload.body },
    topic: envOrThrow('APNS_BUNDLE_ID'),
    sound: 'default',
    payload: payload.data ?? {},
  })
  try {
    const result = await provider.send(note, apnsToken)
    if (result.failed.length > 0) {
      const f = result.failed[0]
      return {
        apnsToken,
        status: 'failed',
        reason: f.response?.reason ?? f.error?.message ?? 'unknown',
        statusCode: f.status ? Number(f.status) : undefined,
      }
    }
    return { apnsToken, status: 'sent' }
  }
  catch (e: any) {
    return { apnsToken, status: 'failed', reason: e?.message ?? String(e) }
  }
}
