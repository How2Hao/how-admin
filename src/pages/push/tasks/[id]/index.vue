<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

interface Detail {
  id: number
  name: string
  status: string
  type: string
  triggerSource: string
  audienceType: string
  audienceSnapshotCount: number | null
  title: string
  body: string
  imageUrl: string | null
  landingType: string
  landingPayload: any
  statsTotal: number
  statsInboxWritten: number
  statsSent: number
  statsFailed: number
  statsOpened: number
  statsFilteredByType: number
  statsFilteredByMaster: number
  createdAt: number
  sentStartedAt: number | null
  sentFinishedAt: number | null
}
interface SendRow {
  id: number
  userId: number
  username: string | null
  uid6: string | null
  channel: string | null
  status: string | null
  errorCode: string | null
  errorReason: string | null
  attemptedAt: number | null
  sentAt: number | null
  readAt: number | null
  openedVia: string | null
}

const detail = ref<Detail | null>(null)
const sends = ref<SendRow[]>([])
const summary = ref<Record<string, number>>({})
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [d, s] = await Promise.all([
      requestJson<Detail>(`/api/admin/push/tasks/${id.value}`),
      requestJson<{ list: SendRow[], summary: Record<string, number> }>(`/api/admin/push/tasks/${id.value}/sends`),
    ])
    detail.value = d
    sends.value = s.list
    summary.value = s.summary
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

function fmtTime(ts: number | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const TYPE_LABEL: Record<string, string> = {
  ACTIVITY: '🎁 活动推送',
  ANNOUNCEMENT: '📢 系统公告',
  FEEDBACK_REPLY: '💬 反馈回复',
  SYSTEM: '⚠️ 系统消息',
}

const failedGrouped = computed(() => {
  const map = new Map<string, number>()
  for (const s of sends.value) {
    if (s.status !== 'FAILED') continue
    const key = s.errorCode || 'unknown'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
})

/** 漏斗：从受众到打开的转化 */
const funnel = computed(() => {
  if (!detail.value) return []
  const d = detail.value
  const total = d.statsTotal || 0
  return [
    { label: '受众解析', value: total, pct: 100 },
    { label: '进消息中心', value: d.statsInboxWritten, pct: total > 0 ? (d.statsInboxWritten / total) * 100 : 0 },
    { label: '横幅送达', value: d.statsSent, pct: total > 0 ? (d.statsSent / total) * 100 : 0 },
    { label: '用户打开', value: d.statsOpened, pct: total > 0 ? (d.statsOpened / total) * 100 : 0 },
  ]
})

onMounted(load)
</script>

<template>
  <div class="page-detail">
    <div class="back-bar">
      <t-button variant="text" @click="router.push('/push/tasks')">
        <template #icon><div i-carbon:arrow-left /></template>
        返回
      </t-button>
      <span v-if="detail" class="task-name">{{ detail.name }}</span>
      <t-tag v-if="detail" theme="primary" variant="light" size="small">
        {{ TYPE_LABEL[detail.type] || detail.type }}
      </t-tag>
    </div>

    <t-loading :loading="loading && !detail">
      <template v-if="detail">
        <!-- 顶部统计 -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-num">{{ detail.statsTotal }}</div>
            <div class="stat-label">受众总数</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{{ detail.statsInboxWritten }}</div>
            <div class="stat-label">进消息中心</div>
          </div>
          <div class="stat-card">
            <div class="stat-num success">{{ detail.statsSent }}</div>
            <div class="stat-label">横幅送出</div>
          </div>
          <div class="stat-card">
            <div class="stat-num danger">{{ detail.statsFailed }}</div>
            <div class="stat-label">横幅失败</div>
          </div>
          <div class="stat-card">
            <div class="stat-num primary">{{ detail.statsOpened }}</div>
            <div class="stat-label">用户打开</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">
              {{ detail.statsInboxWritten > 0 ? (detail.statsOpened / detail.statsInboxWritten * 100).toFixed(1) + '%' : '—' }}
            </div>
            <div class="stat-label">打开率</div>
          </div>
        </div>

        <!-- 漏斗 -->
        <t-card title="转化漏斗">
          <div class="funnel">
            <div v-for="f in funnel" :key="f.label" class="funnel-row">
              <div class="funnel-label">{{ f.label }}</div>
              <div class="funnel-bar-wrap">
                <div class="funnel-bar" :style="{ width: `${Math.max(2, f.pct).toFixed(1)}%` }" />
                <span class="funnel-val">{{ f.value }} ({{ f.pct.toFixed(1) }}%)</span>
              </div>
            </div>
          </div>
          <div v-if="detail.statsFilteredByType > 0 || detail.statsFilteredByMaster > 0" class="filter-notes">
            <div v-if="detail.statsFilteredByType > 0">
              · 关闭了该类型通知：<b>{{ detail.statsFilteredByType }}</b> 人（已进消息中心，未推横幅）
            </div>
            <div v-if="detail.statsFilteredByMaster > 0">
              · 关闭了推送总开关：<b>{{ detail.statsFilteredByMaster }}</b> 人（已进消息中心，未推横幅）
            </div>
          </div>
        </t-card>

        <!-- 失败明细 group -->
        <t-card v-if="failedGrouped.length" title="失败原因分组">
          <div class="failed-grouped">
            <div v-for="[code, count] in failedGrouped" :key="code" class="grouped-row">
              <t-tag theme="danger" variant="light">{{ code }}</t-tag>
              <span class="count">{{ count }} 台</span>
            </div>
          </div>
        </t-card>

        <!-- 任务信息 -->
        <t-card title="任务信息">
          <dl class="meta-list">
            <dt>状态</dt><dd>{{ detail.status }}</dd>
            <dt>类型</dt><dd>{{ TYPE_LABEL[detail.type] || detail.type }}</dd>
            <dt>触发</dt><dd>{{ detail.triggerSource === 'ADMIN' ? '手动' : '系统' }}</dd>
            <dt>受众</dt><dd>{{ detail.audienceType }} · 快照 {{ detail.audienceSnapshotCount }} 人</dd>
            <dt>标题</dt><dd>{{ detail.title }}</dd>
            <dt>正文</dt><dd>{{ detail.body }}</dd>
            <dt v-if="detail.imageUrl">图片</dt>
            <dd v-if="detail.imageUrl"><img :src="detail.imageUrl" style="max-height: 80px"></dd>
            <dt>落地页</dt><dd>{{ detail.landingType }}{{ detail.landingPayload ? ' · ' + JSON.stringify(detail.landingPayload) : '' }}</dd>
            <dt>创建</dt><dd>{{ fmtTime(detail.createdAt) }}</dd>
            <dt>开始</dt><dd>{{ fmtTime(detail.sentStartedAt) }}</dd>
            <dt>完成</dt><dd>{{ fmtTime(detail.sentFinishedAt) }}</dd>
          </dl>
        </t-card>

        <!-- 投递明细 -->
        <t-card title="投递明细">
          <template #actions>
            <span class="text-xs text-gray-500">显示前 200 条，共 {{ sends.length }} 条</span>
          </template>
          <t-table
            row-key="id"
            :data="sends.slice(0, 200)"
            :columns="[
              { colKey: 'user', title: '用户', width: 180 },
              { colKey: 'channel', title: '通道', width: 90 },
              { colKey: 'status', title: '投递', width: 90 },
              { colKey: 'error', title: '错误', width: 220 },
              { colKey: 'sentAt', title: '送出', width: 130 },
              { colKey: 'openedAt', title: '打开', width: 150 },
            ]"
            size="small"
            bordered
            stripe
          >
            <template #user="{ row }">
              <div>
                <div>{{ row.username || '未知' }}</div>
                <div class="text-xs text-gray-400">#{{ row.uid6 || row.userId }}</div>
              </div>
            </template>
            <template #channel="{ row }">
              <t-tag
                :theme="row.channel === 'APNS' ? 'primary' : 'default'"
                variant="light"
                size="small"
              >
                {{ row.channel || '—' }}
              </t-tag>
            </template>
            <template #status="{ row }">
              <t-tag
                :theme="row.status === 'SENT' ? 'success' : row.status === 'FAILED' ? 'danger' : 'default'"
                variant="light"
                size="small"
              >
                {{ row.status || '—' }}
              </t-tag>
            </template>
            <template #error="{ row }">
              <span v-if="row.errorCode" class="text-xs text-red-600">
                {{ row.errorCode }}{{ row.errorReason ? `: ${row.errorReason}` : '' }}
              </span>
              <span v-else class="text-xs text-gray-400">—</span>
            </template>
            <template #sentAt="{ row }">
              <span class="text-xs">{{ fmtTime(row.sentAt) }}</span>
            </template>
            <template #openedAt="{ row }">
              <div>
                <div class="text-xs">{{ fmtTime(row.readAt) }}</div>
                <div v-if="row.openedVia" class="text-xs text-gray-400">{{ row.openedVia === 'PUSH_TAP' ? '点 push' : '开 inbox' }}</div>
              </div>
            </template>
          </t-table>
        </t-card>
      </template>
    </t-loading>
  </div>
</template>

<style scoped>
.page-detail { padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
.back-bar { display: flex; align-items: center; gap: 12px; }
.task-name { font-size: 16px; font-weight: 700; color: #0f172a; }
.stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.stat-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; }
.stat-num { font-size: 22px; font-weight: 700; color: #0f172a; }
.stat-num.success { color: #16a34a; }
.stat-num.danger { color: #dc2626; }
.stat-num.primary { color: #2563eb; }
.stat-label { font-size: 11px; color: #94a3b8; margin-top: 4px; }

.funnel { display: flex; flex-direction: column; gap: 10px; }
.funnel-row { display: flex; align-items: center; gap: 12px; }
.funnel-label { width: 130px; font-size: 13px; color: #475569; }
.funnel-bar-wrap { flex: 1; position: relative; height: 22px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.funnel-bar {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 4px;
  transition: width 0.3s;
}
.funnel-val {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  font-size: 12px; color: #0f172a; font-weight: 600;
}

.filter-notes {
  margin-top: 12px; padding: 8px 10px;
  background: #fef3c7; border-radius: 4px;
  font-size: 12px; color: #78350f; line-height: 1.6;
}

.failed-grouped { display: flex; flex-direction: column; gap: 8px; }
.grouped-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.grouped-row .count { color: #64748b; }

.meta-list { display: grid; grid-template-columns: 80px 1fr; gap: 8px 16px; margin: 0; }
.meta-list dt { font-size: 12px; color: #94a3b8; }
.meta-list dd { font-size: 13px; color: #0f172a; margin: 0; word-break: break-word; }
</style>
