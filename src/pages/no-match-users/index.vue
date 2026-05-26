<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface CardDetail {
  bankId: string
  bankName: string
  cardType: 'CREDIT' | 'DEBIT'
  orgName: string
  regionCode: string
  regionName: string
}
interface Dim { bankName: string, regionName: string, orgName: string }
interface NoMatchUser {
  userId: number
  uid6: string
  phone: string | null
  lastActiveAt: number | null
  cardCount: number
  cards: CardDetail[]
  dims: Dim[]
}
interface Resp {
  generatedAt: number
  candidateTotal: number
  noMatchTotal: number
  users: NoMatchUser[]
}

const data = ref<Resp | null>(null)
const loading = ref(false)
const keyword = ref('')

async function fetchData() {
  loading.value = true
  try {
    data.value = await requestJson<Resp>('/api/dashboard/no-match-users')
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

const rows = computed(() => {
  const list = data.value?.users ?? []
  const kw = keyword.value.trim()
  if (!kw) return list
  return list.filter(u =>
    (u.uid6 || '').includes(kw)
    || (u.phone || '').includes(kw)
    || u.cards.some(c => c.bankName.includes(kw) || c.regionName.includes(kw)),
  )
})

const columns = [
  { colKey: 'user', title: '用户', width: 200 },
  { colKey: 'lastActiveAt', title: '最近活跃', width: 150 },
  { colKey: 'cardCount', title: '卡数', width: 70 },
  { colKey: 'cards', title: '卡明细', minWidth: 320 },
  { colKey: 'dims', title: '建议补活动维度（银行 · 地区 · 卡组织）', minWidth: 280 },
]

function fmtTs(ms: number | null): string {
  if (!ms) return '-'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(fetchData)
</script>

<template>
  <div class="p-6 space-y-4">
    <t-card title="活动缺口用户">
      <template #subtitle>
        <span class="text-sm text-gray-500">近 7 日活跃 + 已录入银行卡 + 当前一个有效活动都匹配不到的用户</span>
      </template>

      <div class="flex flex-wrap gap-3 items-center mb-4">
        <t-input
          v-model="keyword"
          placeholder="搜 uid6 / 手机号 / 银行 / 地区"
          clearable
          style="width: 280px"
        />
        <t-button theme="primary" :loading="loading" @click="fetchData">
          刷新
        </t-button>
        <div class="text-sm text-gray-500 ml-auto">
          候选(活跃+有卡) <b>{{ data?.candidateTotal ?? '-' }}</b> ·
          0 匹配 <b class="text-red-500">{{ data?.noMatchTotal ?? '-' }}</b>
          <span v-if="data?.generatedAt"> · {{ fmtTs(data.generatedAt) }}</span>
        </div>
      </div>

      <t-table
        row-key="userId"
        :data="rows"
        :columns="columns"
        :loading="loading"
        size="medium"
        stripe
        bordered
        :pagination="{ defaultPageSize: 20, total: rows.length, showJumper: true, pageSizeOptions: [20, 50, 100] }"
      >
        <template #user="{ row }">
          <div class="text-left">
            <div class="text-sm font-medium">#{{ row.uid6 }}</div>
            <div class="text-xs text-gray-500">{{ row.phone || '无手机号' }} · ID {{ row.userId }}</div>
          </div>
        </template>

        <template #lastActiveAt="{ row }">
          <span class="text-xs text-gray-600">{{ fmtTs(row.lastActiveAt) }}</span>
        </template>

        <template #cards="{ row }">
          <div class="flex flex-col gap-1 text-left">
            <div v-for="(c, i) in row.cards" :key="i" class="flex items-center gap-1 flex-wrap">
              <t-tag size="small" variant="light" theme="primary">{{ c.bankName }}</t-tag>
              <t-tag size="small" variant="light">{{ c.cardType === 'CREDIT' ? '信用' : '借记' }}</t-tag>
              <t-tag size="small" variant="light" theme="success">{{ c.orgName }}</t-tag>
              <t-tag size="small" variant="light" theme="warning">{{ c.regionName }}</t-tag>
            </div>
          </div>
        </template>

        <template #dims="{ row }">
          <div class="flex flex-col gap-1 text-left">
            <div v-for="(d, i) in row.dims" :key="i" class="text-xs text-gray-700">
              {{ d.bankName }} · {{ d.regionName }} · {{ d.orgName }}
            </div>
          </div>
        </template>
      </t-table>
    </t-card>
  </div>
</template>
