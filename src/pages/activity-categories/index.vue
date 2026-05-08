<!-- src/pages/activity-categories/index.vue -->
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import ActivityCategoryDialog from '@/components/activity-categories/ActivityCategoryDialog.vue'

interface Row {
  id: number
  code: string
  name: string
  parentId: number | null
  icon: string | null
  sortOrder: number
  createdAt: number | null
  children?: Row[]
}

const list = ref<Row[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingRow = ref<Row | null>(null)

// Top-level rows only, for parent dropdown in dialog
const parentOptions = computed(() =>
  list.value
    .filter(r => r.parentId === null)
    .map(r => ({ label: r.name, value: r.id })),
)

// Build two-level tree from flat list
function buildTree(flat: Row[]): Row[] {
  const parents = flat.filter(r => r.parentId === null)
  const childMap = new Map<number, Row[]>()
  flat.filter(r => r.parentId !== null).forEach((r) => {
    const arr = childMap.get(r.parentId!) ?? []
    arr.push(r)
    childMap.set(r.parentId!, arr)
  })
  return parents.map(p => {
    const kids = childMap.get(p.id)
    return kids?.length ? { ...p, children: kids } : p
  })
}

const treeData = computed(() => buildTree(list.value))

const columns = [
  { colKey: 'name', title: '名称', minWidth: 180 },
  { colKey: 'code', title: 'Code', width: 160 },
  { colKey: 'sortOrder', title: '排序', width: 80 },
  { colKey: 'createdAt', title: '创建时间', width: 160 },
  { colKey: 'actions', title: '操作', width: 80, fixed: 'right' as const },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: Row[] }>('/api/activityCategories')
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
  // Pass the flat row (strip children before passing to dialog)
  const { children: _, ...flatRow } = row
  editingRow.value = flatRow
  dialogVisible.value = true
}

function handleSaved() {
  fetchList()
}

function formatTime(createdAt: number | null) {
  if (!createdAt)
    return '-'
  return new Date(createdAt + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="活动分类管理">
      <template #actions>
        <t-button theme="primary" @click="openAdd">
          新增分类
        </t-button>
      </template>

      <t-enhanced-table
        row-key="id"
        :data="treeData"
        :columns="columns"
        :loading="loading"
        :tree="{ childrenKey: 'children', defaultExpandAll: true }"
        stripe
        bordered
      >
        <template #name="{ row }">
          <div class="flex items-center gap-2">
            <img v-if="row.icon" :src="row.icon" class="w-6 h-6 object-contain rounded flex-shrink-0">
            <div v-else class="w-6 h-6 flex-shrink-0" />
            <span>{{ row.name }}</span>
          </div>
        </template>
        <template #createdAt="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="outline" @click="openEdit(row)">
            编辑
          </t-button>
        </template>
      </t-enhanced-table>
    </t-card>

    <ActivityCategoryDialog
      v-model:visible="dialogVisible"
      :editing-row="editingRow"
      :parent-options="parentOptions"
      @saved="handleSaved"
    />
  </div>
</template>
