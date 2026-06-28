<!-- src/components/plaza-custom-tabs/TemplateMultiSelect.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface TemplateOption {
  id: number
  title: string
  bankId: number
  bankName: string | null
  status: 'PENDING' | 'EXPIRED' | 'COMPLETED'
  categoryName: string | null
  date: number | null
}
interface BankGroup { bankId: number, bankName: string | null, count: number }
interface DisplayGroup { bankId: number, bankName: string | null, count: number, items: TemplateOption[] | null }

const props = defineProps<{ modelValue: number[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: number[]] }>()

const selected = ref<TemplateOption[]>([])
const checkedIds = ref<number[]>([])

// 搜索
const keyword = ref('')
const searching = ref(false)
const searchMode = ref(false)
const searchGroups = ref<{ bankId: number, bankName: string | null, items: TemplateOption[] }[]>([])

// 分组浏览（按银行）
const bankGroups = ref<BankGroup[]>([])
const bankActivities = ref<Record<number, TemplateOption[]>>({})
const loadingBanks = ref<number[]>([])
const expandedKeys = ref<number[]>([])

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

// 统一渲染结构：搜索模式用结果分组；浏览模式用银行分组（items=null 表示未懒加载）
const displayGroups = computed<DisplayGroup[]>(() => {
  if (searchMode.value)
    return searchGroups.value.map(g => ({ bankId: g.bankId, bankName: g.bankName, count: g.items.length, items: g.items }))
  return bankGroups.value.map(b => ({ bankId: b.bankId, bankName: b.bankName, count: b.count, items: bankActivities.value[b.bankId] ?? null }))
})
// 当前已加载到内存的所有活动（供批量添加取对象）
const allLoadedById = computed(() => {
  const m = new Map<number, TemplateOption>()
  for (const arr of Object.values(bankActivities.value)) for (const t of arr) m.set(t.id, t)
  for (const g of searchGroups.value) for (const t of g.items) m.set(t.id, t)
  return m
})
const addableChecked = computed(() => checkedIds.value.filter(id => !selectedIdSet.value.has(id)))
const headerHint = computed(() =>
  searchMode.value
    ? `搜到 ${searchGroups.value.reduce((n, g) => n + g.items.length, 0)} 条`
    : `共 ${bankGroups.value.length} 家银行`,
)

async function loadBankGroups() {
  try {
    const res = await requestJson<{ list: BankGroup[] }>('/api/plazaCustomTabs/templates/banks')
    bankGroups.value = res.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载银行分组失败')
  }
}
loadBankGroups()

async function loadBankActivities(bankId: number) {
  if (bankActivities.value[bankId] || loadingBanks.value.includes(bankId)) return
  loadingBanks.value = [...loadingBanks.value, bankId]
  try {
    const res = await requestJson<{ list: TemplateOption[] }>(
      `/api/plazaCustomTabs/templates/search?bankId=${bankId}&pageSize=200`,
    )
    bankActivities.value = { ...bankActivities.value, [bankId]: res.list }
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载活动失败')
  }
  finally {
    loadingBanks.value = loadingBanks.value.filter(x => x !== bankId)
  }
}
function onCollapseChange(keys: number[]) {
  for (const k of keys) loadBankActivities(k)
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) { resetSearch(); return }
  searching.value = true
  try {
    const res = await requestJson<{ list: TemplateOption[] }>(
      `/api/plazaCustomTabs/templates/search?keyword=${encodeURIComponent(kw)}&pageSize=200`,
    )
    const groups = new Map<number, { bankId: number, bankName: string | null, items: TemplateOption[] }>()
    for (const t of res.list) {
      const g = groups.get(t.bankId) ?? { bankId: t.bankId, bankName: t.bankName, items: [] }
      g.items.push(t)
      groups.set(t.bankId, g)
    }
    searchGroups.value = [...groups.values()]
    searchMode.value = true
    expandedKeys.value = searchGroups.value.map(g => g.bankId) // 搜索结果默认全展开
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '搜索失败')
  }
  finally {
    searching.value = false
  }
}
function resetSearch() {
  keyword.value = ''
  searchMode.value = false
  searchGroups.value = []
  expandedKeys.value = []
  checkedIds.value = []
}

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

function addItem(t: TemplateOption) {
  if (selectedIdSet.value.has(t.id)) return
  selected.value = [...selected.value, t]
  emitIds()
}
function addChecked() {
  const toAdd = addableChecked.value.map(id => allLoadedById.value.get(id)).filter(Boolean) as TemplateOption[]
  if (toAdd.length === 0) return
  selected.value = [...selected.value, ...toAdd]
  checkedIds.value = []
  emitIds()
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
    <!-- 搜索 -->
    <div class="filters">
      <t-input v-model="keyword" placeholder="搜活动 title / 银行名" class="kw" clearable @keydown.enter="doSearch" @clear="resetSearch" />
      <t-button :loading="searching" @click="doSearch">搜索</t-button>
      <t-button v-if="searchMode" variant="outline" @click="resetSearch">返回银行分组</t-button>
    </div>

    <!-- 活动：按银行分组折叠展示 -->
    <div class="results">
      <div class="results-bar">
        <t-button size="small" :disabled="addableChecked.length === 0" @click="addChecked">添加选中（{{ addableChecked.length }}）</t-button>
        <span class="muted">{{ headerHint }}</span>
      </div>

      <t-checkbox-group v-model="checkedIds">
        <div v-if="searchMode && displayGroups.length === 0" class="muted empty-hint">{{ searching ? '搜索中…' : '无匹配活动' }}</div>
        <t-collapse v-model="expandedKeys" @change="onCollapseChange">
          <t-collapse-panel
            v-for="g in displayGroups"
            :key="g.bankId"
            :value="g.bankId"
            :header="`${g.bankName ?? '未知银行'}（${g.count}）`"
          >
            <div v-if="g.items === null" class="muted">{{ loadingBanks.includes(g.bankId) ? '加载中…' : '展开加载…' }}</div>
            <div v-else-if="g.items.length === 0" class="muted">该银行暂无活动</div>
            <template v-else>
              <div v-for="t in g.items" :key="t.id" class="row" :class="{ dim: t.status === 'EXPIRED' }">
                <t-checkbox :value="t.id" :disabled="selectedIdSet.has(t.id)" />
                <span class="info">
                  #{{ t.id }} {{ t.title }}
                  <t-tag size="small" variant="light" :theme="statusMeta(t.status).theme">{{ statusMeta(t.status).label }}</t-tag>
                  <span class="muted"><template v-if="t.categoryName">{{ t.categoryName }} · </template>{{ fmtDate(t.date) || '无日期' }}</span>
                </span>
                <span v-if="selectedIdSet.has(t.id)" class="muted added">已添加</span>
                <t-button v-else size="small" variant="text" @click="addItem(t)">添加</t-button>
              </div>
            </template>
          </t-collapse-panel>
        </t-collapse>
      </t-checkbox-group>
    </div>

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
}
.filters .kw { flex: 1; min-width: 160px; }
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
.results :deep(.t-collapse) {
  max-height: 320px;
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
.empty-hint { padding: 8px 0; }
.selected { margin-top: 12px; }
.selected .sel-head { font-weight: 500; margin-bottom: 6px; }
.sel-row { cursor: grab; }
.sel-row.dragging { opacity: 0.4; background: #f1f5f9; }
.handle { color: #cbd5e1; cursor: grab; user-select: none; }
</style>
