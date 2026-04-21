import type {
  AccountInfo,
  AccountSearchOptions,
  AccountSearchResult,
  ArticleListOptions,
  ArticleListResult,
  ArticleSummary,
  BaseResp,
} from '../types'
import type { WechatHttpClient } from './http-client'
import type { SessionStore } from './session-store'
import { DEFAULT_ACCOUNT_PAGE_SIZE, DEFAULT_ARTICLE_PAGE_SIZE, MP_BASE_URL } from '../constants'
import { WechatArticleError } from '../errors'
import { assertPageSize, assertPositiveInteger, safeJsonClone } from './utils'

interface SearchBizResponse {
  base_resp: BaseResp
  list: AccountInfo[]
  total: number
}

interface AppMsgPublishResponse {
  base_resp: BaseResp
  publish_page: string
}

interface PublishListItem {
  publish_info?: string
}

interface PublishPage {
  total_count: number
  publish_list: PublishListItem[]
}

interface PublishInfo {
  appmsgex: ArticleSummary[]
}

export class MpService {
  constructor(
    private readonly http: WechatHttpClient,
    private readonly sessionStore: SessionStore,
  ) {}

  async account(keyword: string, options: AccountSearchOptions = {}): Promise<AccountSearchResult> {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) {
      throw new WechatArticleError('INVALID_ARGUMENT', 'keyword is required')
    }

    const token = this.requireToken()
    const begin = assertPositiveInteger('begin', options.begin ?? 0)
    const size = assertPageSize('size', options.size ?? DEFAULT_ACCOUNT_PAGE_SIZE, DEFAULT_ACCOUNT_PAGE_SIZE)

    const response = await this.http.requestJson<SearchBizResponse>(`${MP_BASE_URL}/cgi-bin/searchbiz`, {
      query: {
        action: 'search_biz',
        begin,
        count: size,
        query: normalizedKeyword,
        token,
        lang: 'zh_CN',
        f: 'json',
        ajax: 1,
      },
    })

    this.assertBaseResp(response.base_resp, 'ACCOUNT_SEARCH_FAILED')

    const hasMore = begin === 0 ? response.total >= size : response.total > 0
    return {
      list: safeJsonClone(response.list ?? []),
      total: response.total ?? 0,
      hasMore,
      nextBegin: hasMore ? begin + size : null,
    }
  }

  async article(fakeid: string, options: ArticleListOptions = {}): Promise<ArticleListResult> {
    const normalizedFakeId = fakeid.trim()
    if (!normalizedFakeId) {
      throw new WechatArticleError('INVALID_ARGUMENT', 'fakeid is required')
    }

    const token = this.requireToken()
    const begin = assertPositiveInteger('begin', options.begin ?? 0)
    const size = assertPageSize('size', options.size ?? DEFAULT_ARTICLE_PAGE_SIZE, DEFAULT_ARTICLE_PAGE_SIZE)
    const keyword = options.keyword?.trim() ?? ''
    const isSearching = Boolean(keyword)

    const response = await this.http.requestJson<AppMsgPublishResponse>(`${MP_BASE_URL}/cgi-bin/appmsgpublish`, {
      query: {
        sub: isSearching ? 'search' : 'list',
        search_field: isSearching ? '7' : 'null',
        begin,
        count: size,
        query: keyword,
        fakeid: normalizedFakeId,
        type: '101_1',
        free_publish_type: 1,
        sub_action: 'list_ex',
        token,
        lang: 'zh_CN',
        f: 'json',
        ajax: 1,
      },
    })

    this.assertBaseResp(response.base_resp, 'ARTICLE_LIST_FAILED')

    const publishPage = JSON.parse(response.publish_page) as PublishPage
    const publishList = (publishPage.publish_list ?? []).filter(
      (item): item is PublishListItem & { publish_info: string } => typeof item.publish_info === 'string',
    )
    const articles = publishList.flatMap((item) => {
      const publishInfo = JSON.parse(item.publish_info) as PublishInfo
      return publishInfo.appmsgex
    })

    const hasMore = publishList.length > 0
    return {
      articles: safeJsonClone(articles),
      total: publishPage.total_count ?? 0,
      hasMore,
      nextBegin: hasMore ? begin + publishList.length : null,
    }
  }

  private requireToken() {
    const token = this.sessionStore.token
    if (!token) {
      throw new WechatArticleError('UNAUTHENTICATED', 'Please login first')
    }
    return token
  }

  private assertBaseResp(baseResp: BaseResp, code: 'ACCOUNT_SEARCH_FAILED' | 'ARTICLE_LIST_FAILED') {
    if (baseResp.ret === 200003) {
      this.sessionStore.clear()
      throw new WechatArticleError('SESSION_EXPIRED', 'WeChat login session expired')
    }

    if (baseResp.ret !== 0) {
      throw new WechatArticleError(code, `${baseResp.ret}:${baseResp.err_msg}`)
    }
  }
}
