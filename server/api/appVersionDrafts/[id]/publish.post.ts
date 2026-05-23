import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { appRelease, appReleaseDraft } from '../../../../drizzle/schema'

// 发布：把草稿内容写入 app_release（ha/hi 由此可见），然后删除该草稿。
export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'ID 不合法' })

  const [draft] = await db.select().from(appReleaseDraft).where(eq(appReleaseDraft.id, id)).limit(1)
  if (!draft) throw createError({ statusCode: 404, statusMessage: '草稿不存在' })

  const now = Date.now()
  let releaseId: number
  try {
    const result = await db.insert(appRelease).values({
      version: draft.version,
      changelog: draft.changelog,
      androidUrl: draft.androidUrl ?? null,
      iosUrl: draft.iosUrl ?? null,
      isMandatory: draft.isMandatory,
      publishedAt: draft.publishedAt ?? now,
      article: draft.article ?? null,
      articleTitle: draft.articleTitle ?? null,
      createdAt: now,
    })
    releaseId = Number((result as unknown as [{ insertId: number }])[0].insertId)
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') throw createError({ statusCode: 409, statusMessage: `版本 ${draft.version} 已发布过` })
    throw createError({ statusCode: 500, statusMessage: `发布失败：${e?.message ?? e}` })
  }

  await db.delete(appReleaseDraft).where(eq(appReleaseDraft.id, id))
  return { id: releaseId }
})
