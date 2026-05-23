import { and, desc, eq, like, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { users, userFeedback } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20') || 20, 1), 100)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const type = url.searchParams.get('type')?.trim() ?? ''

  const conditions = [
    keyword ? like(userFeedback.content, `%${keyword}%`) : undefined,
    type ? eq(userFeedback.type, type) : undefined,
  ].filter(Boolean)
  const whereClause = conditions.length ? and(...conditions as any[]) : undefined

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(userFeedback)
    .where(whereClause)

  const rows = await db
    .select({
      id: userFeedback.id,
      userId: userFeedback.userId,
      type: userFeedback.type,
      content: userFeedback.content,
      images: userFeedback.images,
      context: userFeedback.context,
      status: userFeedback.status,
      resolutionType: userFeedback.resolutionType,
      minAppVersion: userFeedback.minAppVersion,
      resolutionNote: userFeedback.resolutionNote,
      resolvedAt: userFeedback.resolvedAt,
      createdAt: userFeedback.createdAt,
      username: users.username,
      uid6: users.uid6,
      avatar: users.avatar,
      phone: users.phone,
      lastLoginAt: users.lastLoginAt,
    })
    .from(userFeedback)
    .leftJoin(users, eq(userFeedback.userId, users.id))
    .where(whereClause)
    .orderBy(desc(userFeedback.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows,
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
    type,
  }
})
