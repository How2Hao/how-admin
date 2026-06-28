<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import ReminderTemplateDialog from '@/components/reminder-templates/ReminderTemplateDialog.vue'
import { requestJson } from '@/composables/useJsonRequest'
import {
  REMINDER_REPEAT_TYPE_OPTIONS,
  REMINDER_TEMPLATE_KIND_OPTIONS,
  type ReminderTemplateKind,
  type ReminderTemplateRow,
} from '@/types/reminderTemplates'

const list = ref<ReminderTemplateRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const kindFilter = ref<'ALL' | ReminderTemplateKind>('ALL')
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)

const repeatTypeLabelMap = Object.fromEntries(REMINDER_REPEAT_TYPE_OPTIONS.map(option => [option.value, option.label])) as Record<string, string>
const kindLabelMap = Object.fromEntries(REMINDER_TEMPLATE_KIND_OPTIONS.map(option => [option.value, option.label])) as Record<string, string>
const kindFilterOptions = [{ label: '全部类型', value: 'ALL' }, ...REMINDER_TEMPLATE_KIND_OPTIONS]

const columns = [
  { colKey: 'id', title: 'ID', width: 72 },
  { colKey: 'title', title: '提醒模板', minWidth: 220 },
  { colKey: 'kind', title: '类型', width: 110 },
  { colKey: 'repeatType', title: '周期', minWidth: 180 },
  { colKey: 'reminderTime', title: '提醒时间', width: 120 },
  { colKey: 'taskTemplateTitle', title: '来源活动', minWidth: 240 },
  { colKey: 'isVisible', title: '可见', width: 80 },
  { colKey: 'updatedAt', title: '更新时间', minWidth: 150 },
  { colKey: 'actions', title: '操作', width: 90, fixed: 'right' as const },
]

function parseNumberList(raw: string | null | undefined) {
  const text = raw?.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed))
      return parsed.map(item => Number(item)).filter(item => Number.isInteger(item))
  }
  catch {}
  return text
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(item => Number(item.replace(/"/g, '').trim()))
    .filter(item => Number.isInteger(item))
}

function formatDate(ms: number | null | undefined) {
  if (!ms) return '-'
  return new Date(ms).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-')
}

function formatRepeat(row: ReminderTemplateRow) {
  if (row.repeatType === 'ONE_TIME')
    return `一次性 · ${formatDate(row.date)}`
  if (row.repeatType === 'DAILY')
    return '每日'
  if (row.repeatType === 'WEEKLY') {
    const days = parseNumberList(row.daysOfWeek)
    return days.length ? `每周 · ${days.map(day => `周${'一二三四五六日'[day - 1] ?? day}`).join('、')}` : '每周'
  }
  if (row.repeatType === 'MONTHLY') {
    const days = parseNumberList(row.daysOfMonth)
    return days.length ? `每月 · ${days.join('、')}日` : '每月'
  }
  const months = parseNumberList(row.yearlyMonths)
  const days = parseNumberList(row.yearlyDaysOfMonth)
  return months.length && days.length
    ? `每年 · ${months.join('、')}月 ${days.join('、')}日`
    : '每年'
}

function formatTime(row: ReminderTemplateRow) {
  const time = row.reminderTime || '全天'
  return row.advanceReminderMinutes != null && row.advanceReminderMinutes > 0
    ? `${time} · 提前 ${row.advanceReminderMinutes} 分`
    : time
}

async function fetchList() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
      keyword: keyword.value,
    })
    if (kindFilter.value !== 'ALL')
      params.set('kind', kindFilter.value)
    const res = await requestJson<{ list: ReminderTemplateRow[], total: number }>(`/api/reminderTemplates?${params.toString()}`)
    list.value = res.list
    total.value = res.total
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  fetchList()
}

function openEdit(row: ReminderTemplateRow) {
  editingId.value = row.id
  dialogVisible.value = true
}

function handleSaved() {
  dialogVisible.value = false
  fetchList()
}

function onPageChange(info: { current: number, pageSize: number }) {
  page.value = info.current
  pageSize.value = info.pageSize
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="Reminder Template 管理">
      <template #actions>
        <div class="toolbar">
          <t-input
            v-model="keyword"
            placeholder="搜索提醒 / 活动标题 / ID"
            clearable
            style="width: 240px"
            @enter="search"
          />
          <t-select
            v-model="kindFilter"
            :options="kindFilterOptions"
            style="width: 140px"
            @change="search"
          />
          <t-button @click="search">
            搜索
          </t-button>
        </div>
      </template>

      <t-table
        row-key="id"
        :data="list"
        :columns="columns"
        :loading="loading"
        :pagination="{ current: page, pageSize, total }"
        stripe
        bordered
        @page-change="onPageChange"
      >
        <template #title="{ row }">
          <div class="font-medium">
            {{ row.title }}
          </div>
          <div v-if="row.description" class="text-xs text-gray-400 line-clamp-2">
            {{ row.description }}
          </div>
        </template>
        <template #kind="{ row }">
          <t-tag :theme="row.kind === 'EXPIRY_REMINDER' ? 'warning' : 'primary'" variant="light">
            {{ kindLabelMap[row.kind] ?? row.kind }}
          </t-tag>
        </template>
        <template #repeatType="{ row }">
          <div>{{ formatRepeat(row) }}</div>
          <div class="text-xs text-gray-400">
            {{ repeatTypeLabelMap[row.repeatType] ?? row.repeatType }}
            <span v-if="row.startDate || row.endDate">
              · {{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}
            </span>
          </div>
        </template>
        <template #reminderTime="{ row }">
          {{ formatTime(row) }}
        </template>
        <template #taskTemplateTitle="{ row }">
          {{ row.taskTemplateTitle || `活动 ID: ${row.taskTemplateId}` }}
        </template>
        <template #isVisible="{ row }">
          <t-tag :theme="row.isVisible ? 'success' : 'default'" variant="light">
            {{ row.isVisible ? '是' : '否' }}
          </t-tag>
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="outline" @click="openEdit(row)">
            编辑
          </t-button>
        </template>
      </t-table>
    </t-card>

    <ReminderTemplateDialog
      v-model:visible="dialogVisible"
      :reminder-id="editingId"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
</style>
