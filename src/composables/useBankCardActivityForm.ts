import type { Ref } from 'vue'
import type { BankTaskFormData, BankTaskLinkedCouponForm, BankTaskPayload, BankTaskTierForm, SelectOption } from '@/types/bankCardActivities'

/** AI 解析或后端返回的"模板组"形态，用于 fillForm */
export interface BankTaskLikeTier {
  minAmount: number | null
  benefitAmountFixed: number | null
  benefitAmountMin: number | null
  benefitAmountMax: number | null
  benefitDescription: string | null
  quotaPerCycleText: string | null
  quotaTotalText: string | null
}

export interface BankTaskLikeTemplate {
  title: string
  ruleBrief: string | null
  ruleDetail: string | null
  bankId: number
  bankCardOrganization?: number | null
  bankCardTemplateId: number | null
  bankCardType: 'CREDIT' | 'DEBIT'
  regionCode?: string
  regionMatchStrategy?: 'EXACT' | 'EXCLUDE_PLAN_SINGLE_CITY'
  repeatType: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  daysOfWeek: number[] | null
  yearlyMonths: number[] | null
  daysOfMonth: number[] | null
  yearlyDaysOfMonth: number[] | null
  frequencyControl: string | null
  reminderTime: string | null
  startDate: string
  endDate: string
  extraConditionsText: string | null
  ruleSourceLinkUrl?: string | null
  ruleSourceImageUrls?: string[] | null
  benefitCategoryId: number | null
  benefitPayPlatformId: number | null
  benefitUsagePlatformId: number | null
  activityCategoryId: number | null
  participationDifficulty: string | null
  guideText: string | null
  tiers: BankTaskLikeTier[]
  groupId?: number | null
  /** 编辑回显时由 server 透传：每条 linkedCoupon 的 couponId / sku / 价格 / 价值；name + logoUrl 通过 couponCategoryMap 现查现拼 */
  linkedCoupons?: Array<{
    couponId: number
    purchasePrice: number | null
    sku: string | null
    actualValue: number | null
  }> | null
}

export interface BankTaskLikeData {
  templates: BankTaskLikeTemplate[]
  /** 多档互斥标识；AI 解析时由 prompt 输出，编辑回显时由后端按数据形态推断 */
  tierExclusive?: boolean | null
  id?: number
}

function makeEmptyTier(): BankTaskTierForm {
  return {
    minAmount: null,
    benefitAmountFixed: null,
    benefitAmountMin: null,
    benefitAmountMax: null,
    benefitDescription: '',
    quotaPerCycleText: '',
    quotaTotalText: '',
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
    reminderTime: '',
    startDate: '',
    endDate: '',
    extraConditionsText: '',
    ruleSourceLinkUrl: '',
    ruleSourceImageUrls: [],
    ruleSourceImageBase64s: [],
    benefitCategoryId: null,
    benefitPayPlatformId: null,
    benefitUsagePlatformId: null,
    activityCategoryId: null,
    participationDifficulty: '',
    guideText: '',
    tiers: [makeEmptyTier()],
    tierExclusive: null,
    groupId: null,
    linkedCoupons: [],
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

/**
 * 关联卡券提交载荷：
 * - 仅 benefitCategoryId in (1, 2) 时下发；其它分类一律 null（避免数据脏到非电子卡券类目）
 * - 字段策略：couponId 必填；sku 空字符串视为 null；purchasePrice / actualValue 留 null 表示待录入
 */
function buildLinkedCouponsPayload(
  rows: BankTaskLinkedCouponForm[],
  benefitCategoryId: number | null,
): Array<{ couponId: number; purchasePrice: number | null; sku: string | null; actualValue: number | null }> | null {
  if (benefitCategoryId !== 1 && benefitCategoryId !== 2) return null
  const cleaned = rows
    .filter(r => Number.isFinite(r.couponId) && r.couponId > 0)
    .map(r => ({
      couponId: r.couponId,
      purchasePrice: r.purchasePrice ?? null,
      sku: r.sku?.trim() ? r.sku.trim() : null,
      actualValue: r.actualValue ?? null,
    }))
  return cleaned.length > 0 ? cleaned : null
}

function normalizeTierFromLike(tier: BankTaskLikeTier): BankTaskTierForm {
  return {
    minAmount: tier.minAmount ?? null,
    benefitAmountFixed: tier.benefitAmountFixed ?? null,
    benefitAmountMin: tier.benefitAmountMin ?? null,
    benefitAmountMax: tier.benefitAmountMax ?? null,
    benefitDescription: tier.benefitDescription ?? '',
    quotaPerCycleText: tier.quotaPerCycleText ?? '',
    quotaTotalText: tier.quotaTotalText ?? '',
  }
}

/** 把 server 透传的 linkedCoupons（仅 couponId + 配置项）+ couponLookup（id → {name, logoUrl}）合并为 form 行 */
function normalizeLinkedCouponsFromLike(
  raw: { couponId: number; purchasePrice: number | null; sku: string | null; actualValue: number | null }[] | null | undefined,
  couponLookup: Map<number, { name: string; logoUrl: string | null }>,
): BankTaskLinkedCouponForm[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c): BankTaskLinkedCouponForm | null => {
      const couponId = Number(c?.couponId)
      if (!Number.isFinite(couponId) || couponId <= 0) return null
      const meta = couponLookup.get(couponId)
      return {
        couponId,
        couponName: meta?.name ?? `#${couponId}`,
        couponLogoUrl: meta?.logoUrl ?? null,
        sku: c.sku ?? '',
        purchasePrice: c.purchasePrice ?? null,
        actualValue: c.actualValue ?? null,
      }
    })
    .filter((x): x is BankTaskLinkedCouponForm => x !== null)
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

  function fillForm(
    payload: BankTaskLikeData,
    couponLookup: Map<number, { name: string; logoUrl: string | null }> = new Map(),
  ) {
    if (!payload.templates || payload.templates.length === 0) {
      resetForm()
      return
    }
    // 表单始终承载"一组档位"：
    // - AI 单档 → 1 个 template，1 个 tier
    // - AI 互斥多档 → 1 个 template，多个 tier
    // - AI 非互斥多档 → 多个 template，每个 1 tier；这里把多个 template 的 tier 合并到 form.tiers
    //   共享字段取 templates[0]，由 tierExclusive=false 在保存时触发后端 fan-out
    const head = payload.templates[0]
    const isMultiTemplate = payload.templates.length > 1
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
    form.reminderTime = head.reminderTime ?? ''
    form.startDate = head.startDate
    form.endDate = head.endDate
    form.extraConditionsText = head.extraConditionsText ?? ''
    form.ruleSourceLinkUrl = head.ruleSourceLinkUrl ?? ''
    // 编辑回显时，已上传 URL 进入 ruleSourceImageUrls；新一轮编辑用户增删都不动这数组的现有项
    form.ruleSourceImageUrls = (head as { ruleSourceImageUrls?: string[] | null }).ruleSourceImageUrls ?? []
    // base64 数组保持空，让用户新加的图独立累积；保存后才会跟 URL 列表合并
    form.ruleSourceImageBase64s = []
    form.benefitCategoryId = head.benefitCategoryId
    form.benefitPayPlatformId = head.benefitPayPlatformId
    form.benefitUsagePlatformId = head.benefitUsagePlatformId
    form.activityCategoryId = head.activityCategoryId
    form.participationDifficulty = head.participationDifficulty ?? ''
    form.guideText = head.guideText ?? ''
    form.groupId = head.groupId ?? null
    form.linkedCoupons = normalizeLinkedCouponsFromLike(head.linkedCoupons, couponLookup)

    // 合并 tier：非互斥多 template 时把每条 template 的 tiers[0] 串起来
    if (isMultiTemplate) {
      const merged: BankTaskTierForm[] = []
      for (const tpl of payload.templates) {
        if (Array.isArray(tpl.tiers) && tpl.tiers.length > 0) {
          merged.push(normalizeTierFromLike(tpl.tiers[0]))
        }
      }
      form.tiers = merged.length > 0 ? merged : [makeEmptyTier()]
    }
    else {
      form.tiers = (Array.isArray(head.tiers) && head.tiers.length > 0)
        ? head.tiers.map(normalizeTierFromLike)
        : [makeEmptyTier()]
    }

    // tierExclusive 优先用 payload 顶层 AI 输出；回退按数据形态推断
    if (payload.tierExclusive !== undefined) {
      form.tierExclusive = payload.tierExclusive
    }
    else if (form.tiers.length <= 1) {
      form.tierExclusive = null
    }
    else {
      form.tierExclusive = isMultiTemplate ? false : true
    }

    cleanupRepeatFields()
  }

  function buildPayload(): BankTaskPayload {
    cleanupRepeatFields()

    const tiers = form.tiers.length > 0 ? form.tiers : [makeEmptyTier()]
    const tiersPayload = tiers.map(tier => ({
      minAmount: tier.minAmount,
      benefitAmountFixed: tier.benefitAmountFixed,
      benefitAmountMin: tier.benefitAmountMin,
      benefitAmountMax: tier.benefitAmountMax,
      benefitDescription: normalizeNullableString(tier.benefitDescription),
      quotaPerCycleText: normalizeNullableString(tier.quotaPerCycleText),
      quotaTotalText: normalizeNullableString(tier.quotaTotalText),
    }))

    const template = {
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
      reminderTime: form.reminderTime?.trim() || null,
      startDate: form.startDate.trim(),
      endDate: form.endDate.trim(),
      extraConditionsText: normalizeNullableString(form.extraConditionsText),
      ruleSourceLinkUrl: normalizeNullableString(form.ruleSourceLinkUrl),
      // 图片：保留 URL + 新加 base64 一并传给 server，由 server 端 commit helper 实际处理
      ruleSourceImageUrls: form.ruleSourceImageUrls.length > 0 ? form.ruleSourceImageUrls : null,
      ruleSourceImageBase64s: form.ruleSourceImageBase64s.length > 0 ? form.ruleSourceImageBase64s : null,
      benefitCategoryId: form.benefitCategoryId,
      benefitPayPlatformId: form.benefitPayPlatformId,
      benefitUsagePlatformId: form.benefitUsagePlatformId,
      activityCategoryId: form.activityCategoryId,
      participationDifficulty: normalizeNullableString(form.participationDifficulty),
      guideText: normalizeNullableString(form.guideText),
      tiers: tiersPayload,
      tierExclusive: tiers.length > 1 ? form.tierExclusive : null,
      groupId: form.groupId,
      linkedCoupons: buildLinkedCouponsPayload(form.linkedCoupons, form.benefitCategoryId),
    }

    return template as unknown as BankTaskPayload
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
    if (form.tiers.length > 1 && form.tierExclusive === null) {
      return '多档活动需要选择"互斥"或"非互斥"'
    }
    for (const [idx, tier] of form.tiers.entries()) {
      const hasFixed = tier.benefitAmountFixed != null
      const hasMin = tier.benefitAmountMin != null
      const hasMax = tier.benefitAmountMax != null
      if (!hasFixed && !hasMin && !hasMax) {
        return `第 ${idx + 1} 档的优惠金额必填（固定或区间二选一；区间至少填一端）`
      }
      if (hasFixed && (hasMin || hasMax)) {
        return `第 ${idx + 1} 档的优惠金额：固定金额与区间金额不能同时填写`
      }
      if (hasMin && hasMax && tier.benefitAmountMin! > tier.benefitAmountMax!) {
        return `第 ${idx + 1} 档的区间优惠下限不能高于上限`
      }
      if (!tier.benefitDescription.trim()) {
        return `第 ${idx + 1} 档的优惠描述必填`
      }
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
