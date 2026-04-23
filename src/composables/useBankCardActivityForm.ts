import type { Ref } from 'vue'
import type { BankTaskFormData, BankTaskPayload, SelectOption } from '@/types/bankCardActivities'

export interface BankTaskLikeData extends Omit<BankTaskPayload, 'benefitAmount'> {
  benefitAmount: number | null
  id?: number
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
    if (form.benefitAmount === null || Number.isNaN(form.benefitAmount)) {
      return '请填写预估收益'
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
