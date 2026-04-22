<script setup lang="ts">
import type {
  BankTaskFormData,
  BankTaskPayload,
  CreateBankCardActivityResponse,
  ParseBankCardActivityResponse,
  ReferenceOptionsResponse,
  ResolveSelectionsResponse,
  SearchActivityCategoriesResponse,
  SearchBankCardTemplatesResponse,
  SearchBanksResponse,
  SearchBenefitUsagePlatformsResponse,
  SearchRegionsResponse,
  SelectOption,
} from '@/types/bankCardActivities'
import { MessagePlugin } from 'tdesign-vue-next'

const weekOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1} 月`,
  value: index + 1,
}))

const monthDayOptions = Array.from({ length: 31 }, (_, index) => ({
  label: `${index + 1} 日`,
  value: index + 1,
}))

const target = ref('')
const isParsing = ref(false)
const isSaving = ref(false)
const hasParsedResult = ref(false)
const referenceOptions = ref<ReferenceOptionsResponse | null>(null)
const iframeLoaded = ref(false)
const parsedPreviewUrl = ref('')
let previewLoadTimer: ReturnType<typeof setTimeout> | null = null

const bankOptions = ref<SelectOption[]>([])
const bankCardTemplateOptions = ref<SelectOption[]>([])
const regionOptions = ref<SelectOption[]>([])
const benefitUsagePlatformOptions = ref<SelectOption[]>([])
const activityCategoryOptions = ref<SelectOption[]>([])

const form = reactive<BankTaskFormData>(createEmptyForm())

const startDateModel = computed({
  get: () => form.startDate || undefined,
  set: (value) => {
    form.startDate = typeof value === 'string' ? value : ''
  },
})

const endDateModel = computed({
  get: () => form.endDate || undefined,
  set: (value) => {
    form.endDate = typeof value === 'string' ? value : ''
  },
})

const reminderTimeModel = computed({
  get: () => form.reminderTime || undefined,
  set: (value) => {
    form.reminderTime = typeof value === 'string' ? value : ''
  },
})

const cardOrganizationOptions = computed(() => referenceOptions.value?.cardOrganizations ?? [])
const benefitCategoryOptions = computed(() => referenceOptions.value?.benefitCategories ?? [])
const benefitPayPlatformOptions = computed(() => referenceOptions.value?.benefitPayPlatforms ?? [])
const bankCardTypeOptions = computed<SelectOption[]>(() => [...(referenceOptions.value?.enums.bankCardType ?? [])])
const regionMatchStrategyOptions = computed<SelectOption[]>(() => [...(referenceOptions.value?.enums.regionMatchStrategy ?? [])])
const repeatTypeOptions = computed<SelectOption[]>(() => [...(referenceOptions.value?.enums.repeatType ?? [])])

const bankSelectOptions = computed(() =>
  ensureCurrentOption(bankOptions.value, form.bankId, value => `当前银行 ID: ${value}`))
const bankCardTemplateSelectOptions = computed(() =>
  ensureCurrentOption(bankCardTemplateOptions.value, form.bankCardTemplateId, value => `当前卡模板 ID: ${value}`))
const regionSelectOptions = computed(() =>
  ensureCurrentOption(regionOptions.value, form.regionCode, value => `当前区域代码: ${value}`))
const benefitUsagePlatformSelectOptions = computed(() =>
  ensureCurrentOption(benefitUsagePlatformOptions.value, form.benefitUsagePlatformId, value => `当前使用平台 ID: ${value}`))
const activityCategorySelectOptions = computed(() =>
  ensureCurrentOption(activityCategoryOptions.value, form.activityCategoryId, value => `当前活动分类 ID: ${value}`))
const previewUrl = computed(() => parsedPreviewUrl.value.trim())
const previewFrameUrl = computed(() =>
  previewUrl.value
    ? `/api/bankCardActivities/web/preview?url=${encodeURIComponent(previewUrl.value)}`
    : '')

const bankIdModel = computed({
  get: () => form.bankId ?? undefined,
  set: (value) => {
    form.bankId = typeof value === 'number' ? value : null
  },
})

const bankCardOrganizationModel = computed({
  get: () => form.bankCardOrganization ?? undefined,
  set: (value) => {
    form.bankCardOrganization = typeof value === 'number' ? value : null
  },
})

const bankCardTemplateIdModel = computed({
  get: () => form.bankCardTemplateId ?? undefined,
  set: (value) => {
    form.bankCardTemplateId = typeof value === 'number' ? value : null
  },
})

const benefitAmountModel = computed({
  get: () => form.benefitAmount ?? undefined,
  set: (value) => {
    form.benefitAmount = typeof value === 'number' ? value : null
  },
})

const benefitCategoryIdModel = computed({
  get: () => form.benefitCategoryId ?? undefined,
  set: (value) => {
    form.benefitCategoryId = typeof value === 'number' ? value : null
  },
})

const benefitPayPlatformIdModel = computed({
  get: () => form.benefitPayPlatformId ?? undefined,
  set: (value) => {
    form.benefitPayPlatformId = typeof value === 'number' ? value : null
  },
})

const benefitUsagePlatformIdModel = computed({
  get: () => form.benefitUsagePlatformId ?? undefined,
  set: (value) => {
    form.benefitUsagePlatformId = typeof value === 'number' ? value : null
  },
})

const activityCategoryIdModel = computed({
  get: () => form.activityCategoryId ?? undefined,
  set: (value) => {
    form.activityCategoryId = typeof value === 'number' ? value : null
  },
})

onMounted(async () => {
  await loadReferenceOptions()
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

function createEmptyForm(): BankTaskFormData {
  return {
    title: '',
    ruleBrief: '',
    ruleDetail: '',
    bankId: null,
    bankCardOrganization: 1,
    bankCardTemplateId: null,
    bankCardType: 'CREDIT',
    regionCode: '100000',
    regionMatchStrategy: 'EXACT',
    repeatType: 'ONE_TIME',
    daysOfWeek: [],
    yearlyMonths: [],
    daysOfMonth: [],
    yearlyDaysOfMonth: [],
    frequencyControl: '',
    reminderTime: '10:00',
    startDate: '',
    endDate: '',
    benefitAmount: null,
    benefitDescription: '',
    extraConditionsText: '',
    benefitCategoryId: null,
    benefitPayPlatformId: null,
    benefitUsagePlatformId: null,
    activityCategoryId: null,
    participationDifficulty: '',
    guideText: '',
  }
}

function fillForm(payload: ParseBankCardActivityResponse) {
  form.title = payload.title
  form.ruleBrief = payload.ruleBrief ?? ''
  form.ruleDetail = payload.ruleDetail ?? ''
  form.bankId = payload.bankId
  form.bankCardOrganization = payload.bankCardOrganization ?? 1
  form.bankCardTemplateId = payload.bankCardTemplateId
  form.bankCardType = payload.bankCardType
  form.regionCode = payload.regionCode ?? '100000'
  form.regionMatchStrategy = payload.regionMatchStrategy ?? 'EXACT'
  form.repeatType = payload.repeatType
  form.daysOfWeek = payload.daysOfWeek ?? []
  form.yearlyMonths = payload.yearlyMonths ?? []
  form.daysOfMonth = payload.daysOfMonth ?? []
  form.yearlyDaysOfMonth = payload.yearlyDaysOfMonth ?? []
  form.frequencyControl = payload.frequencyControl ?? ''
  form.reminderTime = payload.reminderTime
  form.startDate = payload.startDate
  form.endDate = payload.endDate
  form.benefitAmount = payload.benefitAmount
  form.benefitDescription = payload.benefitDescription ?? ''
  form.extraConditionsText = payload.extraConditionsText ?? ''
  form.benefitCategoryId = payload.benefitCategoryId
  form.benefitPayPlatformId = payload.benefitPayPlatformId
  form.benefitUsagePlatformId = payload.benefitUsagePlatformId
  form.activityCategoryId = payload.activityCategoryId
  form.participationDifficulty = payload.participationDifficulty ?? ''
  form.guideText = payload.guideText ?? ''

  cleanupRepeatFields()
}

function mergeCurrentOption(options: Ref<SelectOption[]>, option: SelectOption | null) {
  if (!option)
    return

  options.value = ensureCurrentOption(options.value, option.value, () => option.label).map((item) => {
    if (item.value === option.value) {
      return option
    }

    return item
  })
}

function cleanupRepeatFields() {
  if (form.repeatType !== 'WEEKLY')
    form.daysOfWeek = []

  if (form.repeatType !== 'MONTHLY')
    form.daysOfMonth = []

  if (form.repeatType !== 'YEARLY') {
    form.yearlyMonths = []
    form.yearlyDaysOfMonth = []
  }
}

function normalizeNullableString(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeNumberArray(values: number[]) {
  return values.length > 0 ? values : null
}

function buildPayload(): BankTaskPayload {
  cleanupRepeatFields()

  return {
    title: form.title.trim(),
    ruleBrief: normalizeNullableString(form.ruleBrief),
    ruleDetail: normalizeNullableString(form.ruleDetail),
    bankId: form.bankId ?? 0,
    bankCardOrganization: form.bankCardOrganization ?? 1,
    bankCardTemplateId: form.bankCardTemplateId,
    bankCardType: form.bankCardType,
    regionCode: form.regionCode.trim(),
    regionMatchStrategy: form.regionMatchStrategy,
    repeatType: form.repeatType,
    daysOfWeek: normalizeNumberArray(form.daysOfWeek),
    yearlyMonths: normalizeNumberArray(form.yearlyMonths),
    daysOfMonth: normalizeNumberArray(form.daysOfMonth),
    yearlyDaysOfMonth: normalizeNumberArray(form.yearlyDaysOfMonth),
    frequencyControl: normalizeNullableString(form.frequencyControl),
    reminderTime: form.reminderTime.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    benefitAmount: form.benefitAmount ?? 0,
    benefitDescription: normalizeNullableString(form.benefitDescription),
    extraConditionsText: normalizeNullableString(form.extraConditionsText),
    benefitCategoryId: form.benefitCategoryId,
    benefitPayPlatformId: form.benefitPayPlatformId,
    benefitUsagePlatformId: form.benefitUsagePlatformId,
    activityCategoryId: form.activityCategoryId,
    participationDifficulty: normalizeNullableString(form.participationDifficulty),
    guideText: normalizeNullableString(form.guideText),
  }
}

function validateForm() {
  if (!target.value.trim() && !hasParsedResult.value)
    return '请先输入网页地址并解析'
  if (!form.title.trim())
    return '请填写活动标题'
  if (!form.bankId)
    return '请选择银行'
  if (!form.bankCardOrganization)
    return '请选择银行卡组织'
  if (!form.bankCardType)
    return '请选择银行卡类型'
  if (!form.regionCode.trim())
    return '请选择活动区域'
  if (!form.regionMatchStrategy)
    return '请选择区域匹配策略'
  if (!form.repeatType)
    return '请选择重复类型'
  if (!form.reminderTime.trim())
    return '请填写提醒时间'
  if (!form.startDate.trim())
    return '请填写开始时间'
  if (!form.endDate.trim())
    return '请填写结束时间'
  if (form.benefitAmount === null || Number.isNaN(form.benefitAmount))
    return '请填写预估收益'

  const startDate = new Date(form.startDate.replace(' ', 'T')).getTime()
  const endDate = new Date(form.endDate.replace(' ', 'T')).getTime()

  if (Number.isNaN(startDate) || Number.isNaN(endDate))
    return '开始时间或结束时间格式不正确'
  if (startDate > endDate)
    return '结束时间不能早于开始时间'
  if (form.repeatType === 'WEEKLY' && form.daysOfWeek.length === 0)
    return '请至少选择一个每周触发日'
  if (form.repeatType === 'MONTHLY' && form.daysOfMonth.length === 0)
    return '请至少选择一个每月触发日'
  if (form.repeatType === 'YEARLY' && form.yearlyMonths.length === 0)
    return '请至少选择一个每年触发月份'
  if (form.repeatType === 'YEARLY' && form.yearlyDaysOfMonth.length === 0)
    return '请至少选择一个每年触发日'
  if (form.repeatType === 'YEARLY' && form.yearlyMonths.length !== form.yearlyDaysOfMonth.length)
    return '每年触发月份和日期数量需要一一对应'

  return null
}

function ensureCurrentOption(
  options: SelectOption[],
  currentValue: number | string | null,
  labelFactory: (value: number | string) => string,
) {
  if (currentValue === null || currentValue === '') {
    return options
  }

  const exists = options.some(option => option.value === currentValue)
  if (exists) {
    return options
  }

  return [
    {
      label: labelFactory(currentValue),
      value: currentValue,
    },
    ...options,
  ]
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || '请求失败')
  }

  return await response.json() as T
}

async function loadReferenceOptions() {
  try {
    referenceOptions.value = await fetchJson<ReferenceOptionsResponse>('/api/bankCardActivities/web/referenceOptions')
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载基础选项失败')
  }
}

async function searchBanks(keyword: string) {
  bankOptions.value = await fetchSearchOptions<SearchBanksResponse>(`/api/bankCardActivities/web/searchBanks?q=${encodeURIComponent(keyword)}`)
}

async function searchBankCardTemplates(keyword: string) {
  bankCardTemplateOptions.value = await fetchSearchOptions<SearchBankCardTemplatesResponse>(`/api/bankCardActivities/web/searchBankCardTemplates?q=${encodeURIComponent(keyword)}`)
}

async function searchRegions(keyword: string) {
  regionOptions.value = await fetchSearchOptions<SearchRegionsResponse>(`/api/bankCardActivities/web/searchRegions?q=${encodeURIComponent(keyword)}`)
}

async function searchBenefitUsagePlatforms(keyword: string) {
  benefitUsagePlatformOptions.value = await fetchSearchOptions<SearchBenefitUsagePlatformsResponse>(`/api/bankCardActivities/web/searchBenefitUsagePlatforms?q=${encodeURIComponent(keyword)}`)
}

async function searchActivityCategories(keyword: string) {
  activityCategoryOptions.value = await fetchSearchOptions<SearchActivityCategoriesResponse>(`/api/bankCardActivities/web/searchActivityCategories?q=${encodeURIComponent(keyword)}`)
}

async function fetchSearchOptions<T extends { options: SelectOption[] }>(url: string) {
  try {
    const response = await fetchJson<T>(url)
    return response.options
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '搜索失败')
    return []
  }
}

async function loadResolvedSelections(payload: ParseBankCardActivityResponse) {
  try {
    const resolved = await fetchJson<ResolveSelectionsResponse>('/api/bankCardActivities/web/resolveSelections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bankId: payload.bankId,
        bankCardTemplateId: payload.bankCardTemplateId,
        regionCode: payload.regionCode,
        benefitUsagePlatformId: payload.benefitUsagePlatformId,
        activityCategoryId: payload.activityCategoryId,
      }),
    })

    mergeCurrentOption(bankOptions, resolved.bank)
    mergeCurrentOption(bankCardTemplateOptions, resolved.bankCardTemplate)
    mergeCurrentOption(regionOptions, resolved.region)
    mergeCurrentOption(benefitUsagePlatformOptions, resolved.benefitUsagePlatform)
    mergeCurrentOption(activityCategoryOptions, resolved.activityCategory)
  }
  catch (error) {
    MessagePlugin.warning(error instanceof Error ? error.message : '当前已选项名称加载失败')
  }
}

async function handleParse() {
  if (!target.value.trim()) {
    MessagePlugin.warning('请输入网页地址')
    return
  }

  isParsing.value = true

  try {
    const parsed = await fetchJson<ParseBankCardActivityResponse>('/api/bankCardActivities/web/parseUrl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: target.value.trim() }),
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
  const validationError = validateForm()
  if (validationError) {
    MessagePlugin.warning(validationError)
    return
  }

  isSaving.value = true

  try {
    const result = await fetchJson<CreateBankCardActivityResponse>('/api/bankCardActivities/web/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload()),
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
        <t-form :data="form" label-align="top" required-mark>
          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="活动标题">
              <t-input v-model="form.title" placeholder="请输入活动标题" clearable />
            </t-form-item>
            <t-form-item label="银行卡类型">
              <t-select v-model="form.bankCardType" :options="bankCardTypeOptions" />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="银行">
              <t-select
                v-model="bankIdModel"
                filterable
                clearable
                :options="bankSelectOptions"
                placeholder="搜索银行名称"
                @search="searchBanks"
              />
            </t-form-item>
            <t-form-item label="银行卡组织">
              <t-select v-model="bankCardOrganizationModel" :options="cardOrganizationOptions" />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="银行卡模板">
              <t-select
                v-model="bankCardTemplateIdModel"
                filterable
                clearable
                :options="bankCardTemplateSelectOptions"
                placeholder="搜索银行卡模板"
                @search="searchBankCardTemplates"
              />
            </t-form-item>
            <t-form-item label="活动区域">
              <t-select
                v-model="form.regionCode"
                filterable
                clearable
                :options="regionSelectOptions"
                placeholder="搜索地区名称"
                @search="searchRegions"
              />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="区域匹配策略">
              <t-select v-model="form.regionMatchStrategy" :options="regionMatchStrategyOptions" />
            </t-form-item>
            <t-form-item label="重复类型">
              <t-select v-model="form.repeatType" :options="repeatTypeOptions" @change="cleanupRepeatFields" />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="提醒时间">
              <t-time-picker
                v-model="reminderTimeModel"
                format="HH:mm"
                clearable
                placeholder="请选择提醒时间"
              />
            </t-form-item>
            <t-form-item label="预估净收益">
              <t-input-number
                v-model="benefitAmountModel"
                theme="normal"
                :min="0"
                placeholder="请输入金额"
              />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="开始时间">
              <t-date-picker
                v-model="startDateModel"
                enable-time-picker
                format="YYYY-MM-DD HH:mm:ss"
                value-type="YYYY-MM-DD HH:mm:ss"
                clearable
                placeholder="请选择开始时间"
              />
            </t-form-item>
            <t-form-item label="结束时间">
              <t-date-picker
                v-model="endDateModel"
                enable-time-picker
                format="YYYY-MM-DD HH:mm:ss"
                value-type="YYYY-MM-DD HH:mm:ss"
                clearable
                placeholder="请选择结束时间"
              />
            </t-form-item>
          </div>

          <t-form-item v-if="form.repeatType === 'WEEKLY'" label="每周触发日">
            <t-checkbox-group v-model="form.daysOfWeek" :options="weekOptions" />
          </t-form-item>

          <t-form-item v-if="form.repeatType === 'MONTHLY'" label="每月触发日">
            <t-checkbox-group v-model="form.daysOfMonth" :options="monthDayOptions" />
          </t-form-item>

          <div v-if="form.repeatType === 'YEARLY'" class="gap-4 grid md:grid-cols-2">
            <t-form-item label="每年触发月份">
              <t-checkbox-group v-model="form.yearlyMonths" :options="monthOptions" />
            </t-form-item>
            <t-form-item label="每年触发日">
              <t-checkbox-group v-model="form.yearlyDaysOfMonth" :options="monthDayOptions" />
            </t-form-item>
          </div>

          <t-form-item label="活动简述">
            <t-textarea v-model="form.ruleBrief" :autosize="{ minRows: 2, maxRows: 4 }" />
          </t-form-item>

          <t-form-item label="活动细则">
            <t-textarea v-model="form.ruleDetail" :autosize="{ minRows: 3, maxRows: 8 }" />
          </t-form-item>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="优惠分类">
              <t-select v-model="benefitCategoryIdModel" clearable :options="benefitCategoryOptions" />
            </t-form-item>
            <t-form-item label="支付平台">
              <t-select v-model="benefitPayPlatformIdModel" clearable :options="benefitPayPlatformOptions" />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="使用平台">
              <t-select
                v-model="benefitUsagePlatformIdModel"
                filterable
                clearable
                :options="benefitUsagePlatformSelectOptions"
                placeholder="搜索优惠使用平台"
                @search="searchBenefitUsagePlatforms"
              />
            </t-form-item>
            <t-form-item label="活动分类">
              <t-select
                v-model="activityCategoryIdModel"
                filterable
                clearable
                :options="activityCategorySelectOptions"
                placeholder="搜索活动分类"
                @search="searchActivityCategories"
              />
            </t-form-item>
          </div>

          <div class="gap-4 grid md:grid-cols-2">
            <t-form-item label="频控说明">
              <t-input v-model="form.frequencyControl" clearable placeholder="例如：每日 1 次" />
            </t-form-item>
            <t-form-item label="参与难度">
              <t-input v-model="form.participationDifficulty" clearable placeholder="例如：简单、中等、复杂" />
            </t-form-item>
          </div>

          <t-form-item label="优惠描述">
            <t-input v-model="form.benefitDescription" clearable placeholder="一句话概括核心优惠" />
          </t-form-item>

          <t-form-item label="附加条件">
            <t-textarea v-model="form.extraConditionsText" :autosize="{ minRows: 2, maxRows: 6 }" />
          </t-form-item>

          <t-form-item label="操作指引">
            <t-textarea v-model="form.guideText" :autosize="{ minRows: 2, maxRows: 6 }" />
          </t-form-item>

          <div class="flex justify-end">
            <t-button theme="primary" size="large" :loading="isSaving" @click="handleSave">
              保存到活动模板
            </t-button>
          </div>
        </t-form>
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
