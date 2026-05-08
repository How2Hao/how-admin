<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface Row {
  id: number
  name: string
  code: string | null
  logo: string | null
  pinyinIndex: string | null
  isVisible: number
}

const list = ref<Row[]>([])
const loading = ref(false)
const keyword = ref('')

const columns = [
  { colKey: 'logo', title: '图标', width: 72 },
  { colKey: 'name', title: '名称', width: 200 },
  { colKey: 'code', title: 'Code', width: 160 },
  { colKey: 'isVisible', title: '是否可见', width: 110 },
]

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((r) => {
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

async function onToggle(row: Row, next: unknown) {
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

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="银行管理">
      <template #actions>
        <t-input
          v-model="keyword"
          placeholder="搜索名称 / code / 拼音"
          clearable
          style="width: 260px"
        />
      </template>

      <t-table
        row-key="id"
        :data="filtered"
        :columns="columns"
        :loading="loading"
        stripe
        bordered
      >
        <template #logo="{ row }">
          <img v-if="row.logo" :src="row.logo" class="w-8 h-8 object-contain rounded">
          <span v-else class="text-gray-400">-</span>
        </template>
        <template #isVisible="{ row }">
          <t-switch
            :value="row.isVisible === 1"
            @change="(v) => onToggle(row, v)"
          />
        </template>
      </t-table>
    </t-card>
  </div>
</template>
