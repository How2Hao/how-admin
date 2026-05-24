import process from 'node:process'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../../drizzle/schema'
import 'dotenv/config'

const poolConnection = mysql.createPool({
  uri: process.env.DATABASE_URL,
  // 远程 MySQL 会按 wait_timeout 关闭空闲连接；开 TCP keepalive 让池中空闲连接不被静默断开，
  // 否则空闲后第一条查询会拿到已失效的连接 → read ECONNRESET (fatal)。
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
})

export const db = drizzle(poolConnection, { schema, mode: 'default' })
