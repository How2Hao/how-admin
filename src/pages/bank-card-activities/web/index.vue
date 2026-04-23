<script setup lang="ts">
import type { CreateBankCardActivityResponse, ParseBankCardActivityResponse } from '@/types/bankCardActivities'
import { MessagePlugin } from 'tdesign-vue-next'
import { ensureCurrentOption, useBankCardActivityForm } from '@/composables/useBankCardActivityForm'
import { useBankCardActivityReferenceData } from '@/composables/useBankCardActivityReferenceData'
import { requestJson } from '@/composables/useJsonRequest'

const target = ref('')
const isParsing = ref(false)
const isSaving = ref(false)
const hasParsedResult = ref(false)
const iframeLoaded = ref(false)
const parsedPreviewUrl = ref('')
let previewLoadTimer: ReturnType<typeof setTimeout> | null = null

const {
  form,
  fillForm,
  buildPayload,
  validateForm,
  cleanupRepeatFields,
} = useBankCardActivityForm()

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

const bankSelectOptions = computed(() =>
  ensureCurrentOption(bankOptions.value, form.bankId, (value: number | string) => `当前银行 ID: ${value}`))
const bankCardTemplateSelectOptions = computed(() =>
  ensureCurrentOption(bankCardTemplateOptions.value, form.bankCardTemplateId, (value: number | string) => `当前卡模板 ID: ${value}`))
const regionSelectOptions = computed(() =>
  ensureCurrentOption(regionOptions.value, form.regionCode, (value: number | string) => `当前区域代码: ${value}`))
const benefitUsagePlatformSelectOptions = computed(() =>
  ensureCurrentOption(benefitUsagePlatformOptions.value, form.benefitUsagePlatformId, (value: number | string) => `当前使用平台 ID: ${value}`))
const activityCategorySelectOptions = computed(() =>
  ensureCurrentOption(activityCategoryOptions.value, form.activityCategoryId, (value: number | string) => `当前活动分类 ID: ${value}`))

const previewUrl = computed(() => parsedPreviewUrl.value.trim())
const previewFrameUrl = computed(() =>
  previewUrl.value
    ? `/api/bankCardActivities/web/preview?url=${encodeURIComponent(previewUrl.value)}`
    : '')

onMounted(async () => {
  try {
    await loadReferenceOptions()
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载基础选项失败')
  }
})

watch(previewUrl, () => {
  iframeLoaded.value = false
  if (previewLoadTimer) {
    clearTimeout(previewLoadTimer)
    previewLoadTimer = null
  }

  if (previewFrameUrl.value) {
    previewLoadTimer = setTimeout(() => {
      iframeLoaded.value = true
      previewLoadTimer = null
    }, 2000)
  }
})

onBeforeUnmount(() => {
  if (previewLoadTimer) {
    clearTimeout(previewLoadTimer)
  }
})

async function runSearch(handler: (keyword: string) => Promise<void>, keyword: string, fallbackMessage: string) {
  try {
    await handler(keyword)
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : fallbackMessage)
  }
}

async function handleParse() {
  if (!target.value.trim()) {
    MessagePlugin.warning('请输入网页地址')
    return
  }

  isParsing.value = true

  try {
    const parsed = await requestJson<ParseBankCardActivityResponse>('/api/bankCardActivities/web/parseUrl', {
      method: 'POST',
      body: { url: target.value.trim() },
    })

    fillForm(parsed)
    await loadResolvedSelections(parsed)
    parsedPreviewUrl.value = target.value.trim()
    hasParsedResult.value = true
    MessagePlugin.success('解析成功，请检查并编辑表单后保存')
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '解析失败')
  }
  finally {
    isParsing.value = false
  }
}

async function handleSave() {
  if (!target.value.trim() && !hasParsedResult.value) {
    MessagePlugin.warning('请先输入网页地址并解析')
    return
  }

  const validationError = validateForm()
  if (validationError) {
    MessagePlugin.warning(validationError)
    return
  }

  isSaving.value = true

  try {
    const result = await requestJson<CreateBankCardActivityResponse>('/api/bankCardActivities/web/create', {
      method: 'POST',
      body: buildPayload(),
    })

    MessagePlugin.success(`保存成功，记录 ID：${result.id}`)
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '保存失败')
  }
  finally {
    isSaving.value = false
  }
}

function handlePreviewLoaded() {
  iframeLoaded.value = true
  if (previewLoadTimer) {
    clearTimeout(previewLoadTimer)
    previewLoadTimer = null
  }
}
</script>

<template>
  <div class="p-6 gap-6 grid xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
    <div class="min-w-0 space-y-6">
      <t-card title="网页解析">
        <div class="flex flex-col gap-3 md:flex-row">
          <t-input
            v-model="target"
            size="large"
            clearable
            placeholder="请输入网页地址获取银行卡活动信息"
            @enter="handleParse"
          />
          <t-button
            theme="primary"
            size="large"
            :loading="isParsing"
            :disabled="!target.trim()"
            @click="handleParse"
          >
            解析网页
          </t-button>
        </div>
      </t-card>

      <t-card v-if="hasParsedResult" title="活动表单">
        <BankCardActivityForm
          v-model:form="form"
          :bank-select-options="bankSelectOptions"
          :bank-card-template-select-options="bankCardTemplateSelectOptions"
          :region-select-options="regionSelectOptions"
          :benefit-usage-platform-select-options="benefitUsagePlatformSelectOptions"
          :activity-category-select-options="activityCategorySelectOptions"
          :card-organization-options="cardOrganizationOptions"
          :benefit-category-options="benefitCategoryOptions"
          :benefit-pay-platform-options="benefitPayPlatformOptions"
          :bank-card-type-options="bankCardTypeOptions"
          :region-match-strategy-options="regionMatchStrategyOptions"
          :repeat-type-options="repeatTypeOptions"
          @search-banks="runSearch(searchBanks, $event, '搜索银行失败')"
          @search-bank-card-templates="runSearch(searchBankCardTemplates, $event, '搜索银行卡模板失败')"
          @search-regions="runSearch(searchRegions, $event, '搜索地区失败')"
          @search-benefit-usage-platforms="runSearch(searchBenefitUsagePlatforms, $event, '搜索使用平台失败')"
          @search-activity-categories="runSearch(searchActivityCategories, $event, '搜索活动分类失败')"
          @repeat-type-change="cleanupRepeatFields"
        >
          <template #actions>
            <div class="flex justify-end">
              <t-button theme="primary" size="large" :loading="isSaving" @click="handleSave">
                保存到活动模板
              </t-button>
            </div>
          </template>
        </BankCardActivityForm>
      </t-card>
    </div>

    <t-card title="网页预览" class="min-h-[720px]">
      <div v-if="previewUrl" class="space-y-3">
        <div class="text-sm text-gray-500 break-all">
          当前地址：{{ previewUrl }}
        </div>
        <div class="border border-gray-200 rounded-lg border-solid h-[760px] relative overflow-hidden">
          <div
            v-if="!iframeLoaded"
            class="text-sm text-gray-500 bg-white/70 flex items-center inset-0 justify-center absolute z-1 backdrop-blur-sm"
          >
            正在加载网页预览…
          </div>
          <iframe
            :src="previewFrameUrl"
            class="border-0 bg-white h-full w-full"
            referrerpolicy="no-referrer"
            @load="handlePreviewLoaded"
          />
        </div>
        <div class="text-xs text-gray-400">
          右侧预览通过本地代理加载，适合对照录入；如果目标网页本身结构异常，预览可能与原站略有差异。
        </div>
      </div>
      <div v-else class="text-sm text-gray-500 border border-gray-300 rounded-lg border-dashed flex h-[760px] items-center justify-center">
        输入网页地址后，右侧会显示预览。
      </div>
    </t-card>
  </div>
</template>
