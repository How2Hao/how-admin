<!-- src/pages/plaza-custom-tabs/index.vue -->
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import PlazaCustomTabDialog from '@/components/plaza-custom-tabs/PlazaCustomTabDialog.vue'

interface Row {
  id: number
  code: string
  name: string
  logo: string | null
  templateIds: number[]
  sortOrder: number
  isVisible: number
  startTime: number | null
  endTime: number | null
  createdAt: number
  updatedAt: number
}

const list = ref<Row[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingRow = ref<Row | null>(null)

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: Row[] }>('/api/plazaCustomTabs')
    list.value = res.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

function openAdd() {
  editingRow.value = null
  dialogVisible.value = true
}

function openEdit(row: Row) {
  editingRow.value = { ...row }
  dialogVisible.value = true
}

async function toggleVisible(row: Row) {
  try {
    await requestJson(`/api/plazaCustomTabs/${row.id}`, { method: 'PUT', body: { isVisible: row.isVisible ? 0 : 1 } })
    MessagePlugin.success('已切换显隐')
    fetchList()
  }
  catch (e: any) { MessagePlugin.error(e?.message ?? '操作失败') }
}

async function handleDelete(row: Row) {
  if (!confirm(`确定删除 tab「${row.name}」？`)) return
  try {
    await requestJson(`/api/plazaCustomTabs/${row.id}`, { method: 'DELETE' })
    MessagePlugin.success('已删除')
    fetchList()
  }
  catch (e: any) { MessagePlugin.error(e?.message ?? '删除失败') }
}

async function moveItem(row: Row, delta: -1 | 1) {
  const sorted = [...list.value].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const idx = sorted.findIndex(r => r.id === row.id)
  const targetIdx = idx + delta
  if (targetIdx < 0 || targetIdx >= sorted.length) return
  const aId = sorted[idx].id
  const aSort = sorted[idx].sortOrder
  const bId = sorted[targetIdx].id
  const bSort = sorted[targetIdx].sortOrder
  try {
    await requestJson('/api/plazaCustomTabs/reorder', {
      method: 'POST',
      body: { orders: [{ id: aId, sortOrder: bSort }, { id: bId, sortOrder: aSort }] },
    })
    fetchList()
  }
  catch (e: any) { MessagePlugin.error(e?.message ?? '排序失败') }
}

function formatTime(ts: number | null) {
  if (!ts) return '-'
  return new Date(ts + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
}

const columns = [
  { colKey: 'name', title: '名称', width: 140 },
  { colKey: 'code', title: 'Code', width: 160 },
  { colKey: 'logo', title: 'Logo', width: 80 },
  { colKey: 'templateIds', title: '关联活动数', width: 100 },
  { colKey: 'sortOrder', title: '排序', width: 100 },
  { colKey: 'isVisible', title: '显隐', width: 80 },
  { colKey: 'startTime', title: '生效开始', width: 140 },
  { colKey: 'endTime', title: '生效结束', width: 140 },
  { colKey: 'actions', title: '操作', width: 200, fixed: 'right' as const },
]

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="广场运营 Tab">
      <template #actions>
        <t-button theme="primary" @click="openAdd">
          新增 Tab
        </t-button>
      </template>
      <t-table
        row-key="id"
        :data="list"
        :loading="loading"
        :columns="columns"
        stripe
        bordered
      >
        <template #logo="{ row }">
          <img v-if="row.logo" :src="row.logo" class="w-6 h-6 object-contain">
          <span v-else class="text-gray-300">—</span>
        </template>
        <template #templateIds="{ row }">
          {{ row.templateIds.length }}
        </template>
        <template #isVisible="{ row }">
          <t-switch :value="!!row.isVisible" @change="toggleVisible(row)" />
        </template>
        <template #startTime="{ row }">
          {{ formatTime(row.startTime) }}
        </template>
        <template #endTime="{ row }">
          {{ formatTime(row.endTime) }}
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="text" @click="moveItem(row, -1)">上移</t-button>
          <t-button size="small" variant="text" @click="moveItem(row, 1)">下移</t-button>
          <t-button size="small" variant="text" @click="openEdit(row)">编辑</t-button>
          <t-button size="small" variant="text" theme="danger" @click="handleDelete(row)">删除</t-button>
        </template>
      </t-table>
    </t-card>

    <PlazaCustomTabDialog
      v-model:visible="dialogVisible"
      :row="editingRow"
      @saved="fetchList"
    />
  </div>
</template>
