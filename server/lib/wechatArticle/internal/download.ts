import type { DownloadedArticle, DownloadOptions, DownloadTarget } from '../types'
import type { WechatHttpClient } from './http-client'
import TurndownService from 'turndown'
import { WechatArticleError } from '../errors'
import { extractArticleTitle, normalizeHtml, parseCgiDataNew, validateHtmlContent } from './html'
import { resolveDownloadTitle, resolveDownloadUrl } from './utils'

export class DownloadService {
  private readonly turndownService = new TurndownService()

  constructor(private readonly http: WechatHttpClient) {}

  async download(
    target: DownloadTarget | DownloadTarget[],
    options: DownloadOptions = {},
  ): Promise<DownloadedArticle | DownloadedArticle[]> {
    const targets = Array.isArray(target) ? target : [target]
    const format = options.format ?? 'markdown'

    const results = await Promise.all(
      targets.map(async (item) => {
        const url = resolveDownloadUrl(item)
        const rawHtml = await this.http.requestText(url)
        const validation = validateHtmlContent(rawHtml)

        if (validation.status === 'deleted') {
          throw new WechatArticleError('ARTICLE_DELETED', validation.message ?? 'Article has been deleted', {
            details: { url },
          })
        }

        if (validation.status === 'exception') {
          throw new WechatArticleError('DOWNLOAD_FAILED', validation.message ?? 'Unexpected article page state', {
            details: { url },
          })
        }

        if (validation.status === 'error') {
          throw new WechatArticleError('DOWNLOAD_FAILED', 'Unable to parse article page', {
            details: { url },
          })
        }

        const title = resolveDownloadTitle(item) ?? extractArticleTitle(rawHtml)
        if (format === 'json') {
          return {
            format,
            url,
            title,
            content: parseCgiDataNew(rawHtml),
          }
        }

        if (format === 'html') {
          return {
            format,
            url,
            title,
            content: normalizeHtml(rawHtml, 'html'),
          }
        }

        if (format === 'text') {
          return {
            format,
            url,
            title,
            content: normalizeHtml(rawHtml, 'text'),
          }
        }

        return {
          format,
          url,
          title,
          content: this.turndownService.turndown(normalizeHtml(rawHtml, 'html')),
        }
      }),
    )

    if (Array.isArray(target)) {
      return results
    }

    const [firstResult] = results
    if (!firstResult) {
      throw new WechatArticleError('DOWNLOAD_FAILED', 'No download result was produced')
    }

    return firstResult
  }
}
