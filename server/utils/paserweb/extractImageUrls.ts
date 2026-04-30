import type { Cheerio, CheerioAPI } from 'cheerio'

export function extractImageUrls($: CheerioAPI, $articleBody: Cheerio<any>) {
  const imageUrls = new Set<string>()

  $articleBody.find('img').each((_index, element) => {
    const $img = $(element)

    const src = $img.attr('data-src') || $img.attr('src')
    if (!src)
      return

    if (shouldFilterImage($img, src)) {
      return
    }

    imageUrls.add(src)
  })

  return Array.from(imageUrls)
}

// 图片过滤规则函数
function shouldFilterImage($img: Cheerio<any>, src: string) {
  // 规则1：根据 URL 特征过滤（可自行扩充）
  const urlPatterns = [
    /\/avatar\//i, // 头像
    /\/icon\//i, // 图标
    /\/emoji\//i, // 表情
    /\/mmbiz_qpic\//i, // 微信特定图片，常用于头像、二维码
    /\/mmbiz_gif\//i, // 微信动图
    /\/mmbiz_webp\//i, // 微信 webp
    /[?&]wx_fmt=(gif|webp|bmp)\b/i, // 微信图片格式参数（OCR 不支持的格式）
  ]
  if (urlPatterns.some(pattern => pattern.test(src)))
    return true

  // 规则1b：按 URL 路径后缀过滤（忽略 query string）
  const pathname = (() => {
    try { return new URL(src, 'https://placeholder.local').pathname }
    catch { return src }
  })()
  if (/\.(?:gif|webp|bmp|svg)$/i.test(pathname))
    return true

  // 规则2：根据尺寸过滤（如果 img 标签有 width/height 属性
  const width = getSize($img, 'width')
  const height = getSize($img, 'height')
  if (width && height && (Number.parseInt(width) <= 150 || Number.parseInt(height) <= 20))
    return true

  // 规则3：根据 class 过滤（如 'avatar', 'icon', 'qrcode'）
  if ($img.hasClass('avatar') || $img.hasClass('qrcode'))
    return true

  return false
}

function getSize($img: Cheerio<any>, attr: 'width' | 'height') {
  return $img.attr(attr) || $img.attr('style')?.match(new RegExp(`\\s*${attr}:\\s*(\\d+)px`))?.[1] || $img.attr(`data-${attr}`) || $img.attr(`_${attr}`)
}
