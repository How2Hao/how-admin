import { sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { userFeedback } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const rows = await db
    .select({
      type: userFeedback.type,
      count: sql<number>`count(*)`,
    })
    .from(userFeedback)
    .groupBy(userFeedback.type)
    .orderBy(sql`count(*) desc`)

  return {
    list: rows.map(r => ({ type: r.type, count: Number(r.count) })),
  }
})
