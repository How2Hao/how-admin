import type { Buffer } from 'node:buffer'
import process from 'node:process'
import OSS from 'ali-oss'

let cached: OSS | null = null

function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v)
    throw new Error(`缺少环境变量 ${name}`)
  return v
}

export function getOssClient(): OSS {
  if (cached)
    return cached
  cached = new OSS({
    region: envOrThrow('OSS_REGION'),
    bucket: envOrThrow('OSS_BUCKET'),
    accessKeyId: envOrThrow('OSS_ACCESS_KEY_ID'),
    accessKeySecret: envOrThrow('OSS_ACCESS_KEY_SECRET'),
    secure: true,
  })
  return cached
}

export async function uploadFile(key: string, buf: Buffer, contentType = 'image/png'): Promise<string> {
  if (!buf || buf.byteLength === 0)
    throw new Error('uploadFile: 内容为空')
  await getOssClient().put(key, buf, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=2592000',
    },
  })
  const base = envOrThrow('OSS_PUBLIC_BASE_URL').replace(/\/+$/, '')
  return `${base}/${key}`
}

export async function uploadCardCover(bankId: string, id: number, buf: Buffer): Promise<string> {
  if (!bankId || !Number.isInteger(id))
    throw new Error('uploadCardCover: bankId 或 id 不合法')
  return uploadFile(`card_template_cover/${bankId}/${id}.png`, buf)
}

export async function uploadBankLogo(code: string, buf: Buffer): Promise<string> {
  // code 仅允许小写字母 + 数字，避免 OSS key 出现奇怪字符或路径穿越
  if (!/^[a-z0-9_-]+$/i.test(code))
    throw new Error('uploadBankLogo: code 只允许字母数字下划线连字符')
  return uploadFile(`bank_logo/${code.toLowerCase()}.png`, buf)
}

/** 推送任务的配图 / inbox 富媒体图：按 yyyymm + 随机串路径 */
export async function uploadInboxImage(buf: Buffer, ext = 'png'): Promise<string> {
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'png'
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
  const random = Math.random().toString(36).slice(2, 10)
  const key = `inbox_message_image/${yyyymm}/${Date.now()}-${random}.${safeExt}`
  return uploadFile(key, buf, `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`)
}

export async function uploadPasteImage(buf: Buffer, ext = 'png'): Promise<string> {
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'png'
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
  const random = Math.random().toString(36).slice(2, 10)
  const key = `paste_uploads/${yyyymm}/${Date.now()}-${random}.${safeExt}`
  return uploadFile(key, buf, `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`)
}

/** App 版本文章里的图片：统一进单一文件夹 app_version_article/，扁平不按月份拆 */
export async function uploadAppVersionArticleImage(buf: Buffer, ext = 'png'): Promise<string> {
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'png'
  const random = Math.random().toString(36).slice(2, 10)
  const key = `app_version_article/${Date.now()}-${random}.${safeExt}`
  return uploadFile(key, buf, `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`)
}

/** 广场运营自定义 tab 的 logo 图标：按 yyyymm + 随机串路径 */
export async function uploadPlazaTabLogo(buf: Buffer, ext = 'png'): Promise<string> {
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'png'
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
  const random = Math.random().toString(36).slice(2, 10)
  const key = `plaza_custom_tab_logo/${yyyymm}/${Date.now()}-${random}.${safeExt}`
  return uploadFile(key, buf, `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`)
}
