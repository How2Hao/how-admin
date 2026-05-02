// server/api/activityCategories/[id].put.ts
import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { uploadFile } from '~~/utils/ossClient'
import { activityCategory } from '../../../drizzle/schema'

interface Payload {
  code?: string
  name?: string
  parentId?: number | null
  sortOrder?: number
  iconBase64?: string
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '分类 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body)
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  if (body.code !== undefined && !body.code.trim())
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (body.name !== undefined && !body.name.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

  // Pre-validate icon before any DB I/O so we can reject cleanly
  let iconBuf: Buffer | null = null
  if (body.iconBase64?.trim()) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 不是合法 data URL' })
    const buf = Buffer.from(m[1], 'base64')
    if (buf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 解析后内容为空' })
    if (buf.byteLength > 5 * 1024 * 1024)
      throw createError({ statusCode: 413, statusMessage: '图标超过 5MB 限制' })
    iconBuf = buf
  }

  const [existing] = await db
    .select({ id: activityCategory.id })
    .from(activityCategory)
    .where(eq(activityCategory.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '分类不存在' })

  // Validate parentId: cannot self-reference; target must be top-level
  if (body.parentId != null) {
    if (body.parentId === id)
      throw createError({ statusCode: 400, statusMessage: '父分类不能指向自身' })
    // Prevent promoting a node with children to a child position (would create depth > 2)
    const [child] = await db
      .select({ id: activityCategory.id })
      .from(activityCategory)
      .where(eq(activityCategory.parentId, id))
      .limit(1)
    if (child)
      throw createError({ statusCode: 400, statusMessage: '该分类已有子分类，不能设置父分类' })
    const [parent] = await db
      .select({ id: activityCategory.id, parentId: activityCategory.parentId })
      .from(activityCategory)
      .where(eq(activityCategory.id, body.parentId))
      .limit(1)
    if (!parent)
      throw createError({ statusCode: 400, statusMessage: '父分类不存在' })
    if (parent.parentId !== null)
      throw createError({ statusCode: 400, statusMessage: '父分类必须是顶级分类' })
  }

  const update: Record<string, unknown> = {}
  if (body.code !== undefined)
    update.code = body.code.trim()
  if (body.name !== undefined)
    update.name = body.name.trim()
  if ('parentId' in body)
    update.parentId = body.parentId ?? null
  if (body.sortOrder !== undefined)
    update.sortOrder = body.sortOrder

  if (iconBuf) {
    try {
      update.icon = await uploadFile(`activity_category/${id}.png`, iconBuf)
    }
    catch (e: any) {
      throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
    }
  }

  if (Object.keys(update).length > 0) {
    try {
      await db.update(activityCategory).set(update).where(eq(activityCategory.id, id))
    }
    catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY')
        throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
      throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
    }
  }

  const [row] = await db
    .select()
    .from(activityCategory)
    .where(eq(activityCategory.id, id))
    .limit(1)

  referenceData.invalidate()
  return row
})
