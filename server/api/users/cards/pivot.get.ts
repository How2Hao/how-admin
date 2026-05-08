import { sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, region } from '../../../../drizzle/schema'

interface AggRow {
  bankId: string
  cityCode: string | null
  cnt: number | string
}

export default defineHandler(async () => {
  // 这个 DB 的 level 约定：1=全国，2=省/直辖市，3=市/区。
  // 98% (1019/1035) 卡片 regionCode 已是 level=3（杭州市/深圳市/黄浦区...），
  // 剩余 16 张卡是直接选了 level=2 省级。直接用 bc.region_code 不上卷，
  // 既保留城市颗粒度，又把省级当独立桶展示。
  const rawRows = await db.execute(sql`
    SELECT
      bc.bank_id AS bankId,
      bc.region_code AS cityCode,
      COUNT(*) AS cnt
    FROM bank_card bc
    GROUP BY bc.bank_id, bc.region_code
  `)
  // mysql2 returns [rows, fields]; drizzle's .execute() forwards rows in [0]
  const rows = (Array.isArray(rawRows) && Array.isArray(rawRows[0]) ? rawRows[0] : rawRows) as AggRow[]

  const agg = rows.map(r => ({
    bankId: String(r.bankId),
    cityCode: r.cityCode ?? '',
    cnt: Number(r.cnt),
  }))

  const bankIds = Array.from(new Set(agg.map(a => Number(a.bankId)).filter(Number.isFinite)))
  const cityCodes = Array.from(new Set(agg.map(a => a.cityCode).filter(Boolean)))

  const [bankRows, regionRows] = await Promise.all([
    bankIds.length
      ? db.select({ id: bank.id, name: bank.name })
        .from(bank)
        .where(sql`${bank.id} IN (${sql.join(bankIds.map(id => sql`${id}`), sql`, `)})`)
      : Promise.resolve([] as { id: number, name: string }[]),
    cityCodes.length
      ? db.select({ regionCode: region.regionCode, regionName: region.regionName, level: region.level })
        .from(region)
        .where(sql`${region.regionCode} IN (${sql.join(cityCodes.map(c => sql`${c}`), sql`, `)})`)
      : Promise.resolve([] as { regionCode: string, regionName: string | null, level: number | null }[]),
  ])

  const bankNameMap = new Map(bankRows.map(b => [String(b.id), b.name]))
  const regionMap = new Map(regionRows.map(r => [r.regionCode, { name: r.regionName ?? r.regionCode, level: r.level ?? 0 }]))

  const bankTotals = new Map<string, number>()
  const cityTotals = new Map<string, number>()
  for (const a of agg) {
    bankTotals.set(a.bankId, (bankTotals.get(a.bankId) ?? 0) + a.cnt)
    cityTotals.set(a.cityCode, (cityTotals.get(a.cityCode) ?? 0) + a.cnt)
  }

  const banks = [...bankTotals.entries()]
    .map(([id, total]) => ({ id, name: bankNameMap.get(id) ?? `bank#${id}`, total }))
    .sort((a, b) => b.total - a.total)
  const cities = [...cityTotals.entries()]
    .map(([code, total]) => ({
      code,
      name: regionMap.get(code)?.name ?? code,
      level: regionMap.get(code)?.level ?? 0,
      total,
    }))
    .sort((a, b) => b.total - a.total)

  const bankIdx = new Map(banks.map((b, i) => [b.id, i]))
  const cityIdx = new Map(cities.map((c, i) => [c.code, i]))
  const cells: [number, number, number][] = []
  for (const a of agg) {
    const bi = bankIdx.get(a.bankId)
    const ci = cityIdx.get(a.cityCode)
    if (bi !== undefined && ci !== undefined)
      cells.push([bi, ci, a.cnt])
  }

  return {
    banks,
    cities,
    cells,
    totalCards: agg.reduce((s, a) => s + a.cnt, 0),
  }
})
