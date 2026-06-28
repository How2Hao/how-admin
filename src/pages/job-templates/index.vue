<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import JobTemplateDialog from '@/components/job-templates/JobTemplateDialog.vue'
import { REPEAT_TYPE_OPTIONS, type JobTemplateRow } from '@/types/jobTemplates'

const list = ref<JobTemplateRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const repeatTypeLabelMap = Object.fromEntries(REPEAT_TYPE_OPTIONS.map(option => [option.value, option.label])) as Record<string, string>

const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'title', title: 'Job', minWidth: 180 },
  { colKey: 'taskTemplateTitle', title: '关联活动', minWidth: 220 },
  { colKey: 'repeatType', title: '周期', width: 100 },
  { colKey: 'tiers', title: '达标条件', minWidth: 150 },
  { colKey: 'rewardDescription', title: '权益', minWidth: 180 },
  { colKey: 'reminderTemplateTitle', title: '达标后提醒', minWidth: 180 },
  { colKey: 'isVisible', title: '可见', width: 80 },
  { colKey: 'updatedAt', title: '更新时间', minWidth: 150 },
  { colKey: 'actions', title: '操作', width: 150, fixed: 'right' as const },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: JobTemplateRow[], total: number }>(
      `/api/jobTemplates?page=${page.value}&pageSize=${pageSize.value}&keyword=${encodeURIComponent(keyword.value)}`,
    )
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

function openAdd() {
  editingId.value = null
  dialogVisible.value = true
}
function openEdit(row: JobTemplateRow) {
  editingId.value = row.id
  dialogVisible.value = true
}
function handleSaved() {
  dialogVisible.value = false
  fetchList()
}
async function toggleVisible(row: JobTemplateRow) {
  const prev = row.isVisible
  row.isVisible = row.isVisible ? 0 : 1
  try {
    await requestJson(`/api/jobTemplates/${row.id}/visibility`, { method: 'PUT', body: { isVisible: row.isVisible } })
  }
  catch (e: any) {
    row.isVisible = prev
    MessagePlugin.error(e?.message ?? '切换失败')
  }
}
async function remove(row: JobTemplateRow) {
  try {
    await requestJson(`/api/jobTemplates/${row.id}`, { method: 'DELETE' })
    MessagePlugin.success('已删除')
    fetchList()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '删除失败')
  }
}
function onPageChange(info: { current: number, pageSize: number }) {
  page.value = info.current
  pageSize.value = info.pageSize
  fetchList()
}

function formatTierSummary(row: JobTemplateRow) {
  if (!row.tiers?.length) return '未配置'
  return row.tiers.map((tier, index) => {
    const parts = []
    if (tier.minAmount != null) parts.push(`${tier.minAmount}元`)
    if (tier.minCount != null) parts.push(`${tier.minCount}笔`)
    const logic = tier.logic === 'OR' ? '或' : '且'
    return `${index + 1}. ${parts.join(logic) || '无门槛'}`
  }).join('；')
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="Job 模板管理">
      <template #actions>
        <div class="flex gap-2">
          <t-input v-model="keyword" placeholder="搜索 Job / 活动标题" clearable style="width: 220px" @enter="fetchList" />
          <t-button @click="fetchList">
            搜索
          </t-button>
          <t-button theme="primary" @click="openAdd">
            新增 Job 模板
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
          <div v-if="row.description" class="text-xs text-gray-400">
            {{ row.description }}
          </div>
        </template>
        <template #taskTemplateTitle="{ row }">
          {{ row.taskTemplateTitle || (row.taskTemplateId ? `活动 ID: ${row.taskTemplateId}` : '未关联') }}
        </template>
        <template #repeatType="{ row }">
          {{ repeatTypeLabelMap[row.repeatType] ?? row.repeatType }}
        </template>
        <template #tiers="{ row }">
          {{ formatTierSummary(row) }}
        </template>
        <template #rewardDescription="{ row }">
          {{ row.rewardDescription || '未配置' }}
        </template>
        <template #reminderTemplateTitle="{ row }">
          <span>{{ row.reminderTemplateTitle || '未配置' }}</span>
          <span v-if="row.reminderTemplateKind" class="ml-1 text-xs text-gray-400">{{ row.reminderTemplateKind }}</span>
        </template>
        <template #isVisible="{ row }">
          <t-switch :value="!!row.isVisible" @change="toggleVisible(row)" />
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="text" @click="openEdit(row)">
            编辑
          </t-button>
          <t-popconfirm content="确认删除？" @confirm="remove(row)">
            <t-button size="small" variant="text" theme="danger">
              删除
            </t-button>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <JobTemplateDialog
      v-model:visible="dialogVisible"
      :job-id="editingId"
      @saved="handleSaved"
    />
  </div>
</template>
