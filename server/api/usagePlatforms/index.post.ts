import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { uploadFile } from '~~/utils/ossClient'
import { benefitUsagePlatform } from '../../../drizzle/schema'

interface Payload {
  code?: string
  name?: string
  sortOrder?: number
  iconBase64?: string
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)

  if (!body?.code?.trim())
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (!body?.name?.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

  let id: number
  try {
    const result = await db.insert(benefitUsagePlatform).values({
      code: body.code.trim(),
      name: body.name.trim(),
      sortOrder: body.sortOrder ?? 0,
    })
    id = Number((result as unknown as [{ insertId: number }])[0].insertId)
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY')
      throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }

  if (body.iconBase64?.trim()) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
    if (m) {
      const buf = Buffer.from(m[1], 'base64')
      if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
        try {
          const url = await uploadFile(`usage_platform/${id}.png`, buf)
          await db.update(benefitUsagePlatform)
            .set({ icon: url })
            .where(eq(benefitUsagePlatform.id, id))
        }
        catch (e: any) {
          throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
        }
      }
    }
  }

  const [row] = await db
    .select()
    .from(benefitUsagePlatform)
    .where(eq(benefitUsagePlatform.id, id))
    .limit(1)

  return row
})
