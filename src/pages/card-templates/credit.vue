<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import BankSidebar from './components/BankSidebar.vue'
import CardGrid from './components/CardGrid.vue'
import CardEditDialog from './components/CardEditDialog.vue'
import type { CardItemData } from './components/CardItem.vue'

interface BankGroup {
  bankId: string
  bankName: string
  bankLogo: string | null
  total: number
  sourceCounts: { flyert: number, '51credit': number, self: number }
}
interface ListResp {
  list: CardItemData[]
  total: number
  page: number
  pageSize: number
}
interface OptionsResp {
  banks: { label: string, value: number }[]
  cardOrganizations: { label: string, value: number }[]
  cardLevels: { label: string, value: number }[]
}

// ==== state ====
const groups = ref<BankGroup[]>([])
const selectedBankId = ref<string>('')
const cards = ref<CardItemData[]>([])
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const optionsRef = ref<OptionsResp>({ banks: [], cardOrganizations: [], cardLevels: [] })

const editingOpen = ref(false)
const editingId = ref<number | null>(null)

const selectedBank = computed(() =>
  groups.value.find(g => g.bankId === selectedBankId.value),
)

// ==== loaders ====
async function loadGroups() {
  try {
    const res = await requestJson<{ list: BankGroup[] }>('/api/cardTemplates/bank-groups')
    groups.value = res.list
    if (!selectedBankId.value && res.list.length) {
      selectedBankId.value = res.list[0].bankId   // 默认选总数最多那家（接口已按 total DESC 排序）
    }
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载银行分组失败')
  }
}

async function loadOptions() {
  try {
    optionsRef.value = await requestJson<OptionsResp>('/api/cardTemplates/options')
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载选项失败')
  }
}

async function loadCards() {
  if (!selectedBankId.value) return
  loading.value = true
  try {
    const params = new URLSearchParams({
      bankId: selectedBankId.value,
      keyword: keyword.value.trim(),
      page: '1',
      pageSize: '200',
    })
    const res = await requestJson<ListResp>(`/api/cardTemplates?${params.toString()}`)
    cards.value = res.list
    total.value = res.total
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载卡片列表失败')
  }
  finally {
    loading.value = false
  }
}

// ==== handlers ====
async function handleToggle(id: number, next: 0 | 1) {
  // 乐观更新
  const card = cards.value.find(c => c.id === id)
  const prev = card ? { isVisible: card.isVisible, dataSource: card.dataSource } : null
  if (card) card.isVisible = next
  try {
    const res = await requestJson<{
      id: number
      isVisible: number
      dataSource: string
      success: boolean
    }>(`/api/cardTemplates/${id}/visibility`, {
      method: 'PATCH',
      body: { is_visible: next },
    })
    // 后端可能把 data_source 升级为 flyert（is_visible=1 且原来不是 flyert）
    if (card && res.dataSource !== card.dataSource) {
      card.dataSource = res.dataSource
      // 来源变了，刷新左侧来源分布计数
      loadGroups()
    }
  }
  catch (e: any) {
    if (card && prev) {
      card.isVisible = prev.isVisible
      card.dataSource = prev.dataSource
    }
    MessagePlugin.error(e?.message ?? '切换显示失败')
  }
}

function handleEdit(id: number) {
  editingId.value = id
  editingOpen.value = true
}

async function handleSaved() {
  editingOpen.value = false
  // 重新拉当前银行卡片以同步编辑结果
  await loadCards()
}

// ==== effects ====
onMounted(async () => {
  await Promise.all([loadGroups(), loadOptions()])
  await loadCards()
})

watch(selectedBankId, () => {
  cards.value = []
  loadCards()
})

let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(loadCards, 300)
})
</script>

<template>
  <div class="page-credit">
    <BankSidebar
      v-model:selected-bank-id="selectedBankId"
      :groups="groups"
    />
    <CardGrid
      v-model:keyword="keyword"
      :bank-name="selectedBank?.bankName ?? ''"
      :total="total"
      :cards="cards"
      :loading="loading"
      @toggle="handleToggle"
      @edit="handleEdit"
    />
    <CardEditDialog
      :visible="editingOpen"
      :template-id="editingId"
      :options="optionsRef"
      @update:visible="(v) => editingOpen = v"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.page-credit {
  display: flex;
  height: calc(100vh - 64px);   /* 64 = t-header 高度 */
  overflow: hidden;
}
</style>
