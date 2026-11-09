import process from 'node:process'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../../drizzle/schema'

const databaseUrl = process.env.DATABASE_URL?.trim()
const sharedPoolOptions = {
  // 远程 MySQL 会按 wait_timeout 关闭空闲连接；开 TCP keepalive 让池中空闲连接不被静默断开，
  // 否则空闲后第一条查询会拿到已失效的连接 → read ECONNRESET (fatal)。
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
}

const poolConnection = databaseUrl
  ? mysql.createPool({
      ...sharedPoolOptions,
      uri: databaseUrl,
    })
  : mysql.createPool({
      ...sharedPoolOptions,
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'how2hao_api',
    })

export const db = drizzle(poolConnection, { schema, mode: 'default' })
