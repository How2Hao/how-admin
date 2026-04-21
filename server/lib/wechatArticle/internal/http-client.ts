import type { BaseResp } from '../types'
import type { SessionStore } from './session-store'
import { Buffer } from 'node:buffer'
import fetchCookie from 'fetch-cookie'
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, MP_BASE_URL } from '../constants'
import { WechatArticleError } from '../errors'
import { getTimeout, toFormValue, toQueryValue } from './utils'

interface RequestOptions {
  method?: 'GET' | 'POST'
  headers?: HeadersInit
  query?: Record<string, string | number | undefined>
  body?: Record<string, string | number | undefined> | URLSearchParams
  redirect?: RequestRedirect
}

export class WechatHttpClient {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    private readonly userAgent = DEFAULT_USER_AGENT,
  ) {}

  async requestJson<T>(url: string, options: RequestOptions = {}) {
    const response = await this.request(url, options)
    const data = (await response.json()) as T
    return data
  }

  async requestText(url: string, options: RequestOptions = {}) {
    const response = await this.request(url, options)
    return response.text()
  }

  async requestBuffer(url: string, options: RequestOptions = {}) {
    const response = await this.request(url, options)
    return Buffer.from(await response.arrayBuffer())
  }

  async request(url: string, options: RequestOptions = {}) {
    const cookieAwareFetch = fetchCookie(globalThis.fetch, this.sessionStore.jar)
    const requestUrl = new URL(url, MP_BASE_URL)

    for (const [key, value] of Object.entries(toQueryValue(options.query ?? {}))) {
      requestUrl.searchParams.set(key, value)
    }

    const headers = new Headers(options.headers)
    headers.set('Referer', headers.get('Referer') ?? `${MP_BASE_URL}/`)
    headers.set('Origin', headers.get('Origin') ?? MP_BASE_URL)
    headers.set('User-Agent', headers.get('User-Agent') ?? this.userAgent)
    headers.set('Accept-Encoding', headers.get('Accept-Encoding') ?? 'identity')

    let body: BodyInit | null = null
    if (options.body) {
      body = options.body instanceof URLSearchParams ? options.body : toFormValue(options.body)
      headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
    }

    const response = await cookieAwareFetch(requestUrl.toString(), {
      method: options.method ?? 'GET',
      headers,
      body,
      redirect: options.redirect ?? 'follow',
      signal: AbortSignal.timeout(getTimeout(this.timeoutMs)),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new WechatArticleError('DOWNLOAD_FAILED', `Request failed with status ${response.status}`, {
        details: {
          url: requestUrl.toString(),
          body: text,
        },
      })
    }

    return response
  }

  ensureOk(baseResp: BaseResp | undefined, code: 'ACCOUNT_SEARCH_FAILED' | 'ARTICLE_LIST_FAILED' | 'LOGIN_FAILED') {
    if (!baseResp) {
      throw new WechatArticleError(code, 'Invalid WeChat response: missing base_resp')
    }

    if (baseResp.ret === 0) {
      return
    }

    throw new WechatArticleError(code, `${baseResp.ret}:${baseResp.err_msg}`)
  }
}
