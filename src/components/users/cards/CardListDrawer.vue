<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface Row {
  id: number
  userId: number
  username: string | null
  uid6: string | null
  avatar: string | null
  bankId: string
  bankName: string | null
  cardName: string | null
  cardLevel: string | null
  cardType: string
  cardOrganization: string
  cover: string | null
  cardLastFour: string
  regionCode: string
  regionName: string | null
  createdAt: number
}
interface ListResp { list: Row[], total: number }

const props = defineProps<{
  visible: boolean
  bankId: string
  cityCode: string
  bankName: string
  cityName: string
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const list = ref<Row[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const keyword = ref('')

async function fetchList() {
  if (!props.bankId || !props.cityCode)
    return
  loading.value = true
  try {
    const params = new URLSearchParams({
      bankId: props.bankId,
      cityCode: props.cityCode,
      page: String(page.value),
      pageSize: String(pageSize.value),
    })
    if (keyword.value.trim())
      params.set('keyword', keyword.value.trim())
    const res = await requestJson<ListResp>(`/api/users/cards?${params.toString()}`)
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

watch(() => props.visible, (v) => {
  if (v) {
    page.value = 1
    keyword.value = ''
    fetchList()
  }
})

function handleSearch() {
  page.value = 1
  fetchList()
}

function handlePage(p: { current: number, pageSize: number }) {
  page.value = p.current
  pageSize.value = p.pageSize
  fetchList()
}

const columns = [
  { colKey: 'cover', title: '卡面', width: 90 },
  { colKey: 'user', title: '用户', width: 160 },
  { colKey: 'cardName', title: '卡名', minWidth: 200, ellipsis: true },
  { colKey: 'cardLastFour', title: '末4位', width: 80 },
  { colKey: 'cardType', title: '类型', width: 80 },
  { colKey: 'regionName', title: '地区', width: 120 },
]
</script>

<template>
  <t-drawer
    :visible="visible"
    :header="`${bankName} · ${cityName}（${total} 张卡）`"
    size="900px"
    :footer="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="flex gap-2 mb-3">
      <t-input
        v-model="keyword"
        placeholder="按卡名/末4位搜"
        clearable
        style="width: 280px"
        @enter="handleSearch"
        @clear="handleSearch"
      />
      <t-button theme="primary" @click="handleSearch">
        搜索
      </t-button>
    </div>

    <t-table
      row-key="id"
      :data="list"
      :columns="columns"
      :loading="loading"
      :pagination="{ current: page, pageSize, total, showJumper: true, pageSizeOptions: [10, 20, 50] }"
      stripe
      bordered
      @page-change="handlePage"
    >
      <template #cover="{ row }">
        <img v-if="row.cover" :src="row.cover" class="h-12 w-20 object-cover rounded" >
        <span v-else class="text-gray-400">-</span>
      </template>
      <template #user="{ row }">
        <div class="flex gap-2 items-center">
          <t-avatar v-if="row.avatar" :image="row.avatar" size="small" />
          <div>
            <div class="text-sm">{{ row.username || '未命名' }}</div>
            <div class="text-xs text-gray-500">#{{ row.uid6 || row.userId }}</div>
          </div>
        </div>
      </template>
      <template #cardName="{ row }">
        <span v-if="row.cardName">{{ row.cardName }}</span>
        <span v-else class="text-gray-400">未命名</span>
      </template>
    </t-table>
  </t-drawer>
</template>
