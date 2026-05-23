import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { appReleaseDraft } from '../../../drizzle/schema'

const VERSION_REGEX = /^[0-9]+(\.[0-9]+){1,3}$/

interface Payload {
  version?: string
  changelog?: string
  androidUrl?: string | null
  iosUrl?: string | null
  isMandatory?: number | boolean
  publishedAt?: number
  article?: string | null
  articleTitle?: string | null
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const [existing] = await db.select().from(appReleaseDraft).where(eq(appReleaseDraft.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: '草稿不存在' })

  const update: Record<string, unknown> = {}
  if (body.version !== undefined) {
    const version = body.version.trim()
    if (!VERSION_REGEX.test(version)) throw createError({ statusCode: 400, statusMessage: 'version 格式不合法' })
    update.version = version
  }
  if (body.changelog !== undefined) {
    const changelog = body.changelog.trim()
    if (!changelog) throw createError({ statusCode: 400, statusMessage: 'changelog 不能为空' })
    update.changelog = changelog
  }
  if ('androidUrl' in body) update.androidUrl = body.androidUrl ?? null
  if ('iosUrl' in body) update.iosUrl = body.iosUrl ?? null
  if (body.isMandatory !== undefined) update.isMandatory = body.isMandatory ? 1 : 0
  if (body.publishedAt !== undefined) update.publishedAt = body.publishedAt
  if ('article' in body) update.article = body.article ?? null
  if ('articleTitle' in body) update.articleTitle = (body.articleTitle ?? '').trim() || null

  update.updatedAt = Date.now()
  await db.update(appReleaseDraft).set(update).where(eq(appReleaseDraft.id, id))
  return { ok: true }
})
