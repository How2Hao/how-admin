import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { uploadFile } from '~~/utils/ossClient'
import { benefitUsagePlatform } from '../../../drizzle/schema'

interface Payload {
  code?: string
  name?: string
  sortOrder?: number
  remark?: string
  iconBase64?: string
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)

  if (!body?.code?.trim())
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (!body?.name?.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

  // Pre-validate icon before DB insert so we can reject cleanly
  let iconBuf: Buffer | null = null
  if (body.iconBase64?.trim()) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 不是合法 data URL' })
    iconBuf = Buffer.from(m[1], 'base64')
    if (iconBuf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 解析后内容为空' })
    if (iconBuf.byteLength > 5 * 1024 * 1024)
      throw createError({ statusCode: 413, statusMessage: '图标超过 5MB 限制' })
  }

  let id: number
  try {
    const result = await db.insert(benefitUsagePlatform).values({
      code: body.code.trim(),
      name: body.name.trim(),
      sortOrder: body.sortOrder ?? 0,
      remark: body.remark?.trim() || null,
    })
    id = Number((result as unknown as [{ insertId: number }])[0].insertId)
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY')
      throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }

  if (iconBuf) {
    try {
      const url = await uploadFile(`usage_platform/${id}.png`, iconBuf)
      await db.update(benefitUsagePlatform)
        .set({ icon: url })
        .where(eq(benefitUsagePlatform.id, id))
    }
    catch (e: any) {
      throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
    }
  }

  const [row] = await db
    .select()
    .from(benefitUsagePlatform)
    .where(eq(benefitUsagePlatform.id, id))
    .limit(1)

  referenceData.invalidate()
  return row
})
