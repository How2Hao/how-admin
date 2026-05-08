import { desc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { appRelease } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const rows = await db
    .select({
      id: appRelease.id,
      version: appRelease.version,
      androidUrl: appRelease.androidUrl,
      iosUrl: appRelease.iosUrl,
      isMandatory: appRelease.isMandatory,
      publishedAt: appRelease.publishedAt,
    })
    .from(appRelease)
    .orderBy(desc(appRelease.id))

  return { list: rows }
})
