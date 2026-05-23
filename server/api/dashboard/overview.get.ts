import { sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'

const DAY_MS = 86_400_000

/** 当日 00:00:00 的 UTC ms（按服务器时区，与运营所在 +8 一致） */
function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 生成 [windowDays] 个连续日期 'YYYY-MM-DD'，含今天，倒序展开 */
function dayBuckets(now: number, days: number): string[] {
  const buckets: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    buckets.push(`${y}-${m}-${day}`)
  }
  return buckets
}

/** mysql2 driver 返回 [rows, fields]，drizzle 0.x 把 rows 放在 [0]，但兼容老/新版本 */
function unwrapRows<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw) && Array.isArray((raw as any)[0]))
    return (raw as any)[0] as T[]
  return (raw as T[]) ?? []
}

/** SQL DATE() 在 mysql2 返回的可能是 Date 对象或 'YYYY-MM-DD' 字符串，统一成 'YYYY-MM-DD' */
function formatDateCell(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const day = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const s = String(v)
  // 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm:ss' 都取前 10 位
  return s.slice(0, 10)
}

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const windowParam = url.searchParams.get('window') ?? '7d'
  const windowDays = windowParam === '90d' ? 90 : windowParam === '30d' ? 30 : 7

  const now = Date.now()
  const todayStart = startOfTodayMs()
  const sevenDaysAgo = now - 7 * DAY_MS
  const thirtyDaysAgo = now - 30 * DAY_MS
  const windowStart = now - windowDays * DAY_MS
  const buckets = dayBuckets(now, windowDays)

  const [
    rawUsersKpi,
    rawActiveUsersKpi,
    rawBankCardsKpi,
    rawTxKpi,
    rawFeedbackKpi,
    rawBanksKpi,
    rawBankTypeTop3,

    rawUserRegisteredTrend,
    rawUserActiveTrend,
    rawCardCreatedTrend,
    rawTxCreatedTrend,
    rawFeedbackCreatedTrend,
    rawTemplateCreatedTrend,
    rawOccurrenceCompletedTrend,

    rawBanksTop10,
    rawCitiesTop10,
    rawCardTypeDist,
    rawBankTypeDist,
    rawUserOsSessions,
    rawNewUserOsSessions,

    rawOpenFeedback,
    rawAllActivity,
    rawTemplatesTop10,
    rawTemplatesTotal,
  ] = await Promise.all([
    // ───── KPI ─────
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(IF(created_at >= ${todayStart}, 1, 0)) AS today_new,
        SUM(IF(created_at >= ${sevenDaysAgo}, 1, 0)) AS week_new,
        SUM(IF(status='ACTIVE', 1, 0)) AS active_count,
        SUM(IF(status='PENDING_BIND', 1, 0)) AS pending_count,
        SUM(IF(status='DISABLED', 1, 0)) AS disabled_count
      FROM users
    `),
    db.execute(sql`
      SELECT
        SUM(IF(last_active_at >= ${todayStart}, 1, 0)) AS today_active,
        SUM(IF(last_active_at >= ${sevenDaysAgo}, 1, 0)) AS week_active,
        SUM(IF(last_active_at >= ${thirtyDaysAgo}, 1, 0)) AS month_active
      FROM (
        SELECT user_id, MAX(last_used_at) AS last_active_at
        FROM user_sessions
        GROUP BY user_id
      ) latest
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(IF(created_at >= ${todayStart}, 1, 0)) AS today_new,
        SUM(IF(card_type='CREDIT', 1, 0)) AS credit,
        SUM(IF(card_type='DEBIT', 1, 0)) AS debit
      FROM bank_card
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(IF(created_at >= ${todayStart}, 1, 0)) AS today_new,
        SUM(IF(type='INCOME', 1, 0)) AS income,
        SUM(IF(type='EXPENSE', 1, 0)) AS expense
      FROM acc_transactions
    `),
    db.execute(sql`
      SELECT
        SUM(IF(status='OPEN', 1, 0)) AS open_cnt,
        SUM(IF(status='IN_PROGRESS', 1, 0)) AS in_progress_cnt,
        SUM(IF(status IN ('OPEN','IN_PROGRESS'), 1, 0)) AS unresolved_cnt
      FROM user_feedback
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(IF(is_visible=1, 1, 0)) AS visible_cnt,
        SUM(IF(is_hot=1, 1, 0)) AS hot_cnt
      FROM bank
    `),
    db.execute(sql`
      SELECT bank_type AS bankType, COUNT(*) AS cnt
      FROM bank
      WHERE bank_type IS NOT NULL
      GROUP BY bank_type
      ORDER BY cnt DESC
      LIMIT 3
    `),

    // ───── trends ─────
    db.execute(sql`
      SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(*) AS cnt
      FROM users
      WHERE created_at >= ${windowStart}
      GROUP BY date
    `),
    db.execute(sql`
      SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(DISTINCT user_id) AS cnt
      FROM user_sessions
      WHERE created_at >= ${windowStart}
      GROUP BY date
    `),
    db.execute(sql`
      SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(*) AS cnt
      FROM bank_card
      WHERE created_at >= ${windowStart}
      GROUP BY date
    `),
    db.execute(sql`
      SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(*) AS cnt
      FROM acc_transactions
      WHERE created_at >= ${windowStart}
      GROUP BY date
    `),
    // user_feedback 列名实际是驼峰 camelCase（createdAt 是 datetime 类型，不是 bigint ms）
    db.execute(sql`
      SELECT DATE(createdAt) AS date, COUNT(*) AS cnt
      FROM user_feedback
      WHERE createdAt >= FROM_UNIXTIME(${windowStart} / 1000)
      GROUP BY date
    `),
    db.execute(sql`
      SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(*) AS cnt
      FROM task_template
      WHERE created_at >= ${windowStart}
      GROUP BY date
    `),
    db.execute(sql`
      SELECT DATE(FROM_UNIXTIME(completed_at / 1000)) AS date, COUNT(*) AS cnt
      FROM task_recurring_occurrence
      WHERE completed_at IS NOT NULL AND completed_at >= ${windowStart}
      GROUP BY date
    `),

    // ───── distributions ─────
    db.execute(sql`
      SELECT
        bc.bank_id AS bankId,
        b.name AS bankName,
        b.logo,
        COUNT(*) AS cnt
      FROM bank_card bc
      LEFT JOIN bank b ON CAST(bc.bank_id AS UNSIGNED) = b.id
      GROUP BY bc.bank_id, b.name, b.logo
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        bc.region_code AS regionCode,
        r.region_name AS regionName,
        COUNT(*) AS cnt
      FROM bank_card bc
      LEFT JOIN region r ON r.region_code = bc.region_code
      WHERE bc.region_code != ''
      GROUP BY bc.region_code, r.region_name
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        bc.card_type AS cardType,
        bc.card_organization AS cardOrgId,
        o.name AS cardOrgName,
        COUNT(*) AS cnt
      FROM bank_card bc
      LEFT JOIN card_organization o ON o.id = CAST(bc.card_organization AS UNSIGNED)
      GROUP BY bc.card_type, bc.card_organization, o.name
    `),
    db.execute(sql`
      SELECT COALESCE(bank_type, 'UNCLASSIFIED') AS bankType, COUNT(*) AS cnt
      FROM bank
      GROUP BY bank_type
    `),
    // 用户系统分布：每个用户取最近一次 session 的 user_agent，前端按 UA 归类到 iOS/Android/其他
    db.execute(sql`
      SELECT s.user_id AS userId, s.user_agent AS ua
      FROM user_sessions s
      INNER JOIN (
        SELECT user_id, MAX(last_used_at) AS m
        FROM user_sessions
        GROUP BY user_id
      ) latest ON latest.user_id = s.user_id AND latest.m = s.last_used_at
    `),
    // 新增用户系统分布：限定 window 内注册的用户，同样按最近 session 的 UA 归类
    db.execute(sql`
      SELECT s.user_id AS userId, s.user_agent AS ua
      FROM user_sessions s
      INNER JOIN (
        SELECT user_id, MAX(last_used_at) AS m
        FROM user_sessions
        GROUP BY user_id
      ) latest ON latest.user_id = s.user_id AND latest.m = s.last_used_at
      INNER JOIN users u ON u.id = s.user_id AND u.created_at >= ${windowStart}
    `),

    // ───── tables ─────
    db.execute(sql`
      SELECT
        f.id,
        f.type,
        LEFT(f.content, 120) AS content,
        u.username,
        u.uid6,
        u.id AS userId,
        UNIX_TIMESTAMP(f.createdAt) * 1000 AS createdAtMs
      FROM user_feedback f
      LEFT JOIN users u ON u.id = f.userId
      WHERE f.status = 'OPEN'
      ORDER BY f.createdAt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT user_id, MAX(last_used_at) AS lastActiveAt
      FROM user_sessions
      GROUP BY user_id
    `),
    db.execute(sql`
      SELECT
        bct.id AS templateId,
        bct.card_name AS templateName,
        bct.card_level AS cardLevel,
        bct.cover,
        bct.bank_id AS bankId,
        b.name AS bankName,
        b.logo AS bankLogo,
        COUNT(bc.id) AS cnt
      FROM bank_card_template bct
      INNER JOIN bank_card bc ON bc.template_id = bct.id
      LEFT JOIN bank b ON CAST(bct.bank_id AS UNSIGNED) = b.id
      GROUP BY bct.id, bct.card_name, bct.card_level, bct.cover, bct.bank_id, b.name, b.logo
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT template_id) AS cnt
      FROM bank_card
      WHERE template_id IS NOT NULL
    `),
  ])

  // ───── 拆解 KPI 单行 ─────
  const u = unwrapRows<any>(rawUsersKpi)[0] ?? {}
  const a = unwrapRows<any>(rawActiveUsersKpi)[0] ?? {}
  const c = unwrapRows<any>(rawBankCardsKpi)[0] ?? {}
  const t = unwrapRows<any>(rawTxKpi)[0] ?? {}
  const f = unwrapRows<any>(rawFeedbackKpi)[0] ?? {}
  const bk = unwrapRows<any>(rawBanksKpi)[0] ?? {}
  const bktop3 = unwrapRows<any>(rawBankTypeTop3)

  // ───── 趋势：合并到一个 series ─────
  const userRegistered = unwrapRows<any>(rawUserRegisteredTrend)
  const userActive = unwrapRows<any>(rawUserActiveTrend)
  const cardCreated = unwrapRows<any>(rawCardCreatedTrend)
  const txCreated = unwrapRows<any>(rawTxCreatedTrend)
  const feedbackCreated = unwrapRows<any>(rawFeedbackCreatedTrend)
  const templateCreated = unwrapRows<any>(rawTemplateCreatedTrend)
  const occurrenceCompleted = unwrapRows<any>(rawOccurrenceCompletedTrend)

  function toMap(rows: any[]): Map<string, number> {
    const m = new Map<string, number>()
    for (const r of rows) {
      const d = formatDateCell(r.date)
      if (d) m.set(d, Number(r.cnt))
    }
    return m
  }
  const regMap = toMap(userRegistered)
  const actMap = toMap(userActive)
  const cardMap = toMap(cardCreated)
  const txMap = toMap(txCreated)
  const fbMap = toMap(feedbackCreated)
  const tmplMap = toMap(templateCreated)
  const occMap = toMap(occurrenceCompleted)

  const userGrowth = buckets.map(date => ({
    date,
    registered: regMap.get(date) ?? 0,
    active: actMap.get(date) ?? 0,
  }))
  const interaction = buckets.map(date => ({
    date,
    cards: cardMap.get(date) ?? 0,
    transactions: txMap.get(date) ?? 0,
    feedback: fbMap.get(date) ?? 0,
  }))
  const taskOps = buckets.map(date => ({
    date,
    templatesCreated: tmplMap.get(date) ?? 0,
    occurrencesCompleted: occMap.get(date) ?? 0,
  }))

  // ───── 分布 ─────
  const banksTop10 = unwrapRows<any>(rawBanksTop10).map(r => ({
    bankId: String(r.bankId),
    bankName: r.bankName ?? `bank#${r.bankId}`,
    logo: r.logo ?? null,
    count: Number(r.cnt),
  }))
  const citiesTop10 = unwrapRows<any>(rawCitiesTop10).map(r => ({
    regionCode: String(r.regionCode),
    regionName: r.regionName ?? r.regionCode,
    count: Number(r.cnt),
  }))
  const cardTypeDist = unwrapRows<any>(rawCardTypeDist).map(r => ({
    cardType: r.cardType ?? 'UNKNOWN',
    cardOrgId: r.cardOrgId == null ? '' : String(r.cardOrgId),
    cardOrgName: r.cardOrgName ?? '未知',
    count: Number(r.cnt),
  }))
  const bankTypeDist = unwrapRows<any>(rawBankTypeDist).map(r => ({
    bankType: String(r.bankType),
    count: Number(r.cnt),
  }))

  // 用户系统分布：按用户去重（每用户最近 session），UA 归类 iOS / Android / OTHER
  function classifyOs(ua: unknown): 'iOS' | 'Android' | 'OTHER' {
    const s = String(ua ?? '').toLowerCase()
    if (/darwin|cfnetwork|iphone|ipad|ios/.test(s)) return 'iOS'
    if (/okhttp|android|dalvik/.test(s)) return 'Android'
    return 'OTHER'
  }
  function osDistFromSessions(raw: unknown): { os: string, count: number }[] {
    const osByUser = new Map<number, 'iOS' | 'Android' | 'OTHER'>()
    for (const r of unwrapRows<any>(raw)) {
      const uid = Number(r.userId)
      if (!osByUser.has(uid)) osByUser.set(uid, classifyOs(r.ua))
    }
    const counts: Record<'iOS' | 'Android' | 'OTHER', number> = { iOS: 0, Android: 0, OTHER: 0 }
    for (const os of osByUser.values()) counts[os]++
    return (['iOS', 'Android', 'OTHER'] as const)
      .filter(os => counts[os] > 0)
      .map(os => ({ os, count: counts[os] }))
  }
  const userOsDist = osDistFromSessions(rawUserOsSessions)
  const newUserOsDist = osDistFromSessions(rawNewUserOsSessions)

  // ───── 表格 ─────
  const openFeedback = unwrapRows<any>(rawOpenFeedback).map(r => ({
    id: Number(r.id),
    type: String(r.type ?? ''),
    content: String(r.content ?? ''),
    username: r.username ?? null,
    uid6: r.uid6 ?? null,
    userId: r.userId == null ? null : Number(r.userId),
    createdAt: Number(r.createdAtMs ?? 0),
  }))
  const templatesTop10 = unwrapRows<any>(rawTemplatesTop10).map(r => ({
    templateId: Number(r.templateId),
    templateName: r.templateName ?? '未知模板',
    cardLevel: r.cardLevel == null || r.cardLevel === '' ? null : Number(r.cardLevel),
    cover: r.cover ?? null,
    bankId: r.bankId == null ? '' : String(r.bankId),
    bankName: r.bankName ?? '未知银行',
    bankLogo: r.bankLogo ?? null,
    count: Number(r.cnt),
  }))

  // ───── 流失趋势：每用户取 max(last_used_at) 作为最近活跃时刻，
  //       window 内每天 snapshot 统计 ≥7/14/30 天未活跃的累计人数 ─────
  const activityTimestamps = unwrapRows<any>(rawAllActivity)
    .map(r => Number(r.lastActiveAt) || 0)
    .filter(t => t > 0)
    .sort((a, b) => a - b)

  function countLE(arr: number[], target: number): number {
    let lo = 0, hi = arr.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (arr[mid] <= target) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const churnByThreshold = buckets.map((date) => {
    const dateMs = new Date(`${date}T23:59:59.999`).getTime()
    return {
      date,
      d7: countLE(activityTimestamps, dateMs - 7 * DAY_MS),
      d14: countLE(activityTimestamps, dateMs - 14 * DAY_MS),
      d30: countLE(activityTimestamps, dateMs - 30 * DAY_MS),
    }
  })

  return {
    windowDays,
    generatedAt: now,
    kpi: {
      users: {
        total: Number(u.total) || 0,
        todayNew: Number(u.today_new) || 0,
        weekNew: Number(u.week_new) || 0,
        statusDist: {
          ACTIVE: Number(u.active_count) || 0,
          PENDING_BIND: Number(u.pending_count) || 0,
          DISABLED: Number(u.disabled_count) || 0,
        },
      },
      activeUsers: {
        today: Number(a.today_active) || 0,
        week: Number(a.week_active) || 0,
        month: Number(a.month_active) || 0,
      },
      bankCards: {
        total: Number(c.total) || 0,
        todayNew: Number(c.today_new) || 0,
        credit: Number(c.credit) || 0,
        debit: Number(c.debit) || 0,
      },
      transactions: {
        total: Number(t.total) || 0,
        todayNew: Number(t.today_new) || 0,
        income: Number(t.income) || 0,
        expense: Number(t.expense) || 0,
      },
      feedback: {
        open: Number(f.open_cnt) || 0,
        inProgress: Number(f.in_progress_cnt) || 0,
        totalUnresolved: Number(f.unresolved_cnt) || 0,
      },
      banks: {
        total: Number(bk.total) || 0,
        visible: Number(bk.visible_cnt) || 0,
        hot: Number(bk.hot_cnt) || 0,
        byTypeTop3: bktop3.map(r => ({ bankType: String(r.bankType), count: Number(r.cnt) })),
      },
    },
    trends: {
      userGrowth,
      interaction,
      taskOps,
      churnByThreshold,
    },
    distributions: {
      banksTop10,
      citiesTop10,
      cardTypeDist,
      bankTypeDist,
      userOsDist,
      newUserOsDist,
    },
    tables: {
      openFeedback,
      templatesTop10,
      templatesTotal: Number(unwrapRows<any>(rawTemplatesTotal)[0]?.cnt) || 0,
    },
  }
})
