import type { CheerioAPI } from 'cheerio'

const REMOVE_ID = ['profileBt', 'content_bottom_area', 'js_temp_bottom_area']

export function filterElement($: CheerioAPI) {
  $('*').filter((i, el) => {
    const style = $(el).attr('style')
    const hasInlineHide = style && /\bdisplay\s*:\s*none\b/i.test(style)
    const hasClassHide = $(el).hasClass('hidden')
    return hasInlineHide || hasClassHide
  }).remove()
  REMOVE_ID.forEach(id => $(`#${id}`).remove())
  $('span[leaf]').find('img').remove()
}
