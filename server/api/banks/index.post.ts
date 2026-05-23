import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { uploadBankLogo } from '~~/utils/ossClient'
import { bank } from '../../../drizzle/schema'

const BANK_TYPE_VALUES = [
  'STATE_OWNED',
  'JOINT_STOCK',
  'CITY_COMMERCIAL',
  'RURAL_COMMERCIAL',
  'RURAL_CREDIT_COOP',
  'JOINT_VENTURE',
  'VILLAGE',
  'PRIVATE',
] as const
type BankType = typeof BANK_TYPE_VALUES[number]

interface CreatePayload {
  name: string
  code: string
  shortName?: string | null
  pinyinIndex?: string | null
  themeColor?: string | null
  bankType?: BankType | null
  isHot?: boolean | 0 | 1
  isVisible?: boolean | 0 | 1
  /** logo 图片 data URL；INSERT 成功后再上传 OSS 写回 logo */
  logoBase64?: string | null
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024

export default defineHandler(async (event) => {
  const body = await readBody<CreatePayload>(event)
  if (!body)
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const name = body.name?.trim()
  if (!name)
    throw createError({ statusCode: 400, statusMessage: '银行名称不能为空' })

  const code = body.code?.trim().toLowerCase()
  if (!code)
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (!/^[a-z0-9_-]+$/i.test(code))
    throw createError({ statusCode: 400, statusMessage: 'code 只允许字母数字下划线连字符' })

  if (
    body.bankType !== undefined
    && body.bankType !== null
    && !BANK_TYPE_VALUES.includes(body.bankType as BankType)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'bankType 取值不合法' })
  }

  // code 唯一性校验（手动 — bank.code 没建唯一索引，但运营角度需要避免重复）
  const [existing] = await db
    .select({ id: bank.id })
    .from(bank)
    .where(eq(bank.code, code))
    .limit(1)
  if (existing)
    throw createError({ statusCode: 409, statusMessage: `code "${code}" 已存在（id=${existing.id}）` })

  // 解析 logo（如有）
  let logoBuf: Buffer | null = null
  if (body.logoBase64 && body.logoBase64.trim()) {
    const m = /^(?:data:[^;]+;base64,)?(.+)$/.exec(body.logoBase64.trim())
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'logoBase64 不是合法 base64' })
    try {
      logoBuf = Buffer.from(m[1], 'base64')
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `logoBase64 解码失败：${e?.message ?? e}` })
    }
    if (logoBuf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: 'logo 内容为空' })
    if (logoBuf.byteLength > MAX_LOGO_BYTES)
      throw createError({ statusCode: 413, statusMessage: `logo 过大 (${(logoBuf.byteLength / 1024 / 1024).toFixed(2)} MB)` })
  }

  const insertValues = {
    name,
    code,
    shortName: body.shortName?.trim() || null,
    pinyinIndex: body.pinyinIndex?.trim() || null,
    themeColor: body.themeColor?.trim() || null,
    bankType: body.bankType ?? null,
    isHot: body.isHot ? 1 : 0,
    isVisible: body.isVisible === false || body.isVisible === 0 ? 0 : 1,
    isUnifiedBill: 0,
    logo: null as string | null,
  }

  let newId: number
  try {
    const [res] = await db.insert(bank).values(insertValues as any)
    newId = (res as any)?.insertId as number
    if (!Number.isInteger(newId) || newId <= 0)
      throw new Error('insert 未返回 id')
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }

  let logoUrl: string | null = null
  if (logoBuf) {
    try {
      logoUrl = await uploadBankLogo(code, logoBuf)
      await db.update(bank).set({ logo: logoUrl }).where(eq(bank.id, newId))
    }
    catch (e: any) {
      // 上传失败回滚 INSERT，避免留下 logo NULL 但 code 占位的脏数据
      try {
        await db.delete(bank).where(eq(bank.id, newId))
      }
      catch {}
      throw createError({ statusCode: 500, statusMessage: `上传 logo 失败：${e?.message ?? e}` })
    }
  }

  return { id: newId, logo: logoUrl, success: true }
})
