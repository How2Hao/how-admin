import { sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'

/**
 * 「活动缺口用户」名单:近 7 日有活跃(user_sessions.last_used_at)且已录入银行卡、
 * 但当前**一个有效活动都匹配不到**的用户。供运营针对性补活动。
 *
 * 纯 admin:只读自身共享库,复刻 ha 的卡↔活动匹配(银行 + 卡类型 + 地区策略 + 卡组织)。
 * 卡组织走简化版集合匹配(活动要求的卡组织成员 ⊆ 卡支持的成员)。
 */

const NATIONAL_REGION_CODE = '100000'
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000

interface RegionRow { regionCode: string, parentCode: string | null, level: number | null, regionType: string | null, regionName: string | null }
interface TemplateRow { bankId: number, bankCardType: string | null, bankCardOrganization: string | null, regionCode: string, regionMatchStrategy: string | null }
interface CardRow { userId: number, bankId: string, cardType: string, cardOrganization: string, regionCode: string }

function unwrapRows<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw) && Array.isArray((raw as any)[0])) return (raw as any)[0] as T[]
  return (raw as T[]) ?? []
}

/** region_code → 省级桶 code(直辖市/SAR 自身即省级;市/区向上找 level≤2) */
function provinceOf(code: string, regionMap: Map<string, RegionRow>): string | null {
  let cur = regionMap.get(code)
  if (!cur) return null
  let guard = 0
  while (cur && (cur.level ?? 99) > 2 && cur.parentCode && guard++ < 8) {
    const p = regionMap.get(cur.parentCode)
    if (!p) break
    cur = p
  }
  return cur ? cur.regionCode : null
}

function isPlanSingleCity(code: string, regionMap: Map<string, RegionRow>): boolean {
  return regionMap.get(code)?.regionType === 'PLAN_SINGLE'
}

/** 复刻 ha 的地区匹配 */
function regionMatched(tmplCode: string, strategy: string | null, cardCode: string, regionMap: Map<string, RegionRow>): boolean {
  const t = (tmplCode || '').trim()
  if (!t || t === NATIONAL_REGION_CODE) return true
  const c = (cardCode || '').trim()
  if (!c) return false
  const s = (strategy || 'EXACT').trim().toUpperCase()
  if (s === 'EXACT') return c === t
  const tp = provinceOf(t, regionMap)
  const cp = provinceOf(c, regionMap)
  if (!tp || !cp || tp !== cp) return false
  if (s === 'INCLUDE_ALL') return true
  if (s === 'EXCLUDE_PLAN_SINGLE_CITY') return !isPlanSingleCity(c, regionMap)
  return c === t
}

/** 卡组织 id 展开为基础成员集合(组合卡组织 → 成员) */
function orgExpand(orgId: string, memberMap: Map<string, string[]>): Set<string> {
  const m = memberMap.get(orgId)
  return new Set(m && m.length ? m : [orgId])
}

/** 简化卡组织匹配:活动要求的网络全部被卡支持 */
function orgMatched(tmplOrg: string | null, cardOrg: string, memberMap: Map<string, string[]>): boolean {
  const t = (tmplOrg || '').trim()
  if (!t) return true
  const tmplSet = orgExpand(t, memberMap)
  const cardSet = orgExpand((cardOrg || '').trim(), memberMap)
  for (const x of tmplSet) if (!cardSet.has(x)) return false
  return true
}

function normCardType(raw: string | null): 'CREDIT' | 'DEBIT' {
  return (raw || '').trim().toUpperCase() === 'DEBIT' ? 'DEBIT' : 'CREDIT'
}

export default defineHandler(async () => {
  const now = Date.now()
  const sevenDaysAgo = now - SEVEN_DAYS_MS

  const [tplRaw, cardRaw, regionRaw, orgRaw, bankRaw, lastActiveRaw, userRaw] = await Promise.all([
    db.execute(sql`
      SELECT bank_id AS bankId, bank_card_type AS bankCardType,
             bank_card_organization AS bankCardOrganization,
             region_code AS regionCode, region_match_strategy AS regionMatchStrategy
      FROM task_template
      WHERE is_visible = 1 AND (end_date IS NULL OR end_date > ${now})
    `),
    db.execute(sql`
      SELECT user_id AS userId, bank_id AS bankId, card_type AS cardType,
             card_organization AS cardOrganization, region_code AS regionCode
      FROM bank_card
      WHERE user_id IN (SELECT DISTINCT user_id FROM user_sessions WHERE last_used_at >= ${sevenDaysAgo})
    `),
    db.execute(sql`SELECT region_code AS regionCode, parent_code AS parentCode, level, region_type AS regionType, region_name AS regionName FROM region`),
    db.execute(sql`SELECT id, member_org_ids AS memberOrgIds, name FROM card_organization`),
    db.execute(sql`SELECT id, name FROM bank`),
    db.execute(sql`SELECT user_id AS userId, MAX(last_used_at) AS lastActiveAt FROM user_sessions WHERE last_used_at >= ${sevenDaysAgo} GROUP BY user_id`),
    db.execute(sql`SELECT id, uid6, phone FROM users`),
  ])

  const templates = unwrapRows<TemplateRow>(tplRaw)
  const cards = unwrapRows<CardRow>(cardRaw)
  const regions = unwrapRows<RegionRow>(regionRaw)
  const orgs = unwrapRows<{ id: number, memberOrgIds: string | null, name: string }>(orgRaw)
  const banks = unwrapRows<{ id: number, name: string }>(bankRaw)
  const lastActive = unwrapRows<{ userId: number, lastActiveAt: number }>(lastActiveRaw)
  const users = unwrapRows<{ id: number, uid6: string, phone: string | null }>(userRaw)

  const regionMap = new Map<string, RegionRow>(regions.map(r => [r.regionCode, r]))
  const regionNameMap = new Map<string, string>(regions.map(r => [r.regionCode, r.regionName ?? r.regionCode]))
  const bankNameMap = new Map<number, string>(banks.map(b => [Number(b.id), b.name]))
  const orgNameMap = new Map<string, string>(orgs.map(o => [String(o.id), o.name]))
  const orgMemberMap = new Map<string, string[]>(
    orgs.map(o => [String(o.id), (o.memberOrgIds || '').split(',').map(s => s.trim()).filter(Boolean)]),
  )
  const lastActiveMap = new Map<number, number>(lastActive.map(r => [r.userId, Number(r.lastActiveAt)]))
  const userMap = new Map<number, { uid6: string, phone: string | null }>(users.map(u => [u.id, { uid6: u.uid6, phone: u.phone }]))

  // 活动按银行分桶,加速匹配
  const tplByBank = new Map<number, TemplateRow[]>()
  for (const t of templates) {
    const bid = Number(t.bankId)
    if (!tplByBank.has(bid)) tplByBank.set(bid, [])
    tplByBank.get(bid)!.push(t)
  }

  // 候选用户的卡分组
  const cardsByUser = new Map<number, CardRow[]>()
  for (const c of cards) {
    if (!cardsByUser.has(c.userId)) cardsByUser.set(c.userId, [])
    cardsByUser.get(c.userId)!.push(c)
  }

  function cardMatchesAny(card: CardRow): boolean {
    const list = tplByBank.get(Number(card.bankId))
    if (!list || list.length === 0) return false
    const cardType = normCardType(card.cardType)
    for (const t of list) {
      if (normCardType(t.bankCardType) !== cardType) continue
      if (!regionMatched(t.regionCode, t.regionMatchStrategy, card.regionCode, regionMap)) continue
      if (!orgMatched(t.bankCardOrganization, card.cardOrganization, orgMemberMap)) continue
      return true
    }
    return false
  }

  const result: any[] = []
  for (const [userId, userCards] of cardsByUser) {
    const matched = userCards.some(cardMatchesAny)
    if (matched) continue
    const u = userMap.get(userId)
    const cardDetails = userCards.map(c => ({
      bankId: c.bankId,
      bankName: bankNameMap.get(Number(c.bankId)) ?? `#${c.bankId}`,
      cardType: normCardType(c.cardType),
      orgName: orgNameMap.get((c.cardOrganization || '').trim()) ?? c.cardOrganization,
      regionCode: c.regionCode,
      regionName: regionNameMap.get(c.regionCode) ?? c.regionCode,
    }))
    // 建议补活动维度:去重 (银行 × 地区 × 卡组织)
    const dimSet = new Map<string, { bankName: string, regionName: string, orgName: string }>()
    for (const d of cardDetails) {
      const key = `${d.bankName}|${d.regionName}|${d.orgName}`
      if (!dimSet.has(key)) dimSet.set(key, { bankName: d.bankName, regionName: d.regionName, orgName: d.orgName })
    }
    result.push({
      userId,
      uid6: u?.uid6 ?? '',
      phone: u?.phone ?? null,
      lastActiveAt: lastActiveMap.get(userId) ?? null,
      cardCount: userCards.length,
      cards: cardDetails,
      dims: Array.from(dimSet.values()),
    })
  }

  result.sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))

  return {
    generatedAt: now,
    candidateTotal: cardsByUser.size, // 近7日活跃且有卡
    noMatchTotal: result.length,
    users: result,
  }
})
