import type { LoginController } from './LoginController'
import type {
  AccountSearchOptions,
  AccountSearchResult,
  ArticleListOptions,
  ArticleListResult,
  DownloadedArticle,
  DownloadOptions,
  DownloadTarget,
  LoginOptions,
  LoginResult,
  LoginStatus,
  WechatArticleOptions,
} from './types'
import { DEFAULT_LOGIN_POLL_INTERVAL_MS, DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT } from './constants'
import { AuthService } from './internal/auth'
import { DownloadService } from './internal/download'
import { WechatHttpClient } from './internal/http-client'
import { MpService } from './internal/mp'
import { SessionStore } from './internal/session-store'

export class WechatArticle {
  private readonly sessionStore: SessionStore
  private readonly authService: AuthService
  private readonly mpService: MpService
  private readonly downloadService: DownloadService

  constructor(options: WechatArticleOptions = {}) {
    this.sessionStore = new SessionStore(options.session?.persistPath)

    const http = new WechatHttpClient(
      this.sessionStore,
      options.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      options.http?.userAgent ?? DEFAULT_USER_AGENT,
    )

    this.authService = new AuthService(
      http,
      this.sessionStore,
      options.login?.pollIntervalMs ?? DEFAULT_LOGIN_POLL_INTERVAL_MS,
    )
    this.mpService = new MpService(http, this.sessionStore)
    this.downloadService = new DownloadService(http)
  }

  async login(options?: LoginOptions): Promise<LoginResult> {
    return this.authService.login(options)
  }

  async startLogin(): Promise<LoginController> {
    return this.authService.startLogin()
  }

  async getQrcode(controller: LoginController): Promise<string> {
    return this.authService.getQrcode(controller)
  }

  async checkLoginStatus(controller: LoginController): Promise<LoginStatus> {
    return this.authService.checkLoginStatus(controller)
  }

  async finishLogin(controller: LoginController): Promise<LoginResult> {
    return this.authService.finishLogin(controller)
  }

  async account(keyword: string, options?: AccountSearchOptions): Promise<AccountSearchResult> {
    return this.mpService.account(keyword, options)
  }

  async article(fakeid: string, options?: ArticleListOptions): Promise<ArticleListResult> {
    return this.mpService.article(fakeid, options)
  }

  async download(target: DownloadTarget, options?: DownloadOptions): Promise<DownloadedArticle>
  async download(target: DownloadTarget[], options?: DownloadOptions): Promise<DownloadedArticle[]>
  async download(target: DownloadTarget | DownloadTarget[], options?: DownloadOptions) {
    return this.downloadService.download(target, options)
  }

  async logout() {
    await this.authService.logout()
  }

  isLoggedIn() {
    return this.sessionStore.isLoggedIn()
  }
}

export const wechatArticleSDK = new WechatArticle()
