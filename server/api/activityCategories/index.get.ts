import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { activityCategory } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const list = await db
    .select({
      id: activityCategory.id,
      code: activityCategory.code,
      name: activityCategory.name,
      parentId: activityCategory.parentId,
      icon: activityCategory.icon,
      sortOrder: activityCategory.sortOrder,
      createdAt: activityCategory.createdAt,
    })
    .from(activityCategory)
    .orderBy(asc(activityCategory.sortOrder), asc(activityCategory.id))
  return { list }
})
