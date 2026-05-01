import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { benefitUsagePlatform } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const list = await db
    .select({
      id: benefitUsagePlatform.id,
      code: benefitUsagePlatform.code,
      name: benefitUsagePlatform.name,
      icon: benefitUsagePlatform.icon,
      sortOrder: benefitUsagePlatform.sortOrder,
      createdAt: benefitUsagePlatform.createdAt,
    })
    .from(benefitUsagePlatform)
    .orderBy(asc(benefitUsagePlatform.sortOrder), asc(benefitUsagePlatform.id))
  return { list }
})
