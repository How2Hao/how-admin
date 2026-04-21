export const DEFAULT_USER_AGENT
  = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 WAE/1.0'

export const DEFAULT_ACCOUNT_PAGE_SIZE = 5
export const DEFAULT_ARTICLE_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 20
export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_LOGIN_POLL_INTERVAL_MS = 2_000
export const SESSION_TTL_MS = 4 * 24 * 60 * 60 * 1000

export const MP_BASE_URL = 'https://mp.weixin.qq.com'
export const MP_ALLOWED_HOSTS = new Set(['mp.weixin.qq.com', 'weixin.qq.com'])
