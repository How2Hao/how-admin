import type { ErrorCode } from './types'

interface WechatArticleErrorOptions {
  cause?: unknown
  details?: unknown
}

export class WechatArticleError extends Error {
  public readonly code: ErrorCode
  public readonly details?: unknown

  constructor(code: ErrorCode, message: string, options: WechatArticleErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = 'WechatArticleError'
    this.code = code
    this.details = options.details
  }
}
