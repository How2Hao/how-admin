<script setup lang="ts">
import type { ParseBankCardActivityResponse } from '@/types/bankCardActivities'
import { MessagePlugin } from 'tdesign-vue-next'
import ParseTaskCard from '@/components/bank-card-activities/ParseTaskCard.vue'
import { useBankCardActivityReferenceData } from '@/composables/useBankCardActivityReferenceData'

const {
  bankOptions,
  bankCardTemplateOptions,
  regionOptions,
  benefitUsagePlatformOptions,
  activityCategoryOptions,
  cardOrganizationOptions,
  benefitCategoryOptions,
  benefitPayPlatformOptions,
  bankCardTypeOptions,
  regionMatchStrategyOptions,
  repeatTypeOptions,
  loadReferenceOptions,
  searchBanks,
  searchBankCardTemplates,
  searchRegions,
  searchBenefitUsagePlatforms,
  searchActivityCategories,
  loadResolvedSelections,
} = useBankCardActivityReferenceData()

interface Task { id: string }
const tasks = ref<Task[]>([])

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function addTask() {
  tasks.value.push({ id: genId() })
}

function handleRemove(id: string) {
  tasks.value = tasks.value.filter(t => t.id !== id)
}

async function runSearch(handler: (kw: string) => Promise<void>, kw: string, fallback: string) {
  try { await handler(kw) }
  catch (e: any) { MessagePlugin.error(e?.message ?? fallback) }
}

async function handleResolveSelections(parsed: ParseBankCardActivityResponse) {
  try { await loadResolvedSelections(parsed) }
  catch (e: any) { MessagePlugin.error(e?.message ?? '解析下拉选项失败') }
}

onMounted(async () => {
  try {
    await loadReferenceOptions()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载基础选项失败')
  }
  // seed 1 张空卡，用户落地就能开始填
  if (tasks.value.length === 0)
    addTask()
})
</script>

<template>
  <div class="p-6">
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ParseTaskCard
        v-for="(t, idx) in tasks"
        :key="t.id"
        :task-id="t.id"
        :task-index="idx + 1"
        :bank-options="bankOptions"
        :bank-card-template-options="bankCardTemplateOptions"
        :region-options="regionOptions"
        :benefit-usage-platform-options="benefitUsagePlatformOptions"
        :activity-category-options="activityCategoryOptions"
        :card-organization-options="cardOrganizationOptions"
        :benefit-category-options="benefitCategoryOptions"
        :benefit-pay-platform-options="benefitPayPlatformOptions"
        :bank-card-type-options="bankCardTypeOptions"
        :region-match-strategy-options="regionMatchStrategyOptions"
        :repeat-type-options="repeatTypeOptions"
        @remove="handleRemove"
        @search-banks="(kw) => runSearch(searchBanks, kw, '搜索银行失败')"
        @search-bank-card-templates="(kw) => runSearch(searchBankCardTemplates, kw, '搜索银行卡模板失败')"
        @search-regions="(kw) => runSearch(searchRegions, kw, '搜索地区失败')"
        @search-benefit-usage-platforms="(kw) => runSearch(searchBenefitUsagePlatforms, kw, '搜索使用平台失败')"
        @search-activity-categories="(kw) => runSearch(searchActivityCategories, kw, '搜索活动分类失败')"
        @resolve-selections="handleResolveSelections"
      />
    </div>

    <div class="flex justify-center my-4">
      <t-button theme="primary" variant="dashed" size="large" @click="addTask">
        + 添加任务
      </t-button>
    </div>

    <div v-if="!tasks.length" class="text-center text-gray-400 py-8">
      点上方「+ 添加任务」开始
    </div>
  </div>
</template>
