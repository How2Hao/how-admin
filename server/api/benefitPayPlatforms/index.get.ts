import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { benefitPayPlatform } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const list = await db
    .select({
      id: benefitPayPlatform.id,
      code: benefitPayPlatform.code,
      name: benefitPayPlatform.name,
      icon: benefitPayPlatform.icon,
      sortOrder: benefitPayPlatform.sortOrder,
    })
    .from(benefitPayPlatform)
    .orderBy(asc(benefitPayPlatform.sortOrder), asc(benefitPayPlatform.id))
  return { list }
})
