import { sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'

/**
 * 卡片活动覆盖率看板：交叉 bank_card（需求侧）vs task_template（供给侧），
 * 按 (省级桶 × 银行 × cardType) 三元组计算 user/template/gap，找出运营盲区。
 *
 * 关键决策：全国模板（regionCode=100000）不计入各省 templateCount，独立顶部展示。
 */

const NATIONAL_REGION_CODE = '100000'

type CardType = 'CREDIT' | 'DEBIT'
type CardTypeFilter = 'ALL' | CardType

type BucketType = 'NORMAL' | 'DIRECT' | 'SAR' | 'UNKNOWN'

interface RegionRow {
  regionCode: string
  regionName: string | null
  parentCode: string | null
  level: number | null
  regionType: string | null
}

interface Bucket {
  bucketCode: string
  bucketName: string
  bucketType: BucketType
  cityCode: string | null
  cityName: string | null
  cityTag: 'PLAN_SINGLE' | null
}

function unwrapRows<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw) && Array.isArray((raw as any)[0]))
    return (raw as any)[0] as T[]
  return (raw as T[]) ?? []
}

/** 把任意 region_code 归并到"省级桶 + 城市明细" */
function bucketize(regionCode: string, regionMap: Map<string, RegionRow>): Bucket {
  if (!regionCode) {
    return {
      bucketCode: 'UNKNOWN',
      bucketName: '未知地区',
      bucketType: 'UNKNOWN',
      cityCode: null,
      cityName: null,
      cityTag: null,
    }
  }
  const r = regionMap.get(regionCode)
  if (!r) {
    return {
      bucketCode: 'UNKNOWN',
      bucketName: `未知(${regionCode})`,
      bucketType: 'UNKNOWN',
      cityCode: null,
      cityName: null,
      cityTag: null,
    }
  }

  // 直辖市 / 特别行政区：自身就是省级桶
  if (r.regionType === 'DIRECT' || r.regionType === 'SAR') {
    return {
      bucketCode: r.regionCode,
      bucketName: r.regionName ?? r.regionCode,
      bucketType: r.regionType as BucketType,
      cityCode: null,
      cityName: null,
      cityTag: null,
    }
  }

  // 计划单列市：归所在省，但加 PLAN_SINGLE 标记
  if (r.regionType === 'PLAN_SINGLE') {
    const parent = r.parentCode ? regionMap.get(r.parentCode) : null
    if (parent) {
      return {
        bucketCode: parent.regionCode,
        bucketName: parent.regionName ?? parent.regionCode,
        bucketType: 'NORMAL',
        cityCode: r.regionCode,
        cityName: r.regionName ?? r.regionCode,
        cityTag: 'PLAN_SINGLE',
      }
    }
  }

  // 普通省（level=2）
  if (r.level === 2 && r.regionType === 'NORMAL') {
    return {
      bucketCode: r.regionCode,
      bucketName: r.regionName ?? r.regionCode,
      bucketType: 'NORMAL',
      cityCode: r.regionCode,
      cityName: '全省',
      cityTag: null,
    }
  }

  // 普通地级市（level=3）
  if (r.level === 3) {
    const parent = r.parentCode ? regionMap.get(r.parentCode) : null
    if (parent) {
      return {
        bucketCode: parent.regionCode,
        bucketName: parent.regionName ?? parent.regionCode,
        bucketType: (parent.regionType as BucketType) ?? 'NORMAL',
        cityCode: r.regionCode,
        cityName: r.regionName ?? r.regionCode,
        cityTag: null,
      }
    }
  }

  // 区/县（level >= 4）：递归向上找 level=3 city
  if ((r.level ?? 0) >= 4) {
    let cur: RegionRow | undefined = r
    while (cur && cur.parentCode) {
      const next = regionMap.get(cur.parentCode)
      if (!next) break
      if ((next.level ?? 0) <= 3) {
        cur = next
        break
      }
      cur = next
    }
    if (cur && (cur.level ?? 0) === 3) {
      const cityNode = cur
      // 城市属于直辖市的下属区
      if (cityNode.regionType === 'DIRECT') {
        return {
          bucketCode: cityNode.regionCode,
          bucketName: cityNode.regionName ?? cityNode.regionCode,
          bucketType: 'DIRECT',
          cityCode: null,
          cityName: null,
          cityTag: null,
        }
      }
      const provinceNode = cityNode.parentCode ? regionMap.get(cityNode.parentCode) : null
      if (provinceNode) {
        return {
          bucketCode: provinceNode.regionCode,
          bucketName: provinceNode.regionName ?? provinceNode.regionCode,
          bucketType: (provinceNode.regionType as BucketType) ?? 'NORMAL',
          cityCode: cityNode.regionCode,
          cityName: cityNode.regionName ?? cityNode.regionCode,
          cityTag: cityNode.regionType === 'PLAN_SINGLE' ? 'PLAN_SINGLE' : null,
        }
      }
    }
  }

  // 兜底
  return {
    bucketCode: r.regionCode,
    bucketName: r.regionName ?? r.regionCode,
    bucketType: 'UNKNOWN',
    cityCode: null,
    cityName: null,
    cityTag: null,
  }
}

interface CellAccum { credit: { user: number, tpl: number }, debit: { user: number, tpl: number } }
function emptyAccum(): CellAccum {
  return { credit: { user: 0, tpl: 0 }, debit: { user: 0, tpl: 0 } }
}

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const cardTypeFilter = (url.searchParams.get('cardType') ?? 'ALL') as CardTypeFilter
  const minUser = Math.max(Number(url.searchParams.get('minUser') ?? '1') || 1, 0)
  const banksParam = url.searchParams.get('banks')?.trim() ?? ''
  const banksFilter = banksParam ? new Set(banksParam.split(',').map(s => s.trim()).filter(Boolean)) : null

  const now = Date.now()

  const [regionRowsRaw, bankRowsRaw, cardRowsRaw, tplRowsRaw] = await Promise.all([
    db.execute(sql`SELECT region_code AS regionCode, region_name AS regionName,
      parent_code AS parentCode, level, region_type AS regionType FROM region`),
    db.execute(sql`SELECT id, name, logo, code FROM bank`),
    db.execute(sql`SELECT bank_id AS bankId, region_code AS regionCode, card_type AS cardType FROM bank_card`),
    db.execute(sql`
      SELECT bank_id AS bankId, region_code AS regionCode,
             region_match_strategy AS regionMatchStrategy,
             bank_card_type AS bankCardType
      FROM task_template
      WHERE is_visible = 1 AND (end_date IS NULL OR end_date > ${now})
    `),
  ])

  const regionRows = unwrapRows<RegionRow>(regionRowsRaw)
  const bankRows = unwrapRows<{ id: number, name: string, logo: string | null, code: string | null }>(bankRowsRaw)
  const cardRows = unwrapRows<{ bankId: string | null, regionCode: string | null, cardType: string | null }>(cardRowsRaw)
  const tplRows = unwrapRows<{ bankId: number, regionCode: string, regionMatchStrategy: string | null, bankCardType: string | null }>(tplRowsRaw)

  // ── 构建查找表 ──
  const regionMap = new Map<string, RegionRow>(regionRows.map(r => [r.regionCode, r]))
  const bankMap = new Map<string, { name: string, logo: string | null, code: string | null }>(
    bankRows.map(b => [String(b.id), { name: b.name, logo: b.logo, code: b.code }]),
  )

  // ── 用户绑卡聚合：bucketCode → cityCode|null → bankId → CellAccum ──
  // 顶层 cell 是省级 cell（cityCode=null），子层是各 city cell
  // 省级 cell.user = 该省所有 city user 之和（含未细分到 city 的）
  type CityMap = Map<string | null, Map<string, CellAccum>> // null = province-level row
  const userMatrix = new Map<string, CityMap>()
  // 同时记录每个省下的 city 列表 + tag
  const provinceCities = new Map<string, Map<string, { cityName: string, tag: 'PLAN_SINGLE' | null }>>()
  const bucketTypeMap = new Map<string, BucketType>()
  const bucketNameMap = new Map<string, string>()

  function ensureUserCell(bucket: Bucket, bankId: string): { provCell: CellAccum, cityCell: CellAccum | null } {
    if (!userMatrix.has(bucket.bucketCode)) userMatrix.set(bucket.bucketCode, new Map())
    const cmap = userMatrix.get(bucket.bucketCode)!
    if (!cmap.has(null)) cmap.set(null, new Map())
    const provLevel = cmap.get(null)!
    if (!provLevel.has(bankId)) provLevel.set(bankId, emptyAccum())
    const provCell = provLevel.get(bankId)!

    let cityCell: CellAccum | null = null
    if (bucket.cityCode) {
      if (!cmap.has(bucket.cityCode)) cmap.set(bucket.cityCode, new Map())
      const cityLevel = cmap.get(bucket.cityCode)!
      if (!cityLevel.has(bankId)) cityLevel.set(bankId, emptyAccum())
      cityCell = cityLevel.get(bankId)!

      // 记录省下的 city 元信息（用于后续返回 cities 数组）
      if (!provinceCities.has(bucket.bucketCode)) provinceCities.set(bucket.bucketCode, new Map())
      const cm = provinceCities.get(bucket.bucketCode)!
      if (!cm.has(bucket.cityCode)) {
        cm.set(bucket.cityCode, { cityName: bucket.cityName ?? bucket.cityCode, tag: bucket.cityTag })
      }
    }
    bucketTypeMap.set(bucket.bucketCode, bucket.bucketType)
    bucketNameMap.set(bucket.bucketCode, bucket.bucketName)
    return { provCell, cityCell }
  }

  // 用户侧聚合
  for (const c of cardRows) {
    const bankId = c.bankId ? String(c.bankId) : ''
    const ct = c.cardType
    if (!bankId || (ct !== 'CREDIT' && ct !== 'DEBIT')) continue
    const bucket = bucketize(c.regionCode ?? '', regionMap)
    const { provCell, cityCell } = ensureUserCell(bucket, bankId)
    if (ct === 'CREDIT') {
      provCell.credit.user += 1
      if (cityCell) cityCell.credit.user += 1
    }
    else {
      provCell.debit.user += 1
      if (cityCell) cityCell.debit.user += 1
    }
  }

  // ── 全国模板独立统计 + 省级 / 市级模板贡献 ──
  const nationwide = { total: 0, exactNationwide: 0, excludePlanSingle: 0 }

  function applyTplToCell(cell: CellAccum, ct: string | null) {
    if (ct === 'CREDIT') cell.credit.tpl += 1
    else if (ct === 'DEBIT') cell.debit.tpl += 1
    else if (!ct) {
      // 通用模板，对两种 cardType 都贡献 +1
      cell.credit.tpl += 1
      cell.debit.tpl += 1
    }
  }

  for (const t of tplRows) {
    const isNational = t.regionCode === NATIONAL_REGION_CODE
    if (isNational) {
      nationwide.total += 1
      if (t.regionMatchStrategy === 'EXCLUDE_PLAN_SINGLE_CITY') nationwide.excludePlanSingle += 1
      else nationwide.exactNationwide += 1
      continue // 不计入各省 templateCount（按决策）
    }

    // 非全国模板：归到省级桶 + 可能的 city
    const bucket = bucketize(t.regionCode, regionMap)
    if (bucket.bucketCode === 'UNKNOWN') continue
    const bankId = String(t.bankId)

    if (!userMatrix.has(bucket.bucketCode)) userMatrix.set(bucket.bucketCode, new Map())
    const cmap = userMatrix.get(bucket.bucketCode)!
    if (!cmap.has(null)) cmap.set(null, new Map())
    const provLevel = cmap.get(null)!
    if (!provLevel.has(bankId)) provLevel.set(bankId, emptyAccum())
    applyTplToCell(provLevel.get(bankId)!, t.bankCardType)

    // 模板若限定到具体地级市/区，再写一份到 city cell
    if (bucket.cityCode) {
      if (!cmap.has(bucket.cityCode)) cmap.set(bucket.cityCode, new Map())
      const cityLevel = cmap.get(bucket.cityCode)!
      if (!cityLevel.has(bankId)) cityLevel.set(bankId, emptyAccum())
      applyTplToCell(cityLevel.get(bankId)!, t.bankCardType)

      // 同步写入 provinceCities（让该 city 出现在 cities 数组中即使无用户）
      if (!provinceCities.has(bucket.bucketCode)) provinceCities.set(bucket.bucketCode, new Map())
      const cm = provinceCities.get(bucket.bucketCode)!
      if (!cm.has(bucket.cityCode)) {
        cm.set(bucket.cityCode, { cityName: bucket.cityName ?? bucket.cityCode, tag: bucket.cityTag })
      }
    }
    bucketTypeMap.set(bucket.bucketCode, bucket.bucketType)
    bucketNameMap.set(bucket.bucketCode, bucket.bucketName)
  }

  // ── 银行元数据 + TOP 筛选 ──
  const bankTotal = new Map<string, { credit: number, debit: number }>()
  for (const c of cardRows) {
    const bankId = c.bankId ? String(c.bankId) : ''
    if (!bankId) continue
    if (!bankTotal.has(bankId)) bankTotal.set(bankId, { credit: 0, debit: 0 })
    const t = bankTotal.get(bankId)!
    if (c.cardType === 'CREDIT') t.credit += 1
    else if (c.cardType === 'DEBIT') t.debit += 1
  }
  const banksMeta = [...bankTotal.entries()]
    .map(([bankId, totals]) => {
      const meta = bankMap.get(bankId)
      return {
        bankId,
        bankName: meta?.name ?? `bank#${bankId}`,
        logo: meta?.logo ?? null,
        totalCards: totals.credit + totals.debit,
        totalCredit: totals.credit,
        totalDebit: totals.debit,
      }
    })
    .sort((a, b) => b.totalCards - a.totalCards)

  // 应用 banks filter（如果有）
  const visibleBankIds = new Set(
    banksFilter
      ? banksMeta.filter(m => banksFilter.has(m.bankId)).map(m => m.bankId)
      : banksMeta.slice(0, 15).map(m => m.bankId), // 默认 TOP 15
  )

  // ── 构建 provinces 输出 ──
  function gapScore(user: number, tpl: number) {
    return user - tpl * 2
  }

  function buildBankCells(bankCellMap: Map<string, CellAccum>) {
    const cells: any[] = []
    for (const [bankId, accum] of bankCellMap.entries()) {
      if (!visibleBankIds.has(bankId)) continue
      cells.push({
        bankId,
        credit: {
          userCount: accum.credit.user,
          templateCount: accum.credit.tpl,
          gapScore: gapScore(accum.credit.user, accum.credit.tpl),
        },
        debit: {
          userCount: accum.debit.user,
          templateCount: accum.debit.tpl,
          gapScore: gapScore(accum.debit.user, accum.debit.tpl),
        },
      })
    }
    return cells
  }

  function provinceTotalUser(bucketCode: string): number {
    const cmap = userMatrix.get(bucketCode)
    const provLevel = cmap?.get(null)
    if (!provLevel) return 0
    let n = 0
    for (const accum of provLevel.values()) {
      n += accum.credit.user + accum.debit.user
    }
    return n
  }

  const provinces: any[] = []
  for (const [bucketCode, cmap] of userMatrix.entries()) {
    const provLevel = cmap.get(null) ?? new Map<string, CellAccum>()
    const bucketName = bucketNameMap.get(bucketCode) ?? bucketCode
    const bucketType = bucketTypeMap.get(bucketCode) ?? 'NORMAL'
    const totalUser = provinceTotalUser(bucketCode)

    const cities: any[] = []
    const cityMeta = provinceCities.get(bucketCode)
    if (cityMeta && bucketType !== 'DIRECT' && bucketType !== 'SAR') {
      for (const [cityCode, info] of cityMeta.entries()) {
        const cityLevel = cmap.get(cityCode) ?? new Map<string, CellAccum>()
        cities.push({
          cityCode,
          cityName: info.cityName,
          tag: info.tag, // 'PLAN_SINGLE' | null
          bankCells: buildBankCells(cityLevel),
        })
      }
      // 按城市总用户数排序
      cities.sort((a, b) => {
        const sumA = a.bankCells.reduce((s: number, c: any) => s + c.credit.userCount + c.debit.userCount, 0)
        const sumB = b.bankCells.reduce((s: number, c: any) => s + c.credit.userCount + c.debit.userCount, 0)
        return sumB - sumA
      })
    }

    provinces.push({
      bucketCode,
      bucketName,
      bucketType,
      provinceTotalUser: totalUser,
      bankCells: buildBankCells(provLevel),
      cities,
    })
  }
  // 按省总用户数倒序
  provinces.sort((a, b) => b.provinceTotalUser - a.provinceTotalUser)

  // ── topGap 计算（基于"最细粒度" cell：DIRECT/SAR 用省 cell；普通省用 city cell；若只有省 cell 也算）──
  type GapItem = {
    bucketCode: string
    bucketName: string
    bucketType: BucketType
    cityCode: string | null
    cityName: string | null
    cityTag: 'PLAN_SINGLE' | null
    bankId: string
    bankName: string
    cardType: CardType
    userCount: number
    templateCount: number
    gapScore: number
  }
  const gapItems: GapItem[] = []

  function pushGap(p: any, cellSrc: 'PROV' | 'CITY', cityCode: string | null, cityName: string | null, cityTag: 'PLAN_SINGLE' | null, bankCells: any[]) {
    for (const c of bankCells) {
      const meta = bankMap.get(c.bankId)
      for (const ct of ['credit', 'debit'] as const) {
        const cd = c[ct]
        if (cd.userCount < minUser) continue
        const cardType = (ct === 'credit' ? 'CREDIT' : 'DEBIT') as CardType
        if (cardTypeFilter !== 'ALL' && cardTypeFilter !== cardType) continue
        gapItems.push({
          bucketCode: p.bucketCode,
          bucketName: p.bucketName,
          bucketType: p.bucketType,
          cityCode,
          cityName,
          cityTag,
          bankId: c.bankId,
          bankName: meta?.name ?? `bank#${c.bankId}`,
          cardType,
          userCount: cd.userCount,
          templateCount: cd.templateCount,
          gapScore: cd.gapScore,
        })
      }
    }
  }

  for (const p of provinces) {
    if (p.bucketType === 'DIRECT' || p.bucketType === 'SAR') {
      pushGap(p, 'PROV', null, null, null, p.bankCells)
    }
    else if (p.cities.length === 0) {
      pushGap(p, 'PROV', null, null, null, p.bankCells)
    }
    else {
      // 普通省：用 city 粒度（避免与 province 重复）
      for (const city of p.cities) {
        pushGap(p, 'CITY', city.cityCode, city.cityName, city.tag, city.bankCells)
      }
    }
  }
  gapItems.sort((a, b) => b.gapScore - a.gapScore)
  const topGap = gapItems.slice(0, 50)

  const severeBlind = gapItems.filter(g => g.userCount >= minUser && g.templateCount === 0).length

  return {
    generatedAt: now,
    filters: {
      cardType: cardTypeFilter,
      minUser,
      banks: banksFilter ? [...banksFilter] : null,
    },
    nationwideTemplates: nationwide,
    banksMeta,
    provinces,
    topGap,
    severeBlind,
  }
})
