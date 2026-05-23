<!-- src/components/plaza-custom-tabs/TemplateMultiSelect.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface TemplateOption { id: number, title: string, bankName: string | null }

const props = defineProps<{ modelValue: number[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: number[]] }>()

const selected = ref<TemplateOption[]>([])
const searchKeyword = ref('')
const searchResults = ref<TemplateOption[]>([])

async function loadInitialSelection() {
  if (props.modelValue.length === 0) {
    selected.value = []
    return
  }
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
  const kw = searchKeyword.value.trim()
  try {
    const res = await requestJson<{ list: TemplateOption[] }>(
      `/api/plazaCustomTabs/templates/search?keyword=${encodeURIComponent(kw)}`,
    )
    searchResults.value = res.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '搜索失败')
  }
}

function addItem(t: TemplateOption) {
  if (selected.value.some(s => s.id === t.id)) return
  selected.value = [...selected.value, t]
  emit('update:modelValue', selected.value.map(s => s.id))
}

function removeItem(id: number) {
  selected.value = selected.value.filter(s => s.id !== id)
  emit('update:modelValue', selected.value.map(s => s.id))
}

function moveItem(id: number, delta: -1 | 1) {
  const idx = selected.value.findIndex(s => s.id === id)
  const ti = idx + delta
  if (ti < 0 || ti >= selected.value.length) return
  const arr = [...selected.value]
  const [it] = arr.splice(idx, 1)
  arr.splice(ti, 0, it)
  selected.value = arr
  emit('update:modelValue', arr.map(s => s.id))
}

// 只在 ids 真的变了时重载（避免父组件每次 fetchList 后用新数组引用 clobber 已选编辑）
watch(
  () => props.modelValue.join(','),
  () => { loadInitialSelection() },
  { immediate: true },
)
</script>

<template>
  <div>
    <div class="mb-3 flex gap-2">
      <t-input v-model="searchKeyword" placeholder="搜 title 或 bankName" class="flex-1" @keydown.enter="doSearch" />
      <t-button @click="doSearch">搜索</t-button>
    </div>
    <div v-if="searchResults.length > 0" class="mb-3 max-h-40 overflow-auto border rounded p-2">
      <div v-for="t in searchResults" :key="t.id" class="flex items-center justify-between py-1">
        <span class="truncate">#{{ t.id }} {{ t.title }} <span class="text-gray-400">({{ t.bankName ?? '-' }})</span></span>
        <t-button size="small" variant="text" @click="addItem(t)">添加</t-button>
      </div>
    </div>
    <div>
      <div class="mb-2 font-medium">已选（{{ selected.length }}，顺序即展示顺序）</div>
      <div v-if="selected.length === 0" class="text-gray-400">— 未选 —</div>
      <div v-for="(t, idx) in selected" :key="t.id" class="flex items-center justify-between border-b py-1">
        <span class="truncate flex-1">{{ idx + 1 }}. #{{ t.id }} {{ t.title }} <span class="text-gray-400">({{ t.bankName ?? '-' }})</span></span>
        <t-button size="small" variant="text" @click="moveItem(t.id, -1)">↑</t-button>
        <t-button size="small" variant="text" @click="moveItem(t.id, 1)">↓</t-button>
        <t-button size="small" variant="text" theme="danger" @click="removeItem(t.id)">移除</t-button>
      </div>
    </div>
  </div>
</template>
