<!-- src/components/plaza-custom-tabs/TemplateMultiSelect.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface TemplateOption {
  id: number
  title: string
  bankName: string | null
  status: 'PENDING' | 'EXPIRED' | 'COMPLETED'
  categoryName: string | null
  date: number | null
}
interface Opt { label: string, value: number }

const props = defineProps<{ modelValue: number[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: number[]] }>()

const selected = ref<TemplateOption[]>([])

// 筛选条件
const keyword = ref('')
const bankId = ref<number | undefined>(undefined)
const categoryId = ref<number | undefined>(undefined)
const status = ref<string | undefined>(undefined)

const searchResults = ref<TemplateOption[]>([])
const searching = ref(false)
const checkedIds = ref<number[]>([]) // 结果区勾选(待批量添加)

const bankOptions = ref<Opt[]>([])
const categoryOptions = ref<Opt[]>([])
const statusOptions = [
  { label: '进行中', value: 'PENDING' },
  { label: '已结束', value: 'EXPIRED' },
]

const selectedIdSet = computed(() => new Set(selected.value.map(s => s.id)))

function statusMeta(s: TemplateOption['status']) {
  if (s === 'EXPIRED') return { label: '已结束', theme: 'default' as const }
  if (s === 'COMPLETED') return { label: '已完成', theme: 'warning' as const }
  return { label: '进行中', theme: 'success' as const }
}
function fmtDate(ts: number | null) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function emitIds() { emit('update:modelValue', selected.value.map(s => s.id)) }

async function loadRefData() {
  try {
    const [b, c] = await Promise.all([
      requestJson<{ list: { id: number, name: string }[] }>('/api/banks'),
      requestJson<{ list: { id: number, name: string }[] }>('/api/activityCategories'),
    ])
    bankOptions.value = b.list.map(x => ({ label: x.name, value: x.id }))
    categoryOptions.value = c.list.map(x => ({ label: x.name, value: x.id }))
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载筛选项失败')
  }
}
loadRefData()

async function loadInitialSelection() {
  if (props.modelValue.length === 0) { selected.value = []; return }
  try {
    const res = await requestJson<{ list: TemplateOption[] }>(
      `/api/plazaCustomTabs/templates/search?ids=${props.modelValue.join(',')}`,
    )
    const map = new Map(res.list.map(t => [t.id, t]))
    selected.value = props.modelValue.map(id => map.get(id)).filter(Boolean) as TemplateOption[]
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载已选模板失败')
  }
}

async function doSearch() {
  searching.value = true
  try {
    const p = new URLSearchParams()
    if (keyword.value.trim()) p.set('keyword', keyword.value.trim())
    if (bankId.value) p.set('bankId', String(bankId.value))
    if (categoryId.value) p.set('activityCategoryId', String(categoryId.value))
    if (status.value) p.set('status', status.value)
    const res = await requestJson<{ list: TemplateOption[] }>(`/api/plazaCustomTabs/templates/search?${p.toString()}`)
    searchResults.value = res.list
    checkedIds.value = []
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '搜索失败')
  }
  finally {
    searching.value = false
  }
}

function resetFilters() {
  keyword.value = ''
  bankId.value = undefined
  categoryId.value = undefined
  status.value = undefined
}

function addItem(t: TemplateOption) {
  if (selectedIdSet.value.has(t.id)) return
  selected.value = [...selected.value, t]
  emitIds()
}

// 批量添加：结果中勾选且未选过的
const allResultsAddable = computed(() => searchResults.value.filter(t => !selectedIdSet.value.has(t.id)))
const addableChecked = computed(() => checkedIds.value.filter(id => !selectedIdSet.value.has(id)))
const allChecked = computed(() => allResultsAddable.value.length > 0 && addableChecked.value.length === allResultsAddable.value.length)

function addChecked() {
  const ids = new Set(addableChecked.value)
  const toAdd = searchResults.value.filter(t => ids.has(t.id))
  if (toAdd.length === 0) return
  selected.value = [...selected.value, ...toAdd]
  checkedIds.value = []
  emitIds()
}
function toggleSelectAll(checked: boolean) {
  checkedIds.value = checked ? allResultsAddable.value.map(t => t.id) : []
}

function removeItem(id: number) {
  selected.value = selected.value.filter(s => s.id !== id)
  emitIds()
}
function moveTop(id: number) {
  const idx = selected.value.findIndex(s => s.id === id)
  if (idx <= 0) return
  const arr = [...selected.value]
  const [it] = arr.splice(idx, 1)
  arr.unshift(it)
  selected.value = arr
  emitIds()
}
function moveBottom(id: number) {
  const idx = selected.value.findIndex(s => s.id === id)
  if (idx < 0 || idx === selected.value.length - 1) return
  const arr = [...selected.value]
  const [it] = arr.splice(idx, 1)
  arr.push(it)
  selected.value = arr
  emitIds()
}

// 原生 HTML5 拖拽排序
const dragIndex = ref<number | null>(null)
function onDragStart(idx: number) { dragIndex.value = idx }
function onDrop(idx: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from == null || from === idx) return
  const arr = [...selected.value]
  const [it] = arr.splice(from, 1)
  arr.splice(idx, 0, it)
  selected.value = arr
  emitIds()
}

watch(
  () => props.modelValue.join(','),
  () => { loadInitialSelection() },
  { immediate: true },
)
</script>

<template>
  <div>
    <!-- 筛选 -->
    <div class="filters">
      <t-input v-model="keyword" placeholder="搜 title / 银行名" class="kw" clearable @keydown.enter="doSearch" />
      <t-select v-model="bankId" :options="bankOptions" placeholder="银行" filterable clearable class="sel" />
      <t-select v-model="categoryId" :options="categoryOptions" placeholder="活动分类" filterable clearable class="sel" />
      <t-select v-model="status" :options="statusOptions" placeholder="状态" clearable class="sel-sm" />
      <t-button :loading="searching" @click="doSearch">搜索</t-button>
      <t-button variant="outline" @click="resetFilters">重置</t-button>
    </div>

    <!-- 结果 -->
    <div v-if="searchResults.length > 0" class="results">
      <div class="results-bar">
        <t-checkbox
          :checked="allChecked"
          :indeterminate="addableChecked.length > 0 && !allChecked"
          @change="toggleSelectAll"
        >
          全选可加（{{ allResultsAddable.length }}）
        </t-checkbox>
        <t-button size="small" :disabled="addableChecked.length === 0" @click="addChecked">
          添加选中（{{ addableChecked.length }}）
        </t-button>
        <span class="muted">共 {{ searchResults.length }} 条</span>
      </div>
      <t-checkbox-group v-model="checkedIds">
        <div v-for="t in searchResults" :key="t.id" class="row" :class="{ dim: t.status === 'EXPIRED' }">
          <t-checkbox :value="t.id" :disabled="selectedIdSet.has(t.id)" />
          <span class="info">
            #{{ t.id }} {{ t.title }}
            <t-tag size="small" variant="light" :theme="statusMeta(t.status).theme">{{ statusMeta(t.status).label }}</t-tag>
            <span class="muted">
              {{ t.bankName ?? '-' }}<template v-if="t.categoryName"> · {{ t.categoryName }}</template><template v-if="fmtDate(t.date)"> · {{ fmtDate(t.date) }}</template>
            </span>
          </span>
          <span v-if="selectedIdSet.has(t.id)" class="muted added">已添加</span>
          <t-button v-else size="small" variant="text" @click="addItem(t)">添加</t-button>
        </div>
      </t-checkbox-group>
    </div>
    <div v-else class="muted empty-hint">输入条件后点搜索（不填关键词也可仅按 银行/分类/状态 筛选）</div>

    <!-- 已选 -->
    <div class="selected">
      <div class="sel-head">已选（{{ selected.length }}，拖拽 ⠿ 调整展示顺序）</div>
      <div v-if="selected.length === 0" class="muted">— 未选 —</div>
      <div
        v-for="(t, idx) in selected"
        :key="t.id"
        class="row sel-row"
        :class="{ dim: t.status === 'EXPIRED', dragging: dragIndex === idx }"
        draggable="true"
        @dragstart="onDragStart(idx)"
        @dragover.prevent
        @drop="onDrop(idx)"
        @dragend="dragIndex = null"
      >
        <span class="handle">⠿</span>
        <span class="info">
          {{ idx + 1 }}. #{{ t.id }} {{ t.title }}
          <t-tag size="small" variant="light" :theme="statusMeta(t.status).theme">{{ statusMeta(t.status).label }}</t-tag>
          <span class="muted">{{ t.bankName ?? '-' }}</span>
        </span>
        <t-button size="small" variant="text" @click="moveTop(t.id)">置顶</t-button>
        <t-button size="small" variant="text" @click="moveBottom(t.id)">置底</t-button>
        <t-button size="small" variant="text" theme="danger" @click="removeItem(t.id)">移除</t-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.filters .kw { flex: 1; min-width: 160px; }
.filters .sel { width: 150px; }
.filters .sel-sm { width: 110px; }
.results {
  margin-bottom: 12px;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
  padding: 8px;
}
.results-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.results :deep(.t-checkbox-group) {
  display: block;
  max-height: 220px;
  overflow: auto;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  border-bottom: 1px solid #f0f0f0;
}
.row .info { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row.dim { opacity: 0.55; }
.muted { color: #94a3b8; }
.added { font-size: 12px; }
.empty-hint { margin-bottom: 12px; }
.selected .sel-head { font-weight: 500; margin-bottom: 6px; }
.sel-row { cursor: grab; }
.sel-row.dragging { opacity: 0.4; background: #f1f5f9; }
.handle { color: #cbd5e1; cursor: grab; user-select: none; }
</style>
