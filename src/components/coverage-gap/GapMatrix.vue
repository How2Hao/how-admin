<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export interface CellNum { userCount: number, templateCount: number, gapScore: number }
export interface BankCell { bankId: string, credit: CellNum, debit: CellNum }
export interface CityRow {
  cityCode: string
  cityName: string
  tag: 'PLAN_SINGLE' | null
  bankCells: BankCell[]
}
export interface ProvinceRow {
  bucketCode: string
  bucketName: string
  bucketType: 'NORMAL' | 'DIRECT' | 'SAR' | 'UNKNOWN'
  provinceTotalUser: number
  bankCells: BankCell[]
  cities: CityRow[]
}
export interface BankMeta {
  bankId: string
  bankName: string
  logo: string | null
  totalCards: number
  totalCredit: number
  totalDebit: number
}

interface Props {
  provinces: ProvinceRow[]
  banksMeta: BankMeta[]
  cardType: 'ALL' | 'CREDIT' | 'DEBIT'
  /** 仅显示这些银行（已过滤，按用户量倒序） */
  visibleBankIds: string[]
  /** 高亮目标 cell（联动） */
  highlight?: { bucketCode: string, cityCode?: string | null, bankId: string, cardType: 'CREDIT' | 'DEBIT' } | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'cellClick', payload: { row: ProvinceRow | CityRow, isCity: boolean, province: ProvinceRow, bankId: string, cardType: 'CREDIT' | 'DEBIT', cell: CellNum }): void
}>()

const expanded = ref<Set<string>>(new Set())
function toggleExpand(code: string) {
  if (expanded.value.has(code)) expanded.value.delete(code)
  else expanded.value.add(code)
  expanded.value = new Set(expanded.value)
}

const visibleBankMetas = computed(() =>
  props.visibleBankIds
    .map(id => props.banksMeta.find(b => b.bankId === id))
    .filter((b): b is BankMeta => !!b),
)

const showCredit = computed(() => props.cardType === 'ALL' || props.cardType === 'CREDIT')
const showDebit = computed(() => props.cardType === 'ALL' || props.cardType === 'DEBIT')

/** 单元格颜色 + 文字判定 */
function cellStyle(cell: CellNum) {
  if (cell.userCount === 0) {
    return { backgroundColor: '#F8FAFC', color: '#CBD5E1' }
  }
  if (cell.templateCount === 0) {
    // 严重盲区（红）
    return { backgroundColor: '#FEE2E2', color: '#7F1D1D', fontWeight: 600 }
  }
  if (cell.gapScore >= 5) {
    return { backgroundColor: '#FED7AA', color: '#7C2D12' } // 橙
  }
  if (cell.gapScore >= 1) {
    return { backgroundColor: '#FEF3C7', color: '#78350F' } // 黄
  }
  return { backgroundColor: '#DCFCE7', color: '#14532D' } // 绿（已覆盖）
}

function bankCellOf(cells: BankCell[], bankId: string): BankCell {
  return (
    cells.find(c => c.bankId === bankId) ?? {
      bankId,
      credit: { userCount: 0, templateCount: 0, gapScore: 0 },
      debit: { userCount: 0, templateCount: 0, gapScore: 0 },
    }
  )
}

function bucketIcon(t: ProvinceRow['bucketType']): string {
  if (t === 'DIRECT') return '🏛️'
  if (t === 'SAR') return '🏝️'
  if (t === 'UNKNOWN') return '❓'
  return '🏙️'
}

/** 跨行总用户 + 总模板（用于"总计"列） */
function rowTotals(cells: BankCell[]) {
  let user = 0
  let tpl = 0
  for (const c of cells) {
    if (showCredit.value) {
      user += c.credit.userCount
      tpl += c.credit.templateCount
    }
    if (showDebit.value) {
      user += c.debit.userCount
      tpl += c.debit.templateCount
    }
  }
  return { user, tpl, gap: user - tpl * 2 }
}

// ── 高亮联动 ──
const highlightedKey = ref<string>('')
function cellKey(provCode: string, cityCode: string | null, bankId: string, ct: 'CREDIT' | 'DEBIT') {
  return `${provCode}|${cityCode ?? ''}|${bankId}|${ct}`
}

watch(
  () => props.highlight,
  async (h) => {
    if (!h) {
      highlightedKey.value = ''
      return
    }
    // 自动展开目标省（如有 cityCode）
    if (h.cityCode) expanded.value = new Set([...expanded.value, h.bucketCode])
    await nextTick()
    const key = cellKey(h.bucketCode, h.cityCode ?? null, h.bankId, h.cardType)
    highlightedKey.value = key
    // 滚动到目标 cell
    await nextTick()
    const el = document.querySelector(`[data-cell-key="${key}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
    // 3 秒后取消高亮
    setTimeout(() => {
      if (highlightedKey.value === key) highlightedKey.value = ''
    }, 3000)
  },
)

function onCellClick(province: ProvinceRow, row: ProvinceRow | CityRow, isCity: boolean, bankId: string, ct: 'CREDIT' | 'DEBIT') {
  const cells = isCity ? (row as CityRow).bankCells : (row as ProvinceRow).bankCells
  const cell = bankCellOf(cells, bankId)[ct === 'CREDIT' ? 'credit' : 'debit']
  emit('cellClick', { row, isCity, province, bankId, cardType: ct, cell })
}
</script>

<template>
  <div class="matrix-wrap">
    <table class="matrix">
      <colgroup>
        <col style="width: 200px">
        <col v-for="b in visibleBankMetas" :key="b.bankId" :style="`width: ${showCredit && showDebit ? 120 : 80}px`">
        <col style="width: 100px">
      </colgroup>
      <thead>
        <tr class="hd-1">
          <th rowspan="2" class="hd-region">地区</th>
          <th
            v-for="b in visibleBankMetas"
            :key="b.bankId"
            :colspan="showCredit && showDebit ? 2 : 1"
            class="hd-bank"
          >
            <div class="hd-bank-inner">
              <img v-if="b.logo" :src="b.logo" :alt="b.bankName" class="hd-bank-logo">
              <div v-else class="hd-bank-logo placeholder">{{ b.bankName.slice(0, 1) }}</div>
              <div class="hd-bank-text">
                <div class="hd-bank-name" :title="b.bankName">{{ b.bankName }}</div>
                <div class="hd-bank-meta">{{ b.totalCards }} 张</div>
              </div>
            </div>
          </th>
          <th rowspan="2" class="hd-total">行总计<br><span class="muted">用户/模板</span></th>
        </tr>
        <tr class="hd-2">
          <template v-for="b in visibleBankMetas" :key="`s-${b.bankId}`">
            <th v-if="showCredit" class="hd-sub credit">信用</th>
            <th v-if="showDebit" class="hd-sub debit">借记</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <template v-for="p in provinces" :key="p.bucketCode">
          <tr class="row-prov">
            <td class="td-region">
              <button
                v-if="p.cities.length > 0"
                class="expand-btn"
                @click="toggleExpand(p.bucketCode)"
              >
                {{ expanded.has(p.bucketCode) ? '▾' : '▸' }}
              </button>
              <span v-else class="expand-btn empty"></span>
              <span class="bucket-icon">{{ bucketIcon(p.bucketType) }}</span>
              <span class="bucket-name">{{ p.bucketName }}</span>
              <span class="prov-total">{{ p.provinceTotalUser }} 张卡</span>
            </td>
            <template v-for="b in visibleBankMetas" :key="`p-${p.bucketCode}-${b.bankId}`">
              <td
                v-if="showCredit"
                class="td-cell"
                :data-cell-key="cellKey(p.bucketCode, null, b.bankId, 'CREDIT')"
                :class="{ highlighted: highlightedKey === cellKey(p.bucketCode, null, b.bankId, 'CREDIT') }"
                :style="cellStyle(bankCellOf(p.bankCells, b.bankId).credit)"
                :title="`${p.bucketName} · ${b.bankName} · 信用：${bankCellOf(p.bankCells, b.bankId).credit.userCount} 张卡 / ${bankCellOf(p.bankCells, b.bankId).credit.templateCount} 个模板（gap=${bankCellOf(p.bankCells, b.bankId).credit.gapScore}）`"
                @click="onCellClick(p, p, false, b.bankId, 'CREDIT')"
              >
                <span v-if="bankCellOf(p.bankCells, b.bankId).credit.userCount === 0">·</span>
                <template v-else>
                  <span class="num">{{ bankCellOf(p.bankCells, b.bankId).credit.userCount }}</span>
                  <span class="sep">/</span>
                  <span class="num">{{ bankCellOf(p.bankCells, b.bankId).credit.templateCount }}</span>
                </template>
              </td>
              <td
                v-if="showDebit"
                class="td-cell"
                :data-cell-key="cellKey(p.bucketCode, null, b.bankId, 'DEBIT')"
                :class="{ highlighted: highlightedKey === cellKey(p.bucketCode, null, b.bankId, 'DEBIT') }"
                :style="cellStyle(bankCellOf(p.bankCells, b.bankId).debit)"
                :title="`${p.bucketName} · ${b.bankName} · 借记：${bankCellOf(p.bankCells, b.bankId).debit.userCount} 张卡 / ${bankCellOf(p.bankCells, b.bankId).debit.templateCount} 个模板（gap=${bankCellOf(p.bankCells, b.bankId).debit.gapScore}）`"
                @click="onCellClick(p, p, false, b.bankId, 'DEBIT')"
              >
                <span v-if="bankCellOf(p.bankCells, b.bankId).debit.userCount === 0">·</span>
                <template v-else>
                  <span class="num">{{ bankCellOf(p.bankCells, b.bankId).debit.userCount }}</span>
                  <span class="sep">/</span>
                  <span class="num">{{ bankCellOf(p.bankCells, b.bankId).debit.templateCount }}</span>
                </template>
              </td>
            </template>
            <td class="td-total">
              <span class="num">{{ rowTotals(p.bankCells).user }}</span>
              <span class="sep">/</span>
              <span class="num">{{ rowTotals(p.bankCells).tpl }}</span>
            </td>
          </tr>

          <!-- 城市子行 -->
          <template v-if="expanded.has(p.bucketCode)">
            <tr v-for="city in p.cities" :key="`${p.bucketCode}-${city.cityCode}`" class="row-city">
              <td class="td-region city">
                <span class="indent"></span>
                <span v-if="city.tag === 'PLAN_SINGLE'" class="city-tag">📍 单列</span>
                <span class="city-name">{{ city.cityName }}</span>
              </td>
              <template v-for="b in visibleBankMetas" :key="`c-${p.bucketCode}-${city.cityCode}-${b.bankId}`">
                <td
                  v-if="showCredit"
                  class="td-cell sub"
                  :data-cell-key="cellKey(p.bucketCode, city.cityCode, b.bankId, 'CREDIT')"
                  :class="{ highlighted: highlightedKey === cellKey(p.bucketCode, city.cityCode, b.bankId, 'CREDIT') }"
                  :style="cellStyle(bankCellOf(city.bankCells, b.bankId).credit)"
                  :title="`${city.cityName} · ${b.bankName} · 信用：${bankCellOf(city.bankCells, b.bankId).credit.userCount}/${bankCellOf(city.bankCells, b.bankId).credit.templateCount}`"
                  @click="onCellClick(p, city, true, b.bankId, 'CREDIT')"
                >
                  <span v-if="bankCellOf(city.bankCells, b.bankId).credit.userCount === 0">·</span>
                  <template v-else>
                    <span class="num">{{ bankCellOf(city.bankCells, b.bankId).credit.userCount }}</span>
                    <span class="sep">/</span>
                    <span class="num">{{ bankCellOf(city.bankCells, b.bankId).credit.templateCount }}</span>
                  </template>
                </td>
                <td
                  v-if="showDebit"
                  class="td-cell sub"
                  :data-cell-key="cellKey(p.bucketCode, city.cityCode, b.bankId, 'DEBIT')"
                  :class="{ highlighted: highlightedKey === cellKey(p.bucketCode, city.cityCode, b.bankId, 'DEBIT') }"
                  :style="cellStyle(bankCellOf(city.bankCells, b.bankId).debit)"
                  :title="`${city.cityName} · ${b.bankName} · 借记：${bankCellOf(city.bankCells, b.bankId).debit.userCount}/${bankCellOf(city.bankCells, b.bankId).debit.templateCount}`"
                  @click="onCellClick(p, city, true, b.bankId, 'DEBIT')"
                >
                  <span v-if="bankCellOf(city.bankCells, b.bankId).debit.userCount === 0">·</span>
                  <template v-else>
                    <span class="num">{{ bankCellOf(city.bankCells, b.bankId).debit.userCount }}</span>
                    <span class="sep">/</span>
                    <span class="num">{{ bankCellOf(city.bankCells, b.bankId).debit.templateCount }}</span>
                  </template>
                </td>
              </template>
              <td class="td-total sub">
                <span class="num">{{ rowTotals(city.bankCells).user }}</span>
                <span class="sep">/</span>
                <span class="num">{{ rowTotals(city.bankCells).tpl }}</span>
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.matrix-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  overflow: auto;
  max-height: calc(100vh - 220px);
}
.matrix {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}
.matrix thead th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  z-index: 2;
  border-bottom: 1px solid #e2e8f0;
  padding: 6px 8px;
  text-align: center;
  white-space: nowrap;
  font-weight: 600;
}
.matrix .hd-region {
  position: sticky;
  left: 0;
  z-index: 3;
  background: #f8fafc;
  text-align: left;
  padding-left: 12px;
  border-right: 1px solid #e2e8f0;
}
.matrix .hd-bank {
  padding: 6px 4px;
}
.matrix .hd-bank-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.matrix .hd-bank-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 3px;
  background: white;
}
.matrix .hd-bank-logo.placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}
.matrix .hd-bank-text {
  text-align: left;
  min-width: 0;
}
.matrix .hd-bank-name {
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}
.matrix .hd-bank-meta {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 400;
}
.matrix .hd-sub {
  top: 38px;
  padding: 4px 6px;
  font-size: 11px;
  font-weight: 500;
}
.matrix .hd-sub.credit { color: #1e40af; background: #eff6ff; }
.matrix .hd-sub.debit { color: #166534; background: #f0fdf4; }
.matrix .hd-total {
  font-size: 11px;
  background: #f1f5f9;
}
.muted { color: #94a3b8; font-size: 10px; font-weight: 400; }

.matrix tbody td {
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
}
.td-region {
  position: sticky;
  left: 0;
  background: white;
  z-index: 1;
  border-right: 1px solid #e2e8f0;
  padding: 8px 12px;
  white-space: nowrap;
}
.td-region.city {
  background: #fafcff;
  padding-left: 24px;
}
.expand-btn {
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  margin-right: 4px;
}
.expand-btn.empty { cursor: default; }
.bucket-icon { margin-right: 4px; }
.bucket-name { font-weight: 600; color: #0f172a; }
.prov-total {
  margin-left: 8px;
  color: #94a3b8;
  font-size: 10px;
}
.indent { display: inline-block; width: 18px; }
.city-tag {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  margin-right: 4px;
}
.city-name { color: #475569; }

.td-cell {
  text-align: center;
  cursor: pointer;
  padding: 6px 4px;
  transition: filter 0.15s;
}
.td-cell:hover { filter: brightness(0.95); }
.td-cell.sub { padding: 5px 4px; opacity: 0.95; }
.td-cell.highlighted {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
  animation: pulse 1s ease-in-out 2;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
.num { font-weight: 600; font-variant: tabular-nums; }
.sep { color: rgba(0,0,0,0.35); margin: 0 2px; }
.td-total {
  background: #f8fafc;
  text-align: center;
  padding: 6px 8px;
  font-size: 11px;
}
</style>
