import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { appReleaseDraft } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'ID 不合法' })

  const [existing] = await db.select({ id: appReleaseDraft.id }).from(appReleaseDraft).where(eq(appReleaseDraft.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: '草稿不存在' })

  await db.delete(appReleaseDraft).where(eq(appReleaseDraft.id, id))
  return { ok: true }
})
