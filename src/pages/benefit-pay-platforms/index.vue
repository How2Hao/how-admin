<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import BenefitPayPlatformDialog from '@/components/benefit-pay-platforms/BenefitPayPlatformDialog.vue'

interface Row {
  id: number
  code: string
  name: string
  icon: string | null
  sortOrder: number | null
}

const list = ref<Row[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)

const columns = [
  { colKey: 'icon', title: '图标', width: 72 },
  { colKey: 'name', title: '名称', width: 150 },
  { colKey: 'code', title: 'Code', width: 160 },
  { colKey: 'sortOrder', title: '排序', width: 80 },
  { colKey: 'actions', title: '操作', width: 80, fixed: 'right' as const },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: Row[] }>('/api/benefitPayPlatforms')
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
  editingId.value = null
  dialogVisible.value = true
}

function openEdit(row: Row) {
  editingId.value = row.id
  dialogVisible.value = true
}

function handleSaved() {
  dialogVisible.value = false
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="支付平台管理">
      <template #actions>
        <t-button theme="primary" @click="openAdd">
          新增平台
        </t-button>
      </template>

      <t-table
        row-key="id"
        :data="list"
        :columns="columns"
        :loading="loading"
        stripe
        bordered
      >
        <template #icon="{ row }">
          <img v-if="row.icon" :src="row.icon" class="w-8 h-8 object-contain rounded">
          <span v-else class="text-gray-400">-</span>
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="outline" @click="openEdit(row)">
            编辑
          </t-button>
        </template>
      </t-table>
    </t-card>

    <BenefitPayPlatformDialog
      v-model:visible="dialogVisible"
      :platform-id="editingId"
      @saved="handleSaved"
    />
  </div>
</template>
