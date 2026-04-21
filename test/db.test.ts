import { describe, expect, it } from 'vitest'
import { accCategories, bank } from '../drizzle/schema'
import { db } from '../server/db'

describe('database connection', () => {
  it('should connect to database and query bank table', async () => {
    const banks = await db.select().from(bank).limit(5)
    expect(banks).toBeDefined()
    expect(banks.length).toBeGreaterThan(0)
    console.log('Banks:', banks)
  })

  it('should query acc_categories table', async () => {
    const categories = await db.select().from(accCategories).limit(5)
    expect(categories).toBeDefined()
    expect(categories.length).toBeGreaterThan(0)
    console.log('Categories:', categories)
  })
})
