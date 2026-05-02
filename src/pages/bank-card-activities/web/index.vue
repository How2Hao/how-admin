<script setup lang="ts">
import type { ParseBankCardActivityResponse } from '@/types/bankCardActivities'
import type { ParseTaskStatus } from '@/components/bank-card-activities/ParseTaskCard.vue'
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
const taskStatuses = reactive<Record<string, ParseTaskStatus>>({})

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function addTask() {
  const id = genId()
  tasks.value.unshift({ id })
  taskStatuses[id] = 'empty'
}

function handleRemove(id: string) {
  tasks.value = tasks.value.filter(t => t.id !== id)
  delete taskStatuses[id]
}

function handleStatusChange(taskId: string, status: ParseTaskStatus) {
  taskStatuses[taskId] = status
}

const stats = computed(() => {
  let parsing = 0
  let saving = 0
  let saved = 0
  let parsed = 0
  let error = 0
  for (const s of Object.values(taskStatuses)) {
    if (s === 'parsing') parsing++
    else if (s === 'saving') saving++
    else if (s === 'saved') saved++
    else if (s === 'parsed') parsed++
    else if (s === 'error') error++
  }
  return {
    total: tasks.value.length,
    parsing,
    saving,
    saved,
    parsed,
    error,
  }
})

async function runSearch(handler: (kw: string) => Promise<void>, kw: string, fallback: string) {
  try { await handler(kw) }
  catch (e: any) { MessagePlugin.error(e?.message ?? fallback) }
}

async function handleResolveSelections(parsed: ParseBankCardActivityResponse) {
  try { await loadResolvedSelections(parsed.templates[0]) }
  catch (e: any) { MessagePlugin.error(e?.message ?? '解析下拉选项失败') }
}

onMounted(async () => {
  try {
    await loadReferenceOptions()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载基础选项失败')
  }
  if (tasks.value.length === 0)
    addTask()
})
</script>

<template>
  <div class="page-wrap">
    <header class="page-header">
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">总任务</span>
          <span class="stat-value">{{ stats.total }}</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-dot stat-dot-parsing" />
          <span class="stat-label">解析中</span>
          <span class="stat-value">{{ stats.parsing }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot stat-dot-parsed" />
          <span class="stat-label">待保存</span>
          <span class="stat-value">{{ stats.parsed }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot stat-dot-saved" />
          <span class="stat-label">已保存</span>
          <span class="stat-value">{{ stats.saved }}</span>
        </div>
        <div v-if="stats.error > 0" class="stat-item">
          <span class="stat-dot stat-dot-error" />
          <span class="stat-label">失败</span>
          <span class="stat-value stat-value-error">{{ stats.error }}</span>
        </div>
      </div>
      <div class="header-actions">
        <t-button theme="primary" size="medium" @click="addTask">
          + 添加任务
        </t-button>
      </div>
    </header>

    <div class="task-list">
      <ParseTaskCard
        v-for="(t, idx) in tasks"
        :key="t.id"
        :task-id="t.id"
        :task-index="tasks.length - idx"
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
        @status-change="handleStatusChange"
        @search-banks="(kw) => runSearch(searchBanks, kw, '搜索银行失败')"
        @search-bank-card-templates="(kw) => runSearch(searchBankCardTemplates, kw, '搜索银行卡模板失败')"
        @search-regions="(kw) => runSearch(searchRegions, kw, '搜索地区失败')"
        @search-benefit-usage-platforms="(kw) => runSearch(searchBenefitUsagePlatforms, kw, '搜索使用平台失败')"
        @search-activity-categories="(kw) => runSearch(searchActivityCategories, kw, '搜索活动分类失败')"
        @resolve-selections="handleResolveSelections"
      />
    </div>

    <div v-if="!tasks.length" class="empty-hint">
      点上方「+ 添加任务」开始
    </div>
  </div>
</template>

<style scoped>
.page-wrap {
  padding: 16px 24px 32px;
  max-width: 1600px;
  margin: 0 auto;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: -16px -24px 16px;
  border-bottom: 1px solid #eee;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 13px;
  color: #555;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-divider {
  width: 1px;
  height: 16px;
  background: #ddd;
}

.stat-label {
  color: #888;
}

.stat-value {
  font-weight: 600;
  color: #222;
  font-variant-numeric: tabular-nums;
}

.stat-value-error {
  color: #d54941;
}

.stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.stat-dot-parsing { background: #0052d9; animation: pulse 1.4s ease-in-out infinite; }
.stat-dot-parsed { background: #ed7b2f; }
.stat-dot-saved { background: #2ba471; }
.stat-dot-error { background: #d54941; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-hint {
  text-align: center;
  color: #999;
  padding: 32px 0;
  font-size: 14px;
}
</style>
