import * as cheerio from 'cheerio'
import { defineHandler } from 'nitro'
import { fetch } from 'undici'
import { DEFAULT_USER_AGENT } from '~~/constants'
import { wechatArticleSDK } from '~~/lib/wechatArticle/WechatArticle'

function isWechatArticleUrl(url: URL) {
  return ['mp.weixin.qq.com', 'weixin.qq.com'].includes(url.hostname)
}

function wrapHtmlDocument(rawHtml: string, sourceUrl: string) {
  const $ = cheerio.load(rawHtml)
  const head = $('head')

  if (head.length) {
    head.prepend(`<base href="${escapeHtml(sourceUrl)}">`)
    head.append(`
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background: #f5f7fb;
        }
        body {
          color: #1f2937;
          font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
          line-height: 1.75;
        }
        img, video {
          max-width: 100% !important;
          height: auto !important;
        }
        table {
          display: block;
          max-width: 100%;
          overflow-x: auto;
        }
      </style>
    `)
  }

  return `<!doctype html>${$.html()}`
}

async function fetchGenericHtml(url: URL) {
  return await fetch(url.href, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Referer': url.href.endsWith('/') ? url.href.slice(0, -1) : url.href,
      'Origin': url.origin,
    },
  }).then(res => res.text())
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

export default defineHandler(async (event) => {
  const requestUrl = new URL(event.req.url ?? '', 'http://localhost')
  const target = requestUrl.searchParams.get('url')?.trim()

  if (!target) {
    return new Response('Missing url', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  const targetUrl = new URL(target)
  const html = isWechatArticleUrl(targetUrl)
    ? await fetchWechatPreviewHtml(targetUrl.href)
    : await fetchGenericHtml(targetUrl)

  return new Response(wrapHtmlDocument(html, targetUrl.href), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

async function fetchWechatPreviewHtml(url: string) {
  const downloaded = await wechatArticleSDK.download(url, { format: 'html' })
  if (downloaded.format !== 'html' || typeof downloaded.content !== 'string') {
    throw new Error('Unexpected WeChat preview content')
  }

  return downloaded.content
}
