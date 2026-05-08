<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import CardListDrawer from '@/components/users/cards/CardListDrawer.vue'
import CardPivotTable from '@/components/users/cards/CardPivotTable.vue'

interface PivotResp {
  banks: { id: string, name: string, total: number }[]
  cities: { code: string, name: string, level: number, total: number }[]
  cells: [number, number, number][]
  totalCards: number
}

const data = ref<PivotResp>({ banks: [], cities: [], cells: [], totalCards: 0 })
const loading = ref(false)

const drawerVisible = ref(false)
const drawerBankId = ref('')
const drawerCityCode = ref('')
const drawerBankName = ref('')
const drawerCityName = ref('')

async function fetchPivot() {
  loading.value = true
  try {
    data.value = await requestJson<PivotResp>('/api/users/cards/pivot')
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载透视表失败')
  }
  finally {
    loading.value = false
  }
}

function handleCellClick(p: { bankId: string, cityCode: string, count: number, bankName: string, cityName: string }) {
  drawerBankId.value = p.bankId
  drawerCityCode.value = p.cityCode
  drawerBankName.value = p.bankName
  drawerCityName.value = p.cityName
  drawerVisible.value = true
}

onMounted(fetchPivot)
</script>

<template>
  <div class="p-6">
    <t-card title="用户卡片总览">
      <div class="text-sm text-gray-500 mb-3">
        透视表：行=银行，列=城市，格子=卡数，颜色越深卡越多。点格子查看具体卡片明细。
        共 {{ data.totalCards }} 张卡，{{ data.banks.length }} 家银行，{{ data.cities.length }} 个城市。
      </div>
      <t-loading :loading="loading">
        <CardPivotTable
          :banks="data.banks"
          :cities="data.cities"
          :cells="data.cells"
          @cell-click="handleCellClick"
        />
      </t-loading>
    </t-card>

    <CardListDrawer
      v-model:visible="drawerVisible"
      :bank-id="drawerBankId"
      :city-code="drawerCityCode"
      :bank-name="drawerBankName"
      :city-name="drawerCityName"
    />
  </div>
</template>
