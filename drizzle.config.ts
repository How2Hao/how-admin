import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL?.trim()
  || `mysql://${encodeURIComponent(process.env.DB_USERNAME || 'root')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'}/${process.env.DB_DATABASE || 'how2hao_api'}`

export default defineConfig({
  out: './drizzle',
  schema: './drizzle/schema.ts',
  dialect: 'mysql',
  dbCredentials: {
    url: databaseUrl,
  },
})
