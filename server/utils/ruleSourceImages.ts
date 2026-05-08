/**
 * 任务模板原始图片入库 helper：
 *
 * 写入路径规范：`task_template/{rootId}/{idx}.{ext}`，idx 单调递增（不复用被删的 idx）。
 * 调用方负责把"保留的 URL"+"新加的 base64"传进来；helper 负责上传 + 返回最终 URL 列表。
 *
 * 不做的：
 *   - 不主动从 OSS 物理删除"被删图"（避免引用残留 / 撤销编辑场景；后续单独维护清理脚本）
 *   - 不在事务中（OSS 操作天然非事务，调用方需要决定失败时的回滚策略）
 */
import type { Buffer as NodeBuffer } from 'node:buffer'
import { Buffer } from 'node:buffer'
import { uploadFile } from './ossClient'

const MAX_IMG_BYTES = 5 * 1024 * 1024 // 单图 5 MB 上限

const SUPPORTED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

function decodeDataUrl(dataUrl: string): { buf: NodeBuffer, ext: string, contentType: string } | null {
  const m = /^data:image\/(\w+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  const rawExt = m[1].toLowerCase()
  // jpeg → jpg 统一文件名后缀；其它认识的就用，不认识用 png 兜底
  const ext = rawExt === 'jpeg' ? 'jpg' : (SUPPORTED_EXT.has(rawExt) ? rawExt : 'png')
  const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  const buf = Buffer.from(m[2], 'base64')
  if (buf.byteLength === 0 || buf.byteLength > MAX_IMG_BYTES) return null
  return { buf, ext, contentType }
}

/**
 * 找出 keptUrls 中已用过的最大 idx（path 形如 `.../task_template/{rootId}/{idx}.{ext}`）。
 * 找不到返回 0；新加图从 max + 1 开始。
 */
function maxIdxFromUrls(urls: string[]): number {
  let max = 0
  for (const u of urls) {
    const m = /\/task_template\/\d+\/(\d+)\.\w+/.exec(u)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return max
}

/**
 * 把"保留的 URL + 新增的 base64"合并成最终 imageUrls。
 *
 * @param rootId 主档 task_template id（多档共享同一组图）
 * @param keptUrls 用户保留的已上传 URL（编辑时由前端传，创建时为空数组）
 * @param newBase64s 用户新加的 data URL 数组（创建/编辑都可能有）
 * @returns 最终 URL 列表（顺序：keptUrls 在前，新上传 URL 在后）
 */
export async function commitTemplateImages(
  rootId: number,
  keptUrls: string[],
  newBase64s: string[],
): Promise<string[]> {
  const safeKept = (keptUrls ?? []).filter(u => typeof u === 'string' && u.trim().length > 0)
  const safeBase64s = (newBase64s ?? []).filter(s => typeof s === 'string' && s.trim().length > 0)

  if (safeBase64s.length === 0) return [...safeKept]

  const startIdx = maxIdxFromUrls(safeKept) + 1
  const newUrls: string[] = []

  for (let i = 0; i < safeBase64s.length; i++) {
    const decoded = decodeDataUrl(safeBase64s[i])
    if (!decoded) {
      // 无效 base64 跳过；不终止整批（其它图能上传成功就上传）
      console.warn(`[commitTemplateImages] skip invalid base64 at index ${i}`)
      continue
    }
    const idx = startIdx + i
    const key = `task_template/${rootId}/${idx}.${decoded.ext}`
    try {
      const url = await uploadFile(key, decoded.buf, decoded.contentType)
      newUrls.push(url)
    }
    catch (e: any) {
      console.warn(`[commitTemplateImages] upload failed for ${key}:`, e?.message ?? e)
    }
  }

  return [...safeKept, ...newUrls]
}

/**
 * 把 ruleSource JSON 拼起来，linkUrl / imageUrls 都为空时整字段写 null（跟"未填任何 ruleSource"语义一致）
 */
export function buildRuleSourceJson(linkUrl: string | null, imageUrls: string[]): { linkUrl?: string, imageUrls?: string[] } | null {
  const obj: { linkUrl?: string, imageUrls?: string[] } = {}
  if (linkUrl && linkUrl.trim()) obj.linkUrl = linkUrl.trim()
  if (imageUrls.length > 0) obj.imageUrls = imageUrls
  return Object.keys(obj).length > 0 ? obj : null
}
