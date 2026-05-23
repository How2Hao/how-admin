<script setup lang="ts">
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import CreateBankDialog from './CreateBankDialog.vue'

type BankType =
  | 'STATE_OWNED'
  | 'JOINT_STOCK'
  | 'CITY_COMMERCIAL'
  | 'RURAL_COMMERCIAL'
  | 'RURAL_CREDIT_COOP'
  | 'JOINT_VENTURE'
  | 'VILLAGE'
  | 'PRIVATE'

interface Row {
  id: number
  name: string
  code: string | null
  logo: string | null
  pinyinIndex: string | null
  isVisible: number
  bankType: BankType | null
  isHot: number
}

const BANK_TYPE_OPTIONS: { label: string, value: BankType, icon: string }[] = [
  { label: '国有银行', value: 'STATE_OWNED', icon: 'i-carbon:building' },
  { label: '股份制银行', value: 'JOINT_STOCK', icon: 'i-carbon:enterprise' },
  { label: '城商行', value: 'CITY_COMMERCIAL', icon: 'i-carbon:building-insights-1' },
  { label: '农商行', value: 'RURAL_COMMERCIAL', icon: 'i-carbon:tree-view' },
  { label: '农村信用社', value: 'RURAL_CREDIT_COOP', icon: 'i-carbon:savings' },
  { label: '合资银行', value: 'JOINT_VENTURE', icon: 'i-carbon:globe' },
  { label: '村镇银行', value: 'VILLAGE', icon: 'i-carbon:home' },
  { label: '民营银行', value: 'PRIVATE', icon: 'i-carbon:user-multiple' },
]

type CategoryKey = 'ALL' | 'NULL' | BankType

const CATEGORY_ICON: Record<CategoryKey, string> = {
  ALL: 'i-carbon:list-boxes',
  NULL: 'i-carbon:help',
  STATE_OWNED: 'i-carbon:building',
  JOINT_STOCK: 'i-carbon:enterprise',
  CITY_COMMERCIAL: 'i-carbon:building-insights-1',
  RURAL_COMMERCIAL: 'i-carbon:tree-view',
  RURAL_CREDIT_COOP: 'i-carbon:savings',
  JOINT_VENTURE: 'i-carbon:globe',
  VILLAGE: 'i-carbon:home',
  PRIVATE: 'i-carbon:user-multiple',
}

const list = ref<Row[]>([])
const loading = ref(false)
const keyword = ref('')
const activeCategory = ref<CategoryKey>('ALL')

const columns = [
  { colKey: 'logo', title: '图标', width: 72 },
  { colKey: 'name', title: '名称', width: 200 },
  { colKey: 'code', title: 'Code', width: 140 },
  { colKey: 'bankType', title: '分类', width: 160 },
  { colKey: 'isHot', title: '热门', width: 80 },
  { colKey: 'isVisible', title: '是否可见', width: 100 },
  { colKey: 'actions', title: '操作', width: 90 },
]

const categoryCounts = computed(() => {
  const counts: Record<string, number> = { ALL: list.value.length, NULL: 0 }
  for (const opt of BANK_TYPE_OPTIONS) counts[opt.value] = 0
  for (const r of list.value) {
    if (r.bankType === null) counts.NULL++
    else counts[r.bankType] = (counts[r.bankType] ?? 0) + 1
  }
  return counts
})

const categoryItems = computed(() => [
  { key: 'ALL' as CategoryKey, label: '全部' },
  ...BANK_TYPE_OPTIONS.map(o => ({ key: o.value as CategoryKey, label: o.label })),
  { key: 'NULL' as CategoryKey, label: '未分类' },
])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return list.value.filter((r) => {
    if (activeCategory.value === 'NULL' && r.bankType !== null) return false
    if (activeCategory.value !== 'ALL' && activeCategory.value !== 'NULL' && r.bankType !== activeCategory.value) return false
    if (!kw) return true
    return (
      r.name.toLowerCase().includes(kw)
      || (r.code ?? '').toLowerCase().includes(kw)
      || (r.pinyinIndex ?? '').toLowerCase().includes(kw)
    )
  })
})

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: Row[] }>('/api/banks')
    list.value = res.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

async function onToggleVisible(row: Row, next: unknown) {
  const nextBool = Boolean(next)
  const prev = row.isVisible
  row.isVisible = nextBool ? 1 : 0
  try {
    await requestJson(`/api/banks/${row.id}/visibility`, {
      method: 'PUT',
      body: { isVisible: nextBool },
    })
    MessagePlugin.success(nextBool ? '已显示' : '已隐藏')
  }
  catch (e: any) {
    row.isVisible = prev
    MessagePlugin.error(e?.message ?? '切换失败')
  }
}

async function onToggleHot(row: Row, next: unknown) {
  const nextBool = Boolean(next)
  const prev = row.isHot
  row.isHot = nextBool ? 1 : 0
  try {
    await requestJson(`/api/banks/${row.id}`, {
      method: 'PATCH',
      body: { isHot: nextBool },
    })
    MessagePlugin.success(nextBool ? '已加入热门' : '已移出热门')
  }
  catch (e: any) {
    row.isHot = prev
    MessagePlugin.error(e?.message ?? '切换失败')
  }
}

async function onChangeBankType(row: Row, next: unknown) {
  const value = (next === '' || next === undefined || next === null) ? null : (next as BankType)
  const prev = row.bankType
  row.bankType = value
  try {
    await requestJson(`/api/banks/${row.id}`, {
      method: 'PATCH',
      body: { bankType: value },
    })
    MessagePlugin.success('已更新分类')
  }
  catch (e: any) {
    row.bankType = prev
    MessagePlugin.error(e?.message ?? '更新失败')
  }
}

function onDelete(row: Row) {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除「${row.name}」？此操作不可恢复。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await requestJson(`/api/banks/${row.id}`, { method: 'DELETE' })
        list.value = list.value.filter(r => r.id !== row.id)
        MessagePlugin.success('已删除')
        dialog.destroy()
      }
      catch (e: any) {
        MessagePlugin.error(e?.message ?? '删除失败')
      }
    },
  })
}

const createOpen = ref(false)
function openCreate() {
  createOpen.value = true
}
async function onCreated() {
  createOpen.value = false
  await fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="银行管理">
      <div class="flex gap-4" style="min-height: 600px">
        <!-- 左侧分类导航 -->
        <div class="shrink-0" style="width: 180px; border-right: 1px solid #e5e7eb; padding-right: 12px">
          <div
            v-for="item in categoryItems"
            :key="item.key"
            class="cursor-pointer rounded px-3 py-2 mb-1 flex items-center text-sm gap-2"
            :class="activeCategory === item.key
              ? 'bg-blue-50 text-blue-600 font-medium'
              : 'hover:bg-gray-50 text-gray-700'"
            @click="activeCategory = item.key"
          >
            <div :class="CATEGORY_ICON[item.key]" class="text-base shrink-0" />
            <span class="flex-1 truncate">{{ item.label }}</span>
            <span class="text-xs text-gray-400 shrink-0">{{ categoryCounts[item.key] ?? 0 }}</span>
          </div>
        </div>

        <!-- 右侧列表 -->
        <div class="flex-1 min-w-0">
          <div class="mb-3 flex justify-end gap-2">
            <t-input
              v-model="keyword"
              placeholder="搜索名称 / code / 拼音"
              clearable
              style="width: 280px"
            />
            <t-button theme="primary" @click="openCreate">
              <template #icon>
                <div i-carbon:add />
              </template>
              新增银行
            </t-button>
          </div>

          <t-table
            row-key="id"
            :data="filtered"
            :columns="columns"
            :loading="loading"
            stripe
            bordered
            size="small"
          >
            <template #logo="{ row }">
              <img v-if="row.logo" :src="row.logo" class="w-8 h-8 object-contain rounded">
              <span v-else class="text-gray-400">-</span>
            </template>
            <template #bankType="{ row }">
              <t-select
                :value="row.bankType"
                :options="BANK_TYPE_OPTIONS"
                placeholder="未分类"
                clearable
                size="small"
                style="width: 140px"
                @change="(v) => onChangeBankType(row, v)"
              />
            </template>
            <template #isHot="{ row }">
              <t-switch
                :value="row.isHot === 1"
                @change="(v) => onToggleHot(row, v)"
              />
            </template>
            <template #isVisible="{ row }">
              <t-switch
                :value="row.isVisible === 1"
                @change="(v) => onToggleVisible(row, v)"
              />
            </template>
            <template #actions="{ row }">
              <t-button
                theme="danger"
                variant="text"
                size="small"
                @click="onDelete(row)"
              >
                删除
              </t-button>
            </template>
          </t-table>
        </div>
      </div>
    </t-card>

    <CreateBankDialog
      :visible="createOpen"
      :default-bank-type="activeCategory !== 'ALL' && activeCategory !== 'NULL' ? activeCategory : null"
      @update:visible="(v) => createOpen = v"
      @created="onCreated"
    />
  </div>
</template>
