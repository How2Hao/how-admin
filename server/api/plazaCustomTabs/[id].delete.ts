import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { plazaCustomTab } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'ID 不合法' })

  const [existing] = await db.select({ id: plazaCustomTab.id }).from(plazaCustomTab).where(eq(plazaCustomTab.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'tab 不存在' })

  await db.delete(plazaCustomTab).where(eq(plazaCustomTab.id, id))
  return { ok: true }
})
