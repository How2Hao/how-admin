<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import GapMatrix, { type ProvinceRow, type BankMeta } from '@/components/coverage-gap/GapMatrix.vue'
import GapList, { type GapItem } from '@/components/coverage-gap/GapList.vue'
import CellDetailDialog from '@/components/coverage-gap/CellDetailDialog.vue'

interface Overview {
  generatedAt: number
  filters: { cardType: 'ALL' | 'CREDIT' | 'DEBIT', minUser: number, banks: string[] | null }
  nationwideTemplates: { total: number, exactNationwide: number, excludePlanSingle: number }
  banksMeta: BankMeta[]
  provinces: ProvinceRow[]
  topGap: GapItem[]
  severeBlind: number
}

const data = ref<Overview | null>(null)
const loading = ref(false)

const cardType = ref<'ALL' | 'CREDIT' | 'DEBIT'>('ALL')
const minUser = ref(1)
const selectedBanks = ref<string[]>([])
const useDefaultTopBanks = ref(true)

async function fetchData() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('cardType', cardType.value)
    params.set('minUser', String(minUser.value))
    if (!useDefaultTopBanks.value && selectedBanks.value.length > 0) {
      params.set('banks', selectedBanks.value.join(','))
    }
    data.value = await requestJson<Overview>(`/api/dashboard/coverage-gap?${params.toString()}`)
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

// 默认 TOP 15 银行
const defaultTopBankIds = computed(() => (data.value?.banksMeta ?? []).slice(0, 15).map(b => b.bankId))
const visibleBankIds = computed(() => {
  if (useDefaultTopBanks.value) return defaultTopBankIds.value
  return selectedBanks.value.length > 0 ? selectedBanks.value : defaultTopBankIds.value
})

const bankOptions = computed(() =>
  (data.value?.banksMeta ?? []).map(b => ({
    label: `${b.bankName}（${b.totalCards}）`,
    value: b.bankId,
  })),
)

const bankLogoMap = computed<Record<string, string | null>>(() => {
  const m: Record<string, string | null> = {}
  for (const b of data.value?.banksMeta ?? []) m[b.bankId] = b.logo
  return m
})

// ── 联动：列表 -> 矩阵 ──
const highlightTarget = ref<{ bucketCode: string, cityCode: string | null, bankId: string, cardType: 'CREDIT' | 'DEBIT' } | null>(null)
function onListPick(item: GapItem) {
  highlightTarget.value = {
    bucketCode: item.bucketCode,
    cityCode: item.cityCode,
    bankId: item.bankId,
    cardType: item.cardType,
  }
}

// ── 矩阵 cell click -> 详情弹窗 ──
const detailVisible = ref(false)
const detailPayload = ref<{
  bucketName: string
  cityName: string | null
  bankId: string
  bankName: string
  cardType: 'CREDIT' | 'DEBIT'
  userCount: number
  templateCount: number
  gapScore: number
  regionCode: string
} | null>(null)

function onCellClick(payload: any) {
  const bankMeta = data.value?.banksMeta.find(b => b.bankId === payload.bankId)
  detailPayload.value = {
    bucketName: payload.province.bucketName,
    cityName: payload.isCity ? (payload.row.cityName as string) : null,
    bankId: payload.bankId,
    bankName: bankMeta?.bankName ?? payload.bankId,
    cardType: payload.cardType,
    userCount: payload.cell.userCount,
    templateCount: payload.cell.templateCount,
    gapScore: payload.cell.gapScore,
    regionCode: payload.isCity ? (payload.row.cityCode as string) : payload.province.bucketCode,
  }
  detailVisible.value = true
}

function fmtTs(ms: number): string {
  if (!ms) return '-'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch([cardType, minUser, useDefaultTopBanks, selectedBanks], () => {
  fetchData()
}, { deep: true })

onMounted(fetchData)
</script>

<template>
  <div class="coverage-page">
    <!-- 顶部 toolbar -->
    <header class="toolbar">
      <div class="tb-left">
        <h2 class="title">活动覆盖率（卡片 × 模板交叉）</h2>
        <span v-if="data?.generatedAt" class="generated">{{ fmtTs(data.generatedAt) }}</span>
      </div>
      <div class="tb-right">
        <t-radio-group v-model="cardType" size="small" variant="default-filled">
          <t-radio-button value="ALL">全部</t-radio-button>
          <t-radio-button value="CREDIT">信用卡</t-radio-button>
          <t-radio-button value="DEBIT">借记卡</t-radio-button>
        </t-radio-group>
        <span class="control-group">
          <span class="control-label">最小绑卡数</span>
          <t-input-number v-model="minUser" :min="0" :max="100" size="small" style="width: 80px" />
        </span>
        <t-checkbox v-model="useDefaultTopBanks" size="small">仅 TOP 15 银行</t-checkbox>
        <t-select
          v-if="!useDefaultTopBanks"
          v-model="selectedBanks"
          :options="bankOptions"
          multiple
          filterable
          placeholder="选银行"
          size="small"
          style="min-width: 200px"
        />
        <t-button size="small" theme="primary" :loading="loading" @click="fetchData">
          <template #icon><div i-carbon:rotate /></template>
          刷新
        </t-button>
      </div>
    </header>

    <!-- 全局摘要 -->
    <div v-if="data" class="summary">
      <span class="chip">
        <span class="chip-label">全国通用模板</span>
        <span class="chip-value">{{ data.nationwideTemplates.total }}</span>
        <span class="chip-meta">EXACT {{ data.nationwideTemplates.exactNationwide }} / 排除单列市 {{ data.nationwideTemplates.excludePlanSingle }}</span>
      </span>
      <span class="chip danger">
        <span class="chip-label">严重盲区</span>
        <span class="chip-value">{{ data.severeBlind }}</span>
        <span class="chip-meta">user≥{{ minUser }} 且 template=0</span>
      </span>
      <span class="chip">
        <span class="chip-label">覆盖银行</span>
        <span class="chip-value">{{ visibleBankIds.length }}</span>
        <span class="chip-meta">/ 共 {{ data.banksMeta.length }} 家</span>
      </span>
      <span class="chip">
        <span class="chip-label">省级桶</span>
        <span class="chip-value">{{ data.provinces.length }}</span>
      </span>
      <div class="legend">
        <span class="legend-item"><span class="dot red"></span>严重盲区</span>
        <span class="legend-item"><span class="dot orange"></span>缺口大</span>
        <span class="legend-item"><span class="dot yellow"></span>缺口小</span>
        <span class="legend-item"><span class="dot green"></span>已覆盖</span>
      </div>
    </div>

    <!-- 主体：左列表 + 右矩阵 -->
    <t-loading :loading="loading && !data" :delay="200">
      <div v-if="data" class="layout">
        <aside class="aside">
          <GapList
            :items="data.topGap"
            :severe-blind="data.severeBlind"
            :bank-logos="bankLogoMap"
            @pick="onListPick"
          />
        </aside>
        <main class="main">
          <GapMatrix
            :provinces="data.provinces"
            :banks-meta="data.banksMeta"
            :card-type="cardType"
            :visible-bank-ids="visibleBankIds"
            :highlight="highlightTarget"
            @cell-click="onCellClick"
          />
        </main>
      </div>
    </t-loading>

    <!-- 详情弹窗 -->
    <CellDetailDialog
      v-if="detailPayload"
      :visible="detailVisible"
      :bucket-name="detailPayload.bucketName"
      :city-name="detailPayload.cityName"
      :bank-id="detailPayload.bankId"
      :bank-name="detailPayload.bankName"
      :card-type="detailPayload.cardType"
      :user-count="detailPayload.userCount"
      :template-count="detailPayload.templateCount"
      :gap-score="detailPayload.gapScore"
      :region-code="detailPayload.regionCode"
      @update:visible="(v) => detailVisible = v"
    />
  </div>
</template>

<style scoped>
.coverage-page {
  padding: 16px 24px 24px;
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}
.tb-left { display: flex; align-items: baseline; gap: 14px; }
.title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
.generated { font-size: 12px; color: #94a3b8; }
.tb-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.control-group { display: inline-flex; align-items: center; gap: 6px; }
.control-label { font-size: 12px; color: #475569; }

.summary {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 10px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 12px;
}
.chip.danger { background: #fee2e2; }
.chip.danger .chip-value { color: #7f1d1d; }
.chip-label { color: #64748b; font-size: 11px; }
.chip-value { font-size: 16px; font-weight: 700; color: #0f172a; }
.chip-meta { color: #94a3b8; font-size: 10px; }

.legend { margin-left: auto; display: flex; gap: 12px; font-size: 11px; color: #64748b; }
.legend-item { display: inline-flex; align-items: center; gap: 4px; }
.dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dot.red { background: #fee2e2; }
.dot.orange { background: #fed7aa; }
.dot.yellow { background: #fef3c7; }
.dot.green { background: #dcfce7; }

.layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  min-height: 0;
}
@media (max-width: 1280px) {
  .layout { grid-template-columns: 260px 1fr; }
}
.aside, .main { min-height: 0; min-width: 0; }
</style>
