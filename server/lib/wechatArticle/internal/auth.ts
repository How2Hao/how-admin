import type { BaseResp, LoginOptions, LoginResult, LoginStatus, QrCodePayload } from '../types'
import type { WechatHttpClient } from './http-client'
import type { SessionStore } from './session-store'
import { DEFAULT_LOGIN_POLL_INTERVAL_MS, MP_BASE_URL, SESSION_TTL_MS } from '../constants'
import { WechatArticleError } from '../errors'
import { getLoginControllerState, isLoginController, LoginController } from '../LoginController'
import { bufferToDataUrl, createSid, sleep, writeQrCodeFile } from './utils'

interface StartLoginResult {
  base_resp: BaseResp
}

interface ScanLoginResult {
  base_resp: BaseResp
  status: number
  acct_size: number
  binduin: string
}

interface BizLoginResponse {
  base_resp?: BaseResp
  redirect_url?: string
}

export class AuthService {
  constructor(
    private readonly http: WechatHttpClient,
    private readonly sessionStore: SessionStore,
    private readonly defaultPollIntervalMs = DEFAULT_LOGIN_POLL_INTERVAL_MS,
  ) {}

  async login(options: LoginOptions = {}): Promise<LoginResult> {
    const controller = await this.startLogin()
    await this.getQrcode(controller)
    const qrPayload = this.getQrCodePayload(controller)

    if (options.onQrCode) {
      await options.onQrCode(qrPayload)
    }
    else {
      console.info(`[wechat-article] QR code saved to ${qrPayload.path}`)
    }

    const pollIntervalMs = options.pollIntervalMs ?? this.defaultPollIntervalMs
    while (true) {
      await sleep(pollIntervalMs)
      const status = await this.checkLoginStatus(controller)

      if (status === 'confirmed') {
        return this.finishLogin(controller)
      }

      if (status === 'expired') {
        throw new WechatArticleError('QR_EXPIRED', 'QR code expired before the login was confirmed')
      }

      if (status === 'canceled') {
        throw new WechatArticleError('LOGIN_CANCELED', 'Login has been canceled')
      }
    }
  }

  async startLogin(): Promise<LoginController> {
    const sid = createSid()
    await this.startLoginSession(sid)
    return new LoginController(sid)
  }

  async getQrcode(controller: LoginController): Promise<string> {
    this.ensureUsableController(controller)

    const qrBuffer = await this.http.requestBuffer(`${MP_BASE_URL}/cgi-bin/scanloginqrcode`, {
      query: {
        action: 'getqrcode',
        random: Date.now(),
      },
    })

    const qrCodePayload: QrCodePayload = {
      sid: controller.sid,
      buffer: qrBuffer,
      dataUrl: bufferToDataUrl(qrBuffer),
      path: writeQrCodeFile(controller.sid, qrBuffer),
    }

    const state = getLoginControllerState(controller)
    state.qrCodePayload = qrCodePayload
    return qrBuffer.toString('base64')
  }

  async checkLoginStatus(controller: LoginController): Promise<LoginStatus> {
    this.ensureController(controller)

    const state = getLoginControllerState(controller)
    if (state.canceled) {
      return 'canceled'
    }

    if (state.completed) {
      return 'confirmed'
    }

    const scanResult = await this.http.requestJson<ScanLoginResult>(`${MP_BASE_URL}/cgi-bin/scanloginqrcode`, {
      query: {
        action: 'ask',
        token: '',
        lang: 'zh_CN',
        f: 'json',
        ajax: 1,
      },
    })

    if (scanResult.base_resp.ret !== 0) {
      throw new WechatArticleError('LOGIN_FAILED', scanResult.base_resp.err_msg || 'Polling login status failed')
    }

    if (scanResult.status === 1) {
      state.lastStatus = 'confirmed'
      return 'confirmed'
    }

    if (scanResult.status === 2 || scanResult.status === 3) {
      state.lastStatus = 'expired'
      return 'expired'
    }

    if (scanResult.status === 5) {
      throw new WechatArticleError('LOGIN_FAILED', 'This WeChat account has not bound an email address')
    }

    if ((scanResult.status === 4 || scanResult.status === 6) && scanResult.acct_size < 1) {
      throw new WechatArticleError('LOGIN_FAILED', 'No available official account can be used for login')
    }

    if (scanResult.status === 4 || scanResult.status === 6) {
      state.lastStatus = 'scanned'
      return 'scanned'
    }

    state.lastStatus = 'pending'
    return 'pending'
  }

  async finishLogin(controller: LoginController): Promise<LoginResult> {
    this.ensureUsableController(controller)

    const response = await this.http.requestJson<BizLoginResponse>(`${MP_BASE_URL}/cgi-bin/bizlogin`, {
      method: 'POST',
      query: {
        action: 'login',
      },
      body: {
        userlang: 'zh_CN',
        redirect_url: '',
        cookie_forbidden: 0,
        cookie_cleaned: 0,
        plugin_used: 0,
        login_type: 3,
        token: '',
        lang: 'zh_CN',
        f: 'json',
        ajax: 1,
      },
    })

    const result = await this.resolveLoginResult(response)
    const state = getLoginControllerState(controller)
    state.completed = true
    state.lastStatus = 'confirmed'
    return result
  }

  async logout() {
    if (this.sessionStore.token) {
      try {
        await this.http.request(`${MP_BASE_URL}/cgi-bin/logout`, {
          query: {
            t: 'wxm-logout',
            token: this.sessionStore.token,
            lang: 'zh_CN',
          },
        })
      }
      catch {
        // Ignore network errors here; we still clear the local session.
      }
    }

    this.sessionStore.clear()
  }

  private async startLoginSession(sid: string) {
    const response = await this.http.requestJson<StartLoginResult>(`${MP_BASE_URL}/cgi-bin/bizlogin`, {
      method: 'POST',
      query: {
        action: 'startlogin',
      },
      body: {
        userlang: 'zh_CN',
        redirect_url: '',
        login_type: 3,
        sessionid: sid,
        token: '',
        lang: 'zh_CN',
        f: 'json',
        ajax: 1,
      },
    })

    if (response.base_resp.ret !== 0) {
      throw new WechatArticleError('LOGIN_FAILED', response.base_resp.err_msg || 'Failed to create login session')
    }
  }

  private async resolveLoginResult(response: BizLoginResponse): Promise<LoginResult> {
    const redirectUrl = response.redirect_url
    if (!redirectUrl || typeof redirectUrl !== 'string') {
      throw new WechatArticleError('LOGIN_FAILED', 'Login response did not include redirect_url', {
        details: response,
      })
    }

    const token = new URL(redirectUrl, MP_BASE_URL).searchParams.get('token')
    if (!token) {
      throw new WechatArticleError('LOGIN_FAILED', 'Login response did not include a token')
    }

    const homeHtml = await this.http.requestText(`${MP_BASE_URL}/cgi-bin/home`, {
      query: {
        t: 'home/index',
        token,
        lang: 'zh_CN',
      },
    })

    const nickname = homeHtml.match(/wx\.cgiData\.nick_name\s*=\s*"(?<value>[^"]+)"/)?.groups?.value ?? ''
    const avatar = homeHtml.match(/wx\.cgiData\.head_img\s*=\s*"(?<value>[^"]+)"/)?.groups?.value ?? ''

    if (!nickname) {
      throw new WechatArticleError('LOGIN_FAILED', 'Failed to parse official account nickname after login')
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    this.sessionStore.setAuthenticated({
      token,
      nickname,
      avatar,
      expiresAt,
    })

    return {
      nickname,
      avatar,
      token,
      expiresAt,
    }
  }

  private getQrCodePayload(controller: LoginController): QrCodePayload {
    const state = getLoginControllerState(controller)
    if (!state.qrCodePayload) {
      throw new WechatArticleError('LOGIN_FAILED', 'QR code has not been requested for this controller yet')
    }
    return state.qrCodePayload
  }

  private ensureController(controller: LoginController) {
    if (!isLoginController(controller)) {
      throw new WechatArticleError('INVALID_ARGUMENT', 'Invalid login controller')
    }
  }

  private ensureUsableController(controller: LoginController) {
    this.ensureController(controller)
    const state = getLoginControllerState(controller)

    if (state.canceled) {
      throw new WechatArticleError('LOGIN_CANCELED', 'Login has been canceled')
    }

    if (state.completed) {
      throw new WechatArticleError('LOGIN_FAILED', 'Login flow has already been completed')
    }
  }
}
