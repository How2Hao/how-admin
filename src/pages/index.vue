<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import KpiCard from '@/components/dashboard/KpiCard.vue'
import TrendLineChart from '@/components/dashboard/TrendLineChart.vue'
import HorizontalBarChart from '@/components/dashboard/HorizontalBarChart.vue'
import PieChart from '@/components/dashboard/PieChart.vue'
import SimpleTable from '@/components/dashboard/SimpleTable.vue'

interface Overview {
  windowDays: number
  generatedAt: number
  kpi: {
    users: { total: number, todayNew: number, weekNew: number, statusDist: { ACTIVE: number, PENDING_BIND: number, DISABLED: number } }
    activeUsers: { today: number, week: number, month: number }
    bankCards: { total: number, todayNew: number, credit: number, debit: number }
    transactions: { total: number, todayNew: number, income: number, expense: number }
    feedback: { open: number, inProgress: number, totalUnresolved: number }
    banks: { total: number, visible: number, hot: number, byTypeTop3: { bankType: string, count: number }[] }
  }
  trends: {
    userGrowth: { date: string, registered: number, active: number }[]
    interaction: { date: string, cards: number, transactions: number, feedback: number }[]
    taskOps: { date: string, templatesCreated: number, occurrencesCompleted: number }[]
    churnByThreshold: { date: string, d7: number, d14: number, d30: number }[]
  }
  distributions: {
    banksTop10: { bankId: string, bankName: string, logo: string | null, count: number }[]
    citiesTop10: { regionCode: string, regionName: string, count: number }[]
    cardTypeDist: { cardType: string, cardOrgId: string, cardOrgName: string, count: number }[]
    bankTypeDist: { bankType: string, count: number }[]
    userOsDist: { os: string, count: number }[]
    newUserOsDist: { os: string, count: number }[]
  }
  tables: {
    openFeedback: { id: number, type: string, content: string, username: string | null, uid6: string | null, userId: number | null, createdAt: number }[]
    templatesTop10: {
      templateId: number
      templateName: string
      cardLevel: number | null
      cover: string | null
      bankId: string
      bankName: string
      bankLogo: string | null
      count: number
    }[]
    templatesTotal: number
  }
}

const BANK_TYPE_LABEL: Record<string, string> = {
  STATE_OWNED: '国有',
  JOINT_STOCK: '股份制',
  CITY_COMMERCIAL: '城商',
  RURAL_COMMERCIAL: '农商',
  RURAL_CREDIT_COOP: '农信社',
  JOINT_VENTURE: '合资',
  VILLAGE: '村镇',
  PRIVATE: '民营',
  UNCLASSIFIED: '未分类',
}

const TYPE_LABEL: Record<string, string> = { bug: '问题', suggestion: '建议', feature: '功能', other: '其他' }

const CARD_LEVEL_LABEL: Record<number, string> = {
  1: '普卡',
  2: '金卡',
  3: '白金',
  4: '钻石',
  5: '私行',
}

const data = ref<Overview | null>(null)
const loading = ref(false)
const window = ref<'7d' | '30d' | '90d'>('7d')

async function fetchOverview() {
  loading.value = true
  try {
    data.value = await requestJson<Overview>(`/api/dashboard/overview?window=${window.value}`)
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载仪表盘失败')
  }
  finally {
    loading.value = false
  }
}

function fmtTs(ms: number): string {
  if (!ms) return '-'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const userGrowthChart = computed(() => {
  const t = data.value?.trends.userGrowth ?? []
  return {
    xAxis: t.map(r => r.date.slice(5)), // MM-DD
    series: [
      { name: '新注册', data: t.map(r => r.registered), color: '#3b82f6' },
      { name: '新登录', data: t.map(r => r.active), color: '#10b981' },
    ],
  }
})

const interactionChart = computed(() => {
  const t = data.value?.trends.interaction ?? []
  return {
    xAxis: t.map(r => r.date.slice(5)),
    series: [
      { name: '绑卡', data: t.map(r => r.cards), color: '#8b5cf6' },
      { name: '记账', data: t.map(r => r.transactions), color: '#f59e0b' },
      { name: '反馈', data: t.map(r => r.feedback), color: '#ef4444' },
    ],
  }
})

const taskOpsChart = computed(() => {
  const t = data.value?.trends.taskOps ?? []
  return {
    xAxis: t.map(r => r.date.slice(5)),
    series: [
      { name: '模板新增', data: t.map(r => r.templatesCreated), color: '#0ea5e9' },
      { name: '任务完成', data: t.map(r => r.occurrencesCompleted), color: '#22c55e' },
    ],
  }
})

const banksTop10Items = computed(() =>
  (data.value?.distributions.banksTop10 ?? []).map(r => ({ label: r.bankName, value: r.count })),
)
const citiesTop10Items = computed(() =>
  (data.value?.distributions.citiesTop10 ?? []).map(r => ({ label: r.regionName, value: r.count })),
)

/** 卡类型饼图：内圈卡组织 / 外圈卡类型 */
const cardTypeDistPie = computed(() => {
  const all = data.value?.distributions.cardTypeDist ?? []
  // 内圈：cardOrg 聚合
  const orgMap = new Map<string, number>()
  for (const r of all) {
    orgMap.set(r.cardOrgName, (orgMap.get(r.cardOrgName) ?? 0) + r.count)
  }
  // 外圈：cardType 聚合
  const typeMap = new Map<string, number>()
  for (const r of all) {
    const k = r.cardType === 'CREDIT' ? '信用卡' : r.cardType === 'DEBIT' ? '借记卡' : r.cardType
    typeMap.set(k, (typeMap.get(k) ?? 0) + r.count)
  }
  return {
    inner: [...typeMap.entries()].map(([label, value]) => ({ label, value })),
    outer: [...orgMap.entries()].map(([label, value]) => ({ label, value })),
  }
})

const bankTypeDistPie = computed(() =>
  (data.value?.distributions.bankTypeDist ?? []).map(r => ({
    label: BANK_TYPE_LABEL[r.bankType] ?? r.bankType,
    value: r.count,
  })),
)

const OS_LABEL: Record<string, string> = { iOS: 'iOS', Android: 'Android', OTHER: '其他' }
function toOsPie(rows: { os: string, count: number }[]) {
  return rows.map(r => ({ label: OS_LABEL[r.os] ?? r.os, value: r.count }))
}
const userOsDistPie = computed(() => toOsPie(data.value?.distributions.userOsDist ?? []))
const newUserOsDistPie = computed(() => toOsPie(data.value?.distributions.newUserOsDist ?? []))

const templatesWithRank = computed(() =>
  (data.value?.tables.templatesTop10 ?? []).map((r, i) => ({ ...r, rank: i + 1 })),
)

const churnChart = computed(() => {
  const t = data.value?.trends.churnByThreshold ?? []
  return {
    xAxis: t.map(r => r.date.slice(5)),
    series: [
      { name: '≥7 天', data: t.map(r => r.d7), color: '#3b82f6' },
      { name: '≥14 天', data: t.map(r => r.d14), color: '#f59e0b' },
      { name: '≥30 天', data: t.map(r => r.d30), color: '#ef4444' },
    ],
  }
})

const feedbackCols = [
  { colKey: 'type', title: '类型', width: 70 },
  { colKey: 'content', title: '内容' },
  { colKey: 'user', title: '用户', width: 120 },
  { colKey: 'createdAt', title: '时间', width: 130 },
]
const templateCols = [
  { colKey: 'rank', title: '#', width: 48 },
  { colKey: 'template', title: '卡片模板' },
  { colKey: 'level', title: '等级', width: 80 },
  { colKey: 'count', title: '引用数', width: 90 },
]

onMounted(fetchOverview)
</script>

<template>
  <div class="dashboard">
    <header class="bar">
      <div class="bar-left">
        <h2 class="title">运营仪表盘</h2>
        <span v-if="data?.generatedAt" class="generated">数据时间 {{ fmtTs(data.generatedAt) }}</span>
      </div>
      <div class="bar-right">
        <t-radio-group v-model="window" size="small" variant="default-filled" @change="fetchOverview">
          <t-radio-button value="7d">7 天</t-radio-button>
          <t-radio-button value="30d">30 天</t-radio-button>
          <t-radio-button value="90d">90 天</t-radio-button>
        </t-radio-group>
        <t-button size="small" theme="primary" :loading="loading" @click="fetchOverview">
          <template #icon>
            <div i-carbon:rotate />
          </template>
          刷新
        </t-button>
      </div>
    </header>

    <t-loading :loading="loading && !data" :delay="200">
      <template v-if="data">
        <!-- ── KPI 区 ── -->
        <section class="kpi-grid">
          <KpiCard
            title="总用户"
            :value="data.kpi.users.total"
            :subs="[
              { label: '今日新增', value: `+${data.kpi.users.todayNew}`, theme: 'success' },
              { label: '7日新增', value: `+${data.kpi.users.weekNew}`, theme: 'success' },
            ]"
            :bars="[
              { label: '活跃', value: data.kpi.users.statusDist.ACTIVE, color: '#16a34a' },
              { label: '待绑定', value: data.kpi.users.statusDist.PENDING_BIND, color: '#f59e0b' },
              { label: '禁用', value: data.kpi.users.statusDist.DISABLED, color: '#94a3b8' },
            ]"
          />
          <KpiCard
            title="活跃用户"
            :value="data.kpi.activeUsers.today"
            :subs="[
              { label: '今日 DAU', value: data.kpi.activeUsers.today },
              { label: '7日 WAU', value: data.kpi.activeUsers.week },
              { label: '30日 MAU', value: data.kpi.activeUsers.month },
            ]"
          />
          <KpiCard
            title="总绑卡"
            :value="data.kpi.bankCards.total"
            :subs="[{ label: '今日新增', value: `+${data.kpi.bankCards.todayNew}`, theme: 'success' }]"
            :bars="[
              { label: '信用', value: data.kpi.bankCards.credit, color: '#3b82f6' },
              { label: '借记', value: data.kpi.bankCards.debit, color: '#10b981' },
            ]"
          />
          <KpiCard
            title="记账条目"
            :value="data.kpi.transactions.total"
            :subs="[{ label: '今日新增', value: `+${data.kpi.transactions.todayNew}`, theme: 'success' }]"
            :bars="[
              { label: '收入', value: data.kpi.transactions.income, color: '#16a34a' },
              { label: '支出', value: data.kpi.transactions.expense, color: '#ef4444' },
            ]"
          />
          <KpiCard
            title="未处理反馈"
            :value="data.kpi.feedback.totalUnresolved"
            :accent="data.kpi.feedback.open > 0 ? '#dc2626' : undefined"
            :subs="[
              { label: 'OPEN', value: data.kpi.feedback.open, theme: 'danger' },
              { label: '处理中', value: data.kpi.feedback.inProgress, theme: 'warning' },
            ]"
          />
          <KpiCard
            title="支持银行"
            :value="data.kpi.banks.visible"
            :subs="[
              { label: '总数', value: data.kpi.banks.total },
              { label: '热门', value: data.kpi.banks.hot, theme: 'warning' },
              ...data.kpi.banks.byTypeTop3.slice(0, 2).map(t => ({
                label: BANK_TYPE_LABEL[t.bankType] ?? t.bankType,
                value: t.count,
              })),
            ]"
          />
        </section>

        <!-- ── 趋势图区 ── -->
        <section class="trend-grid">
          <TrendLineChart title="用户增长" :x-axis="userGrowthChart.xAxis" :series="userGrowthChart.series" />
          <TrendLineChart title="业务交互" :x-axis="interactionChart.xAxis" :series="interactionChart.series" />
          <TrendLineChart title="任务运营" :x-axis="taskOpsChart.xAxis" :series="taskOpsChart.series" />
          <TrendLineChart title="用户流失（按未活跃天数）" :x-axis="churnChart.xAxis" :series="churnChart.series" />
        </section>

        <!-- ── 分布图区 ── -->
        <section class="dist-grid">
          <HorizontalBarChart title="银行 TOP10（按绑卡数）" :items="banksTop10Items" color="#3b82f6" />
          <HorizontalBarChart title="城市 TOP10（按绑卡数）" :items="citiesTop10Items" color="#10b981" />
          <PieChart
            title="卡类型 × 卡组织"
            :inner="cardTypeDistPie.inner"
            :outer="cardTypeDistPie.outer"
          />
          <PieChart title="银行分类分布" :items="bankTypeDistPie" />
          <PieChart title="用户系统分布" :items="userOsDistPie" />
          <PieChart title="新增用户系统分布" :items="newUserOsDistPie" />
        </section>

        <!-- ── 表格区 ── -->
        <section class="table-grid">
          <SimpleTable
            title="待处理反馈 TOP10"
            :columns="feedbackCols"
            :data="data.tables.openFeedback"
            empty-text="暂无 OPEN 状态的反馈"
            :height="320"
          >
            <template #type="{ row }">
              <t-tag size="small" variant="light">{{ TYPE_LABEL[row.type] ?? row.type }}</t-tag>
            </template>
            <template #content="{ row }">
              <span class="trunc" :title="row.content">{{ row.content }}</span>
            </template>
            <template #user="{ row }">
              <div class="user-cell">
                <div class="user-name">{{ row.username || '未知' }}</div>
                <div class="user-meta">#{{ row.uid6 || row.userId }}</div>
              </div>
            </template>
            <template #createdAt="{ row }">
              <span class="muted">{{ fmtTs(row.createdAt) }}</span>
            </template>
          </SimpleTable>


          <SimpleTable
            title="卡片模板 TOP10（按用户绑卡数）"
            :columns="templateCols"
            :data="templatesWithRank"
            :total="data.tables.templatesTotal"
            empty-text="暂无用户绑卡引用模板"
            :height="320"
          >
            <template #rank="{ row }">
              <span class="rank-badge" :class="{ 'rank-top': row.rank <= 3 }">{{ row.rank }}</span>
            </template>
            <template #template="{ row }">
              <div class="template-cell">
                <t-image
                  v-if="row.cover"
                  :src="row.cover"
                  :style="{ width: '40px', height: '26px', borderRadius: '3px', flexShrink: 0 }"
                  fit="cover"
                  :lazy="true"
                />
                <div class="template-text">
                  <div class="template-name" :title="row.templateName">{{ row.templateName }}</div>
                  <div class="template-bank">{{ row.bankName }}</div>
                </div>
              </div>
            </template>
            <template #level="{ row }">
              <t-tag v-if="row.cardLevel != null" size="small" variant="light">
                {{ CARD_LEVEL_LABEL[row.cardLevel] ?? `Lv.${row.cardLevel}` }}
              </t-tag>
              <span v-else class="muted">-</span>
            </template>
            <template #count="{ row }">
              <span class="count-value">{{ row.count }}</span>
            </template>
          </SimpleTable>
        </section>
      </template>
    </t-loading>
  </div>
</template>

<style scoped>
.dashboard { padding: 16px 24px 32px; }

.bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.bar-left { display: flex; align-items: baseline; gap: 14px; }
.title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
.generated { font-size: 12px; color: #94a3b8; }
.bar-right { display: flex; align-items: center; gap: 10px; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.trend-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.dist-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.table-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}

@media (min-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dist-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .trend-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .table-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.muted { color: #64748b; font-size: 12px; }
.trunc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  color: #334155;
}
.user-cell { line-height: 1.3; }
.user-name { font-size: 12px; color: #0f172a; font-weight: 500; }
.user-meta { font-size: 11px; color: #94a3b8; }
.rank-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  font-size: 11px; font-weight: 600; color: #64748b;
  background: #f1f5f9;
}
.rank-badge.rank-top { background: #fef3c7; color: #b45309; }
.template-cell { display: flex; align-items: center; gap: 10px; }
.template-text { line-height: 1.3; min-width: 0; flex: 1; }
.template-name {
  font-size: 12px; color: #0f172a; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.template-bank { font-size: 11px; color: #94a3b8; }
.count-value { font-size: 13px; font-weight: 600; color: #0f172a; }
</style>
