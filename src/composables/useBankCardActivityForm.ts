import type { Ref } from 'vue'
import type { BankTaskFormData, BankTaskPayload, BankTaskTierForm, SelectOption } from '@/types/bankCardActivities'

/** AI 解析或后端返回的"模板组"形态，用于 fillForm */
export interface BankTaskLikeData {
  templates: Array<{
    title: string
    ruleBrief: string | null
    ruleDetail: string | null
    bankId: number
    bankCardOrganization: number | null
    bankCardTemplateId: number | null
    bankCardType: 'CREDIT' | 'DEBIT'
    regionCode: string
    regionMatchStrategy: 'EXACT' | 'EXCLUDE_PLAN_SINGLE_CITY'
    repeatType: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    daysOfWeek: number[] | null
    yearlyMonths: number[] | null
    daysOfMonth: number[] | null
    yearlyDaysOfMonth: number[] | null
    frequencyControl: string | null
    reminderTime: string
    startDate: string
    endDate: string
    benefitAmount: number | null
    benefitDescription: string | null
    extraConditionsText: string | null
    benefitCategoryId: number | null
    benefitPayPlatformId: number | null
    benefitUsagePlatformId: number | null
    activityCategoryId: number | null
    participationDifficulty: string | null
    guideText: string | null
    minAmount: number | null
    minCount: number | null
  }>
  tierExclusive: boolean | null
  id?: number
}

function makeEmptyTier(): BankTaskTierForm {
  return {
    minAmount: null,
    minCount: null,
    benefitAmount: null,
    benefitDescription: '',
  }
}

export function createEmptyBankTaskForm(): BankTaskFormData {
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
    extraConditionsText: '',
    benefitCategoryId: null,
    benefitPayPlatformId: null,
    benefitUsagePlatformId: null,
    activityCategoryId: null,
    participationDifficulty: '',
    guideText: '',
    tierExclusive: null,
    tiers: [makeEmptyTier()],
  }
}

export function ensureCurrentOption(
  options: SelectOption[],
  currentValue: number | string | null,
  labelFactory: (value: number | string) => string,
) {
  if (currentValue === null || currentValue === '') {
    return options
  }

  if (options.some(option => option.value === currentValue)) {
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

export function mergeCurrentOption(options: Ref<SelectOption[]>, option: SelectOption | null) {
  if (!option) {
    return
  }

  options.value = ensureCurrentOption(options.value, option.value, () => option.label).map((item) => {
    if (item.value === option.value) {
      return option
    }

    return item
  })
}

function normalizeNullableString(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeNumberArray(values: number[]) {
  return values.length > 0 ? values : null
}

export function useBankCardActivityForm() {
  const form = reactive<BankTaskFormData>(createEmptyBankTaskForm())

  function cleanupRepeatFields() {
    if (form.repeatType !== 'WEEKLY') {
      form.daysOfWeek = []
    }

    if (form.repeatType !== 'MONTHLY') {
      form.daysOfMonth = []
    }

    if (form.repeatType !== 'YEARLY') {
      form.yearlyMonths = []
      form.yearlyDaysOfMonth = []
    }
  }

  function resetForm() {
    Object.assign(form, createEmptyBankTaskForm())
  }

  function fillForm(payload: BankTaskLikeData) {
    if (!payload.templates || payload.templates.length === 0) {
      resetForm()
      return
    }
    const head = payload.templates[0]
    form.title = head.title
    form.ruleBrief = head.ruleBrief ?? ''
    form.ruleDetail = head.ruleDetail ?? ''
    form.bankId = head.bankId
    form.bankCardOrganization = head.bankCardOrganization ?? 1
    form.bankCardTemplateId = head.bankCardTemplateId
    form.bankCardType = head.bankCardType
    form.regionCode = head.regionCode ?? '100000'
    form.regionMatchStrategy = head.regionMatchStrategy ?? 'EXACT'
    form.repeatType = head.repeatType
    form.daysOfWeek = head.daysOfWeek ?? []
    form.yearlyMonths = head.yearlyMonths ?? []
    form.daysOfMonth = head.daysOfMonth ?? []
    form.yearlyDaysOfMonth = head.yearlyDaysOfMonth ?? []
    form.frequencyControl = head.frequencyControl ?? ''
    form.reminderTime = head.reminderTime
    form.startDate = head.startDate
    form.endDate = head.endDate
    form.extraConditionsText = head.extraConditionsText ?? ''
    form.benefitCategoryId = head.benefitCategoryId
    form.benefitPayPlatformId = head.benefitPayPlatformId
    form.benefitUsagePlatformId = head.benefitUsagePlatformId
    form.activityCategoryId = head.activityCategoryId
    form.participationDifficulty = head.participationDifficulty ?? ''
    form.guideText = head.guideText ?? ''
    form.tierExclusive = payload.tierExclusive ?? null
    form.tiers = payload.templates.map(tpl => ({
      minAmount: tpl.minAmount,
      minCount: tpl.minCount,
      benefitAmount: tpl.benefitAmount,
      benefitDescription: tpl.benefitDescription ?? '',
    }))
    if (form.tiers.length === 0) {
      form.tiers = [makeEmptyTier()]
    }

    cleanupRepeatFields()
  }

  function buildPayload(): BankTaskPayload {
    cleanupRepeatFields()

    const baseTemplate = {
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
      extraConditionsText: normalizeNullableString(form.extraConditionsText),
      benefitCategoryId: form.benefitCategoryId,
      benefitPayPlatformId: form.benefitPayPlatformId,
      benefitUsagePlatformId: form.benefitUsagePlatformId,
      activityCategoryId: form.activityCategoryId,
      participationDifficulty: normalizeNullableString(form.participationDifficulty),
      guideText: normalizeNullableString(form.guideText),
    }

    const tiers = form.tiers.length > 0 ? form.tiers : [makeEmptyTier()]
    const templates = tiers.map(tier => ({
      ...baseTemplate,
      benefitAmount: tier.benefitAmount ?? 0,
      benefitDescription: normalizeNullableString(tier.benefitDescription),
      minAmount: tier.minAmount,
      minCount: tier.minCount,
    }))

    return {
      templates,
      tierExclusive: tiers.length > 1 ? form.tierExclusive : null,
    } as BankTaskPayload
  }

  function validateForm() {
    if (!form.title.trim()) {
      return '请填写活动标题'
    }
    if (!form.bankId) {
      return '请选择银行'
    }
    if (!form.bankCardOrganization) {
      return '请选择银行卡组织'
    }
    if (!form.bankCardType) {
      return '请选择银行卡类型'
    }
    if (!form.regionCode.trim()) {
      return '请选择活动区域'
    }
    if (!form.regionMatchStrategy) {
      return '请选择区域匹配策略'
    }
    if (!form.repeatType) {
      return '请选择重复类型'
    }
    if (!form.reminderTime.trim()) {
      return '请填写提醒时间'
    }
    if (!form.startDate.trim()) {
      return '请填写开始时间'
    }
    if (!form.endDate.trim()) {
      return '请填写结束时间'
    }

    const startDate = new Date(form.startDate.replace(' ', 'T')).getTime()
    const endDate = new Date(form.endDate.replace(' ', 'T')).getTime()

    if (Number.isNaN(startDate) || Number.isNaN(endDate)) {
      return '开始时间或结束时间格式不正确'
    }
    if (startDate > endDate) {
      return '结束时间不能早于开始时间'
    }
    if (form.repeatType === 'WEEKLY' && form.daysOfWeek.length === 0) {
      return '请至少选择一个每周触发日'
    }
    if (form.repeatType === 'MONTHLY' && form.daysOfMonth.length === 0) {
      return '请至少选择一个每月触发日'
    }
    if (form.repeatType === 'YEARLY' && form.yearlyMonths.length === 0) {
      return '请至少选择一个每年触发月份'
    }
    if (form.repeatType === 'YEARLY' && form.yearlyDaysOfMonth.length === 0) {
      return '请至少选择一个每年触发日'
    }
    if (form.repeatType === 'YEARLY' && form.yearlyMonths.length !== form.yearlyDaysOfMonth.length) {
      return '每年触发月份和日期数量需要一一对应'
    }

    if (form.tiers.length === 0) {
      return '至少要配置一档优惠'
    }
    for (const [idx, tier] of form.tiers.entries()) {
      if (tier.benefitAmount == null) {
        return `第 ${idx + 1} 档的优惠金额必填`
      }
      if (!tier.benefitDescription.trim()) {
        return `第 ${idx + 1} 档的优惠描述必填`
      }
    }
    if (form.tiers.length > 1 && form.tierExclusive === null) {
      return '多档活动需要选择是否互斥取一'
    }

    return null
  }

  return {
    form,
    resetForm,
    fillForm,
    buildPayload,
    validateForm,
    cleanupRepeatFields,
  }
}
