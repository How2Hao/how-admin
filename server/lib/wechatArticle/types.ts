import type { Buffer } from 'node:buffer'

export type ErrorCode
  = | 'UNAUTHENTICATED'
    | 'SESSION_EXPIRED'
    | 'QR_EXPIRED'
    | 'ACCOUNT_SEARCH_FAILED'
    | 'ARTICLE_LIST_FAILED'
    | 'ARTICLE_DELETED'
    | 'DOWNLOAD_FAILED'
    | 'LOGIN_FAILED'
    | 'LOGIN_CANCELED'
    | 'INVALID_ARGUMENT'

export interface WechatArticleOptions {
  session?: {
    persistPath?: string
  }
  http?: {
    timeoutMs?: number
    userAgent?: string
  }
  login?: {
    pollIntervalMs?: number
  }
}

export interface QrCodePayload {
  sid: string
  buffer: Buffer
  dataUrl: string
  path: string
}

export interface LoginOptions {
  pollIntervalMs?: number
  onQrCode?: (payload: QrCodePayload) => void | Promise<void>
}

export type LoginStatus = 'pending' | 'scanned' | 'confirmed' | 'expired' | 'canceled'

export interface LoginResult {
  nickname: string
  avatar: string
  expiresAt: Date
  token: string
}

export interface AccountSearchOptions {
  begin?: number
  size?: number
}

export interface AccountInfo {
  type: 'account'
  alias: string
  fakeid: string
  nickname: string
  round_head_img: string
  service_type: number
  signature: string
  verify_status?: number
  [key: string]: unknown
}

export interface AccountSearchResult {
  list: AccountInfo[]
  total: number
  hasMore: boolean
  nextBegin: number | null
}

export interface RGB {
  r: number
  g: number
  b: number
}

export interface AppMsgAlbumInfo {
  album_id: number
  id: string
  tagSource: number
  title: string
}

export interface ArticleSummary {
  aid: string
  album_id?: string
  appmsg_album_infos?: AppMsgAlbumInfo[]
  appmsgid: number
  author_name?: string
  ban_flag?: number
  checking?: number
  copyright_stat?: number
  copyright_type?: number
  cover?: string
  cover_img?: string
  cover_img_theme_color?: RGB
  create_time?: number
  digest?: string
  has_red_packet_cover?: number
  is_deleted?: boolean
  is_pay_subscribe?: number
  item_show_type?: number
  itemidx: number
  link: string
  media_duration?: string
  mediaapi_publish_status?: number
  pic_cdn_url_1_1?: string
  pic_cdn_url_3_4?: string
  pic_cdn_url_16_9?: string
  pic_cdn_url_235_1?: string
  share_imageinfo?: unknown[]
  tagid?: unknown[]
  title: string
  update_time: number
  wecoin_count?: number
  [key: string]: unknown
}

export interface ArticleListOptions {
  begin?: number
  size?: number
  keyword?: string
}

export interface ArticleListResult {
  articles: ArticleSummary[]
  total: number
  hasMore: boolean
  nextBegin: number | null
}

export type DownloadFormat = 'html' | 'markdown' | 'text' | 'json'
export type DownloadTarget = string | ArticleSummary

export interface DownloadOptions {
  format?: DownloadFormat
}

export interface DownloadedTextArticle {
  format: 'html' | 'markdown' | 'text'
  url: string
  title: string | null
  content: string
}

export interface DownloadedJsonArticle {
  format: 'json'
  url: string
  title: string | null
  content: Record<string, unknown> | null
}

export type DownloadedArticle = DownloadedTextArticle | DownloadedJsonArticle

export interface SessionInfo {
  nickname: string
  avatar: string
  expiresAt: Date
  token: string
}

export interface BaseResp {
  ret: number
  err_msg: string
}
