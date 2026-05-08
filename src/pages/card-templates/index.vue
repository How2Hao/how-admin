<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import CardTemplateEditDialog from '@/components/card-templates/CardTemplateEditDialog.vue'

interface SelectOption { label: string, value: number }

interface OptionsResp {
  banks: SelectOption[]
  cardOrganizations: SelectOption[]
  cardLevels: SelectOption[]
}

interface Row {
  id: number
  bankId: string
  bankName: string | null
  cardName: string
  cardType: string
  cardLevel: string | null
  cardLevelName: string | null
  cardOrganization: string
  cardOrganizationName: string | null
  cover: string | null
  alias: string | null
  tags: string | null
  dataSource: string
  relatedCount: number
  updatedAt: number | null
}

interface ListResp {
  list: Row[]
  total: number
}

type DataSource = 'flyert' | '51credit'

const activeTab = ref<DataSource>('flyert')
const list = ref<Row[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const keyword = ref('')
const bankFilter = ref<number | undefined>(undefined)
const optionsRef = ref<OptionsResp>({ banks: [], cardOrganizations: [], cardLevels: [] })
const editVisible = ref(false)
const editingId = ref<number | null>(null)

const columns = [
  { colKey: 'cover', title: '卡面', width: 110 },
  { colKey: 'cardName', title: '卡名', minWidth: 220, ellipsis: true },
  { colKey: 'bankName', title: '银行', width: 160 },
  { colKey: 'cardOrganizationName', title: '卡组织', width: 130 },
  { colKey: 'cardLevelName', title: '卡等级', width: 100 },
  { colKey: 'tags', title: '标签', width: 200, ellipsis: true },
  { colKey: 'relatedCount', title: '关联数', width: 80 },
  { colKey: 'actions', title: '操作', width: 160, fixed: 'right' as const },
]

async function loadOptions() {
  optionsRef.value = await requestJson<OptionsResp>('/api/cardTemplates/options')
}

async function fetchList() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
      dataSource: activeTab.value,
    })
    if (bankFilter.value)
      params.set('bankId', String(bankFilter.value))
    if (keyword.value.trim())
      params.set('keyword', keyword.value.trim())
    const res = await requestJson<ListResp>(`/api/cardTemplates?${params.toString()}`)
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

function handleTabChange() {
  page.value = 1
  fetchList()
}

function handleSearch() {
  page.value = 1
  fetchList()
}

function handlePageChange(p: { current: number, pageSize: number }) {
  page.value = p.current
  pageSize.value = p.pageSize
  fetchList()
}

function openEdit(row: Row) {
  editingId.value = row.id
  editVisible.value = true
}

function handleSaved() {
  editVisible.value = false
  fetchList()
}

async function approveRow(row: Row) {
  try {
    await requestJson(`/api/cardTemplates/${row.id}/approve`, { method: 'POST' })
    MessagePlugin.success('已通过，已上线到「用户可见」')
    fetchList()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '通过失败')
  }
}

function formatTags(tags: string | null): string {
  if (!tags)
    return '-'
  try {
    const arr = JSON.parse(tags)
    if (Array.isArray(arr))
      return arr.join('、')
  }
  catch {}
  return tags
}

onMounted(async () => {
  await loadOptions()
  fetchList()
})
</script>

<template>
  <div class="p-6">
    <t-card title="卡片模板管理">
      <t-tabs v-model="activeTab" @change="handleTabChange">
        <t-tab-panel value="flyert" label="用户可见 (flyert)" />
        <t-tab-panel value="51credit" label="待处理 (51credit)" />
      </t-tabs>

      <div class="flex flex-wrap gap-3 items-center my-4">
        <t-select
          v-model="bankFilter"
          :options="optionsRef.banks"
          placeholder="按银行筛选"
          clearable
          filterable
          style="width: 240px"
          @change="handleSearch"
        />
        <t-input
          v-model="keyword"
          placeholder="按卡名搜索"
          clearable
          style="width: 280px"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-button theme="primary" @click="handleSearch">
          搜索
        </t-button>
        <div class="text-sm text-gray-500 ml-auto">
          共 {{ total }} 条
        </div>
      </div>

      <t-table
        row-key="id"
        :data="list"
        :columns="columns"
        :loading="loading"
        :pagination="{ current: page, pageSize, total, showJumper: true, pageSizeOptions: [10, 20, 50, 100] }"
        stripe
        bordered
        @page-change="handlePageChange"
      >
        <template #cover="{ row }">
          <img v-if="row.cover" :src="row.cover" class="h-12 w-20 object-cover rounded" >
          <span v-else class="text-gray-400">-</span>
        </template>
        <template #tags="{ row }">
          <span class="text-sm">{{ formatTags(row.tags) }}</span>
        </template>
        <template #actions="{ row }">
          <t-space>
            <t-button size="small" variant="outline" @click="openEdit(row)">
              编辑
            </t-button>
            <t-button v-if="activeTab === '51credit'" size="small" theme="success" @click="approveRow(row)">
              通过
            </t-button>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <CardTemplateEditDialog
      v-model:visible="editVisible"
      :template-id="editingId"
      :options="optionsRef"
      @saved="handleSaved"
    />
  </div>
</template>
