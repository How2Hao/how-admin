import { DEFAULT_USER_AGENT } from '@@/constants'
import * as cheerio from 'cheerio'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import { fetch } from 'undici'
import { extractImageUrls } from './extractImageUrls'
import { filterElement } from './filterElemet'

export interface ParserWebByURLResult {
  markdown: string
  imageUrls?: string[]
}

export async function parserWebByURL(url: string, contentSelector?: string): Promise<ParserWebByURLResult> {
  const urlObj = new URL(url)
  const origin = urlObj.origin
  const referer = urlObj.href.endsWith('/') ? urlObj.href.slice(0, -1) : urlObj.href

  const html = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Referer': referer,
      'Origin': origin,
    },
  }).then(res => res.text())

  const $ = cheerio.load(html)
  filterElement($)
  const $articleBody = $(contentSelector ?? '#page-content')

  const content = $articleBody.html()
  if (!content) {
    throw new Error(`No content found ${contentSelector ?? '#page-content'}`)
  }
  const imageUrls = extractImageUrls($, $articleBody)

  const nhm = new NodeHtmlMarkdown({})
  const markdown = nhm.translate(content)

  return {
    markdown,
    imageUrls,
  }
}
