import { asc, eq } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, cardLevel, cardOrganization } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const [banks, orgs, levels] = await Promise.all([
    db.select({ id: bank.id, name: bank.name }).from(bank).orderBy(asc(bank.name)),
    db.select({ id: cardOrganization.id, name: cardOrganization.name })
      .from(cardOrganization)
      .where(eq(cardOrganization.status, 'ENABLED'))
      .orderBy(asc(cardOrganization.id)),
    db.select({ id: cardLevel.id, name: cardLevel.name }).from(cardLevel).orderBy(asc(cardLevel.id)),
  ])
  return {
    banks: banks.map(b => ({ label: b.name, value: b.id })),
    cardOrganizations: orgs.map(o => ({ label: o.name, value: o.id })),
    cardLevels: levels.map(l => ({ label: l.name, value: l.id })),
  }
})
