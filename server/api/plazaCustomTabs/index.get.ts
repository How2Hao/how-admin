import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { plazaCustomTab } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const list = await db
    .select()
    .from(plazaCustomTab)
    .orderBy(asc(plazaCustomTab.sortOrder), asc(plazaCustomTab.id))
  return { list }
})
