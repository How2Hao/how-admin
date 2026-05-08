import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { uploadFile } from '~~/utils/ossClient'
import { benefitPayPlatform } from '../../../drizzle/schema'

interface Payload {
  code?: string
  name?: string
  sortOrder?: number
  iconBase64?: string
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '平台 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body)
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  if (body.code !== undefined && !body.code.trim())
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (body.name !== undefined && !body.name.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

  const [existing] = await db
    .select({ id: benefitPayPlatform.id })
    .from(benefitPayPlatform)
    .where(eq(benefitPayPlatform.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '平台不存在' })

  const update: Record<string, unknown> = {}
  if (body.code !== undefined)
    update.code = body.code.trim()
  if (body.name !== undefined)
    update.name = body.name.trim()
  if (body.sortOrder !== undefined)
    update.sortOrder = body.sortOrder

  if (body.iconBase64?.trim()) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 不是合法 data URL' })
    const buf = Buffer.from(m[1], 'base64')
    if (buf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 解析后内容为空' })
    if (buf.byteLength > 5 * 1024 * 1024)
      throw createError({ statusCode: 413, statusMessage: '图标超过 5MB 限制' })
    try {
      update.icon = await uploadFile(`pay_platform/${id}.png`, buf)
    }
    catch (e: any) {
      throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
    }
  }

  if (Object.keys(update).length > 0) {
    try {
      await db.update(benefitPayPlatform).set(update).where(eq(benefitPayPlatform.id, id))
    }
    catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY')
        throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
      throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
    }
  }

  const [row] = await db
    .select()
    .from(benefitPayPlatform)
    .where(eq(benefitPayPlatform.id, id))
    .limit(1)

  referenceData.invalidate()
  return row
})
