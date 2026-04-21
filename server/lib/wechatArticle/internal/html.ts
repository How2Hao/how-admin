import { Script } from 'node:vm'
import * as cheerio from 'cheerio'

export function normalizeHtml(rawHtml: string, format: 'html' | 'text' = 'html') {
  const $ = cheerio.load(rawHtml)
  const $jsArticleContent = $('#js_article')

  $jsArticleContent.find('#js_content').removeAttr('style')
  $jsArticleContent.find('#js_top_ad_area').remove()
  $jsArticleContent.find('#js_tags_preview_toast').remove()
  $jsArticleContent.find('#content_bottom_area').remove()
  $jsArticleContent.find('#js_pc_qr_code').remove()
  $jsArticleContent.find('#wx_stream_article_slide_tip').remove()
  $jsArticleContent.find('script').remove()

  $('img').each((_index, element) => {
    const $img = $(element)
    const src = $img.attr('src') || $img.attr('data-src')
    if (src) {
      $img.attr('src', src)
    }
  })

  if (format === 'text') {
    const text = $jsArticleContent.text().trim().replace(/\n+/g, '\n').replace(/ +/g, ' ')
    return text
      .split('\n')
      .filter(line => !/^\s*$/.test(line))
      .join('\n')
  }

  const bodyClass = $('body').attr('class') ?? ''
  const pageContentHtml = $('<div>').append($jsArticleContent.clone()).html() ?? ''

  return `<!DOCTYPE html>
<html lang="zh_CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
  <meta name="referrer" content="no-referrer">
  <style>
    #js_row_immersive_stream_wrap {
      max-width: 667px;
      margin: 0 auto;
    }
    #js_row_immersive_stream_wrap .wx_follow_avatar_pic {
      display: block;
      margin: 0 auto;
    }
    #page-content,
    #js_article_bottom_bar,
    .__page_content__ {
      max-width: 667px;
      margin: 0 auto;
    }
    img {
      max-width: 100%;
    }
    .sns_opr_btn::before {
      width: 16px;
      height: 16px;
      margin-right: 3px;
    }
  </style>
</head>
<body class="${bodyClass}">
${pageContentHtml}
</body>
</html>`
}

export function validateHtmlContent(html: string): {
  status: 'success' | 'deleted' | 'exception' | 'error'
  message: string | null
} {
  const $ = cheerio.load(html)
  const $jsArticle = $('#js_article')
  const $weuiMsg = $('.weui-msg')
  const $msgBlock = $('.mesg-block')

  if ($jsArticle.length === 1) {
    return { status: 'success', message: null }
  }

  if ($weuiMsg.length === 1) {
    const msg = $('.weui-msg .weui-msg__title').text().trim().replace(/\n+/g, '').replace(/ +/g, ' ')
    if (msg && ['The content has been deleted by the author.', '该内容已被发布者删除'].includes(msg)) {
      return { status: 'deleted', message: msg }
    }
    return { status: 'exception', message: msg || null }
  }

  if ($msgBlock.length === 1) {
    const msg = $msgBlock.text().trim().replace(/\n+/g, '').replace(/ +/g, ' ')
    return { status: 'exception', message: msg || null }
  }

  return { status: 'error', message: null }
}

export function extractArticleTitle(rawHtml: string) {
  const $ = cheerio.load(rawHtml)
  return (
    $('#activity-name').first().text().trim()
    || $('meta[property="og:title"]').attr('content')?.trim()
    || $('title').text().trim()
    || null
  )
}

function extractCgiScript(html: string) {
  const $ = cheerio.load(html)

  for (const element of $('script').toArray()) {
    const content = $(element).html()?.trim() ?? ''
    if (content.includes('window.cgiDataNew = ')) {
      return content
    }
  }

  return null
}

export function parseCgiDataNew(html: string): Record<string, unknown> | null {
  const code = extractCgiScript(html)
  if (!code) {
    return null
  }

  const sandbox: Record<string, unknown> = {
    console: {
      log: () => undefined,
      error: () => undefined,
      warn: () => undefined,
    },
  }

  sandbox.window = sandbox
  sandbox.self = sandbox
  sandbox.globalThis = sandbox

  const script = new Script(code)
  script.runInNewContext(sandbox, { timeout: 1_000 })

  const data = sandbox.cgiDataNew ?? (sandbox.window as Record<string, unknown> | undefined)?.cgiDataNew ?? null
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }

  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
}
