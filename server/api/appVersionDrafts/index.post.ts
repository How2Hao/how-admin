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
  const body = await readBody<Payload>(event)
  const version = (body?.version ?? '').trim()
  const changelog = (body?.changelog ?? '').trim()

  if (!version) throw createError({ statusCode: 400, statusMessage: 'version 不能为空' })
  if (!VERSION_REGEX.test(version)) throw createError({ statusCode: 400, statusMessage: 'version 格式不合法，如 1.0.0 或 1.0.0.1' })
  if (!changelog) throw createError({ statusCode: 400, statusMessage: 'changelog 不能为空' })

  const now = Date.now()
  const result = await db.insert(appReleaseDraft).values({
    version,
    changelog,
    androidUrl: body?.androidUrl ?? null,
    iosUrl: body?.iosUrl ?? null,
    isMandatory: body?.isMandatory ? 1 : 0,
    publishedAt: body?.publishedAt ?? now,
    article: body?.article ?? null,
    articleTitle: (body?.articleTitle ?? '').trim() || null,
    createdAt: now,
    updatedAt: now,
  })
  const id = Number((result as unknown as [{ insertId: number }])[0].insertId)
  return { id }
})
