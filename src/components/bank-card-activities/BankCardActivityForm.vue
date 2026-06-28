<script setup lang="ts">
import type { BankTaskFormData, BankTaskLinkedCouponForm, BankTaskTierForm, SelectOption } from '@/types/bankCardActivities'
import CouponPickerDialog from '@/components/bank-card-activities/CouponPickerDialog.vue'

const props = defineProps<{
  bankSelectOptions: SelectOption[]
  bankCardTemplateSelectOptions: SelectOption[]
  jobTemplateSelectOptions?: SelectOption[]
  regionSelectOptions: SelectOption[]
  benefitUsagePlatformSelectOptions: SelectOption[]
  activityCategorySelectOptions: SelectOption[]
  cardOrganizationOptions: SelectOption[]
  benefitCategoryOptions: SelectOption[]
  benefitPayPlatformOptions: SelectOption[]
  bankCardTypeOptions: SelectOption[]
  regionMatchStrategyOptions: SelectOption[]
  repeatTypeOptions: SelectOption[]
}>()

const emit = defineEmits<{
  searchBanks: [keyword: string]
  searchBankCardTemplates: [keyword: string]
  searchJobTemplates: [keyword: string]
  searchRegions: [keyword: string]
  searchBenefitUsagePlatforms: [keyword: string]
  searchActivityCategories: [keyword: string]
  repeatTypeChange: []
}>()

const form = defineModel<BankTaskFormData>('form', { required: true })

// 原始图片：URL（已上传）+ base64（新加未上传）双数组维护，UI 渲染时合并展示，删除时分别删
const ruleSourceImageInput = ref<HTMLInputElement | null>(null)
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}
async function handleRuleSourceImagesPick(files: FileList | File[] | null) {
  if (!files) return
  const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
  for (const f of arr) {
    try {
      const dataUrl = await fileToDataUrl(f)
      form.value.ruleSourceImageBase64s.push(dataUrl)
    }
    catch {
      // ignore single-file failure
    }
  }
}
function removeKeptImageUrl(idx: number) {
  form.value.ruleSourceImageUrls.splice(idx, 1)
}
function removeNewBase64(idx: number) {
  form.value.ruleSourceImageBase64s.splice(idx, 1)
}
function triggerRuleSourceImagePick() {
  ruleSourceImageInput.value?.click()
}

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

const startDateModel = computed({
  get: () => form.value.startDate || undefined,
  set: (value) => {
    form.value.startDate = typeof value === 'string' ? value : ''
  },
})

const endDateModel = computed({
  get: () => form.value.endDate || undefined,
  set: (value) => {
    form.value.endDate = typeof value === 'string' ? value : ''
  },
})

const reminderTimeModel = computed({
  get: () => form.value.reminderTime || undefined,
  set: (value) => {
    form.value.reminderTime = typeof value === 'string' ? value : ''
  },
})

const bankIdModel = computed({
  get: () => form.value.bankId ?? undefined,
  set: (value) => {
    form.value.bankId = typeof value === 'number' ? value : null
  },
})

const bankCardOrganizationModel = computed({
  get: () => form.value.bankCardOrganization ?? undefined,
  set: (value) => {
    form.value.bankCardOrganization = typeof value === 'number' ? value : null
  },
})

const bankCardTemplateIdModel = computed({
  get: () => form.value.bankCardTemplateId ?? undefined,
  set: (value) => {
    form.value.bankCardTemplateId = typeof value === 'number' ? value : null
  },
})

const jobTemplateIdModel = computed({
  get: () => form.value.jobTemplateId ?? undefined,
  set: (value) => {
    form.value.jobTemplateId = typeof value === 'number' ? value : null
  },
})

const benefitCategoryIdModel = computed({
  get: () => form.value.benefitCategoryId ?? undefined,
  set: (value) => {
    form.value.benefitCategoryId = typeof value === 'number' ? value : null
  },
})

const benefitPayPlatformIdModel = computed({
  get: () => form.value.benefitPayPlatformId ?? undefined,
  set: (value) => {
    form.value.benefitPayPlatformId = typeof value === 'number' ? value : null
  },
})

const benefitUsagePlatformIdModel = computed({
  get: () => form.value.benefitUsagePlatformId ?? undefined,
  set: (value) => {
    form.value.benefitUsagePlatformId = typeof value === 'number' ? value : null
  },
})

const activityCategoryIdModel = computed({
  get: () => form.value.activityCategoryId ?? undefined,
  set: (value) => {
    form.value.activityCategoryId = typeof value === 'number' ? value : null
  },
})

// Build 2-level grouped options for the category select.
// Groups children under their parent; standalone top-level categories appear ungrouped.
const categoryGroups = computed(() => {
  const opts = props.activityCategorySelectOptions
  const childrenByParentId = new Map<number, SelectOption[]>()
  const syntheticParents = new Map<number, { label: string, icon?: string | null }>()
  const topLevel: SelectOption[] = []

  for (const opt of opts) {
    if (opt.parentId) {
      const arr = childrenByParentId.get(opt.parentId) ?? []
      arr.push(opt)
      childrenByParentId.set(opt.parentId, arr)
      if (opt.parentName && !syntheticParents.has(opt.parentId))
        syntheticParents.set(opt.parentId, { label: opt.parentName, icon: opt.parentIcon })
    }
    else {
      topLevel.push(opt)
    }
  }

  const groups: { id: number | null, label: string, icon?: string | null, standalone: SelectOption | null, children: SelectOption[] }[] = []

  // Top-level categories
  const topLevelIds = new Set(topLevel.map(o => o.value as number))
  for (const parent of topLevel) {
    const children = childrenByParentId.get(parent.value as number) ?? []
    groups.push({ id: parent.value as number, label: parent.label, icon: parent.icon, standalone: children.length === 0 ? parent : null, children })
  }

  // Synthetic parents (from search results — parent not in results but children are)
  for (const [pid, sp] of syntheticParents) {
    if (!topLevelIds.has(pid)) {
      groups.push({ id: pid, label: sp.label, icon: sp.icon, standalone: null, children: childrenByParentId.get(pid) ?? [] })
    }
  }

  return groups
})

const tierExclusiveOptions = [
  { label: '互斥（取一档）', value: true },
  { label: '非互斥（可叠加）', value: false },
]

const tierExclusiveModel = computed({
  get: () => form.value.tierExclusive ?? undefined,
  set: (value) => {
    form.value.tierExclusive = typeof value === 'boolean' ? value : null
  },
})

/** 优惠金额输入模式：本地 UI 状态，跟 tier 数组一一对应；只有手动切换才变 */
const tierBenefitModes = ref<('fixed' | 'range')[]>([])

function inferModeFromTier(t: BankTaskTierForm | undefined): 'fixed' | 'range' {
  if (!t) return 'fixed'
  if (t.benefitAmountMin != null || t.benefitAmountMax != null) return 'range'
  return 'fixed'
}

watch(
  () => form.value.tiers,
  (tiers) => {
    // 同步长度；新加的 tier 用数据形态推断 mode；缩短时直接 pop
    while (tierBenefitModes.value.length < tiers.length) {
      const idx = tierBenefitModes.value.length
      tierBenefitModes.value.push(inferModeFromTier(tiers[idx]))
    }
    while (tierBenefitModes.value.length > tiers.length) {
      tierBenefitModes.value.pop()
    }
  },
  { immediate: true, deep: false },
)

function setBenefitMode(idx: number, mode: 'fixed' | 'range') {
  const tier = form.value.tiers[idx]
  if (!tier) return
  tierBenefitModes.value[idx] = mode
  if (mode === 'fixed') {
    tier.benefitAmountMin = null
    tier.benefitAmountMax = null
  }
  else {
    tier.benefitAmountFixed = null
  }
}

function addTier() {
  form.value.tiers = [
    ...form.value.tiers,
    {
      minAmount: null,
      benefitAmountFixed: null,
      benefitAmountMin: null,
      benefitAmountMax: null,
      benefitDescription: '',
      quotaPerCycleText: '',
      quotaTotalText: '',
    } as BankTaskTierForm,
  ]
  // 由单档变为多档时，默认填"互斥"，让用户后续可以改
  if (form.value.tiers.length === 2 && form.value.tierExclusive === null) {
    form.value.tierExclusive = true
  }
}

function removeTier(index: number) {
  form.value.tiers = form.value.tiers.filter((_, i) => i !== index)
  tierBenefitModes.value.splice(index, 1)
  if (form.value.tiers.length <= 1) {
    form.value.tierExclusive = null
  }
}

function updateTierNumber(idx: number, key: 'minAmount' | 'benefitAmountFixed' | 'benefitAmountMin' | 'benefitAmountMax', value: any) {
  const tier = form.value.tiers[idx]
  if (!tier) return
  tier[key] = typeof value === 'number' && Number.isFinite(value) ? value : null
}

// 关联卡券（仅 benefitCategoryId in [1, 2] 显示）
const COUPON_BENEFIT_CATEGORY_IDS = [1, 2] as const
const couponSectionVisible = computed(() =>
  form.value.benefitCategoryId != null
  && (COUPON_BENEFIT_CATEGORY_IDS as readonly number[]).includes(form.value.benefitCategoryId),
)
const couponPickerVisible = ref(false)
function openCouponPicker() {
  couponPickerVisible.value = true
}
function handleCouponPickerConfirm(picked: { couponId: number, couponName: string, couponLogoUrl: string | null }[]) {
  // 一次性追加多行；同 brand 可重复加（让用户配多个 SKU）
  const appended: BankTaskLinkedCouponForm[] = picked.map(p => ({
    couponId: p.couponId,
    couponName: p.couponName,
    couponLogoUrl: p.couponLogoUrl,
    sku: '',
    purchasePrice: null,
    actualValue: null,
  }))
  form.value.linkedCoupons = [...form.value.linkedCoupons, ...appended]
}
function removeLinkedCoupon(index: number) {
  form.value.linkedCoupons = form.value.linkedCoupons.filter((_, i) => i !== index)
}
</script>

<template>
  <t-form :data="form" label-align="left" label-width="72px" class="bca-form" required-mark>
    <!-- ========== 基本信息 ========== -->
    <section class="form-section">
      <h4 class="form-section-title">基本信息</h4>
      <div class="form-grid form-grid-3">
        <t-form-item class="col-span-2" label="活动标题">
          <t-input v-model="form.title" placeholder="请输入活动标题" clearable />
        </t-form-item>
        <t-form-item label="卡类型">
          <t-select v-model="form.bankCardType" :options="bankCardTypeOptions" />
        </t-form-item>
      </div>
      <div class="form-grid form-grid-3">
        <t-form-item label="银行">
          <t-select
            v-model="bankIdModel"
            filterable
            clearable
            placeholder="搜索银行名称"
            @search="emit('searchBanks', $event)"
          >
            <t-option
              v-for="opt in bankSelectOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <div class="flex items-center gap-1.5">
                <img v-if="opt.icon" :src="opt.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                <span>{{ opt.label }}</span>
              </div>
            </t-option>
          </t-select>
        </t-form-item>
        <t-form-item label="卡组织">
          <t-select v-model="bankCardOrganizationModel" :options="cardOrganizationOptions" />
        </t-form-item>
        <t-form-item label="卡模板">
          <t-select
            v-model="bankCardTemplateIdModel"
            filterable
            clearable
            :options="bankCardTemplateSelectOptions"
            placeholder="搜索"
            @search="emit('searchBankCardTemplates', $event)"
          />
        </t-form-item>
      </div>
      <div class="form-grid form-grid-3">
        <t-form-item class="col-span-2" label="Job模板">
          <t-select
            v-model="jobTemplateIdModel"
            filterable
            clearable
            :options="jobTemplateSelectOptions ?? []"
            placeholder="搜索 Job 模板标题、活动标题或 ID"
            @focus="emit('searchJobTemplates', '')"
            @search="emit('searchJobTemplates', $event)"
          />
        </t-form-item>
      </div>
    </section>

    <!-- ========== 适用范围 & 频次 ========== -->
    <section class="form-section">
      <h4 class="form-section-title">适用范围 / 频次</h4>
      <div class="form-grid form-grid-4">
        <t-form-item class="col-span-2" label="活动区域">
          <t-select
            v-model="form.regionCode"
            filterable
            clearable
            :options="regionSelectOptions"
            placeholder="搜索地区名称"
            @search="emit('searchRegions', $event)"
          />
        </t-form-item>
        <t-form-item label="区域策略">
          <t-select v-model="form.regionMatchStrategy" :options="regionMatchStrategyOptions" />
        </t-form-item>
        <t-form-item label="重复类型">
          <t-select
            v-model="form.repeatType"
            :options="repeatTypeOptions"
            @change="emit('repeatTypeChange')"
          />
        </t-form-item>
      </div>
      <div class="form-grid form-grid-3">
        <t-form-item label="提醒时间">
          <t-time-picker
            v-model="reminderTimeModel"
            format="HH:mm"
            clearable
            placeholder="默认全天"
          />
        </t-form-item>
        <t-form-item label="频控">
          <t-input v-model="form.frequencyControl" clearable placeholder="如 每日 1 次" />
        </t-form-item>
        <t-form-item label="难度">
          <t-input v-model="form.participationDifficulty" clearable placeholder="简单 / 中等 / 复杂" />
        </t-form-item>
      </div>
      <div class="form-grid form-grid-2">
        <t-form-item label="开始时间">
          <t-date-picker
            v-model="startDateModel"
            enable-time-picker
            format="YYYY-MM-DD HH:mm:ss"
            value-type="YYYY-MM-DD HH:mm:ss"
            clearable
            placeholder="请选择"
          />
        </t-form-item>
        <t-form-item label="结束时间">
          <t-date-picker
            v-model="endDateModel"
            enable-time-picker
            format="YYYY-MM-DD HH:mm:ss"
            value-type="YYYY-MM-DD HH:mm:ss"
            clearable
            placeholder="请选择"
          />
        </t-form-item>
      </div>
      <t-form-item v-if="form.repeatType === 'WEEKLY'" label="每周触发">
        <t-checkbox-group v-model="form.daysOfWeek" :options="weekOptions" />
      </t-form-item>
      <t-form-item v-if="form.repeatType === 'MONTHLY'" label="每月触发">
        <t-checkbox-group v-model="form.daysOfMonth" :options="monthDayOptions" />
      </t-form-item>
      <div v-if="form.repeatType === 'YEARLY'" class="form-grid form-grid-2">
        <t-form-item label="触发月份">
          <t-checkbox-group v-model="form.yearlyMonths" :options="monthOptions" />
        </t-form-item>
        <t-form-item label="触发日">
          <t-checkbox-group v-model="form.yearlyDaysOfMonth" :options="monthDayOptions" />
        </t-form-item>
      </div>
    </section>

    <!-- ========== 优惠分类 ========== -->
    <section class="form-section">
      <h4 class="form-section-title">分类标签</h4>
      <div class="form-grid form-grid-4">
        <t-form-item label="优惠分类">
          <t-select v-model="benefitCategoryIdModel" clearable filterable>
            <t-option
              v-for="opt in benefitCategoryOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <div class="flex items-center gap-1.5">
                <img v-if="opt.icon" :src="opt.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                <span>{{ opt.label }}</span>
              </div>
            </t-option>
          </t-select>
        </t-form-item>
        <t-form-item label="支付平台">
          <t-select v-model="benefitPayPlatformIdModel" clearable filterable>
            <t-option
              v-for="opt in benefitPayPlatformOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <div class="flex items-center gap-1.5">
                <img v-if="opt.icon" :src="opt.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                <span>{{ opt.label }}</span>
              </div>
            </t-option>
          </t-select>
        </t-form-item>
        <t-form-item label="使用平台">
          <t-select v-model="benefitUsagePlatformIdModel" clearable filterable placeholder="选择">
            <t-option
              v-for="opt in benefitUsagePlatformSelectOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <div class="flex items-center gap-1.5">
                <img v-if="opt.icon" :src="opt.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                <span>{{ opt.label }}</span>
              </div>
            </t-option>
          </t-select>
        </t-form-item>
        <t-form-item label="活动分类">
          <t-select v-model="activityCategoryIdModel" clearable filterable placeholder="选择">
            <template v-for="group in categoryGroups" :key="group.id">
              <t-option
                v-if="group.standalone"
                :value="group.standalone.value"
                :label="group.standalone.label"
              >
                <div class="flex items-center gap-1.5">
                  <img v-if="group.standalone.icon" :src="group.standalone.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                  <span>{{ group.standalone.label }}</span>
                </div>
              </t-option>
              <t-option-group v-else :label="group.label">
                <t-option :value="group.id!" :label="group.label">
                  <div class="flex items-center gap-1.5 pl-1">
                    <img v-if="group.icon" :src="group.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                    <span>{{ group.label }}</span>
                    <span class="text-xs text-gray-400 ml-0.5">综合</span>
                  </div>
                </t-option>
                <t-option
                  v-for="child in group.children"
                  :key="child.value"
                  :value="child.value"
                  :label="`${group.label} › ${child.label}`"
                >
                  <div class="flex items-center gap-1.5 pl-1">
                    <img v-if="child.icon" :src="child.icon" class="w-4 h-4 object-contain rounded-sm flex-shrink-0">
                    <span>{{ child.label }}</span>
                  </div>
                </t-option>
              </t-option-group>
            </template>
          </t-select>
        </t-form-item>
      </div>
    </section>

    <!-- ========== 关联卡券（仅 benefitCategoryId 为 会员充值/电子卡券 显示） ========== -->
    <section v-if="couponSectionVisible" class="form-section">
      <div class="flex items-center justify-between mb-3">
        <h4 class="form-section-title" style="margin: 0; padding: 0; border: none;">
          关联卡券
          <span class="ml-2 text-xs text-gray-400 font-normal">同品牌多 SKU 请添加多行</span>
        </h4>
        <t-button size="small" variant="outline" @click="openCouponPicker">+ 添加卡券</t-button>
      </div>

      <div v-if="form.linkedCoupons.length === 0" class="text-xs text-gray-400 py-3 text-center border border-dashed rounded">
        暂未关联卡券，点右上角「+ 添加卡券」选择品牌
      </div>
      <table v-else class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left text-xs text-gray-500 bg-gray-50">
            <th class="px-2 py-2 font-medium" style="width: 30%;">品牌</th>
            <th class="px-2 py-2 font-medium" style="width: 22%;">SKU</th>
            <th class="px-2 py-2 font-medium" style="width: 18%;">购买价（元）</th>
            <th class="px-2 py-2 font-medium" style="width: 18%;">实际价值（元）</th>
            <th class="px-2 py-2 font-medium" style="width: 60px;" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in form.linkedCoupons" :key="`${row.couponId}-${idx}`" class="border-t border-gray-100">
            <td class="px-2 py-2">
              <div class="flex items-center gap-2">
                <img v-if="row.couponLogoUrl" :src="row.couponLogoUrl" class="w-6 h-6 object-contain rounded flex-shrink-0">
                <div v-else class="w-6 h-6 bg-gray-100 rounded flex-shrink-0" />
                <span>{{ row.couponName }}</span>
              </div>
            </td>
            <td class="px-2 py-2">
              <t-input v-model="row.sku" placeholder="如 20元券 / 月卡 / 季卡" :maxlength="64" />
            </td>
            <td class="px-2 py-2">
              <t-input-number
                :value="row.purchasePrice ?? undefined"
                :min="0"
                :decimal-places="2"
                placeholder="留空 = 待录入"
                theme="column"
                @update:value="(v: any) => row.purchasePrice = (typeof v === 'number' && Number.isFinite(v)) ? v : null"
              />
            </td>
            <td class="px-2 py-2">
              <t-input-number
                :value="row.actualValue ?? undefined"
                :min="0"
                :decimal-places="2"
                placeholder="留空 = 待录入"
                theme="column"
                @update:value="(v: any) => row.actualValue = (typeof v === 'number' && Number.isFinite(v)) ? v : null"
              />
            </td>
            <td class="px-2 py-2 text-center">
              <t-button size="small" variant="text" theme="danger" @click="removeLinkedCoupon(idx)">移除</t-button>
            </td>
          </tr>
        </tbody>
      </table>

      <CouponPickerDialog
        v-model:visible="couponPickerVisible"
        @confirm="handleCouponPickerConfirm"
      />
    </section>

    <!-- ========== 文案 / 规则 ========== -->
    <section class="form-section">
      <h4 class="form-section-title">文案 / 规则</h4>
      <t-form-item label="活动简述">
        <t-textarea v-model="form.ruleBrief" :autosize="{ minRows: 2, maxRows: 4 }" />
      </t-form-item>
      <t-form-item label="活动细则">
        <t-textarea v-model="form.ruleDetail" :autosize="{ minRows: 3, maxRows: 8 }" />
      </t-form-item>
      <t-form-item label="附加条件">
        <t-textarea v-model="form.extraConditionsText" :autosize="{ minRows: 2, maxRows: 6 }" />
      </t-form-item>
      <t-form-item label="操作指引">
        <t-textarea v-model="form.guideText" :autosize="{ minRows: 2, maxRows: 6 }" />
      </t-form-item>
      <t-form-item label="原文链接">
        <t-input v-model="form.ruleSourceLinkUrl" clearable placeholder="https://... / 银行官网公告 URL" />
      </t-form-item>
      <t-form-item label="原始图片">
        <div class="w-full">
          <div class="flex flex-wrap gap-2">
            <!-- 已上传 URL（编辑回显） -->
            <div v-for="(u, idx) in form.ruleSourceImageUrls" :key="`url-${idx}`" class="relative">
              <img :src="u" class="h-16 w-16 object-cover rounded border" alt="原图" >
              <button
                type="button"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none hover:bg-red-600"
                @click="removeKeptImageUrl(idx)"
              >×</button>
            </div>
            <!-- 新加 base64（保存后才上传） -->
            <div v-for="(b64, idx) in form.ruleSourceImageBase64s" :key="`b64-${idx}`" class="relative">
              <img :src="b64" class="h-16 w-16 object-cover rounded border ring-1 ring-amber-300" alt="新加" title="待保存上传" >
              <button
                type="button"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none hover:bg-red-600"
                @click="removeNewBase64(idx)"
              >×</button>
            </div>
            <button
              type="button"
              class="h-16 w-16 border-2 border-dashed rounded text-2xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              @click="triggerRuleSourceImagePick"
            >+</button>
            <input
              ref="ruleSourceImageInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="(e) => handleRuleSourceImagesPick((e.target as HTMLInputElement).files)"
            >
          </div>
          <div class="mt-1 text-xs text-gray-400">保存时一并上传到 OSS（黄色高亮 = 待上传）</div>
        </div>
      </t-form-item>
    </section>

    <div class="tier-section">
      <div class="tier-header">
        <h4 class="form-section-title" style="margin: 0; padding: 0; border: none;">档位</h4>
        <t-button size="small" variant="outline" @click="addTier">+ 新增一档</t-button>
      </div>

      <div v-if="form.tiers.length > 1" class="tier-relation-row">
        <span class="tier-relation-label">多档关系</span>
        <t-radio-group v-model="tierExclusiveModel" :options="tierExclusiveOptions" size="small" />
        <span v-if="form.tierExclusive === true" class="tier-relation-hint">
          创建 1 个任务模板，{{ form.tiers.length }} 档作为同行可选项
        </span>
        <span v-else-if="form.tierExclusive === false" class="tier-relation-hint">
          创建 {{ form.tiers.length }} 个任务模板，自动分配同一 groupId 聚合为一张卡片
        </span>
        <span v-else class="tier-relation-hint tier-relation-hint--warn">请选择互斥/非互斥</span>
      </div>

      <div class="tier-table-wrap">
        <table class="tier-table">
          <thead>
            <tr>
              <th class="tier-col-idx">#</th>
              <th class="tier-col-min">达标金额</th>
              <th class="tier-col-type">优惠类型</th>
              <th class="tier-col-amount">优惠金额</th>
              <th class="tier-col-desc">优惠文案</th>
              <th class="tier-col-quota">周期名额</th>
              <th class="tier-col-quota">总名额</th>
              <th class="tier-col-op"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(tier, idx) in form.tiers" :key="idx">
              <td class="tier-col-idx">{{ idx + 1 }}</td>
              <td>
                <t-input-number
                  :value="tier.minAmount ?? undefined"
                  :min="0"
                  placeholder="无门槛"
                  theme="normal"
                  size="small"
                  @update:value="(v: any) => updateTierNumber(idx, 'minAmount', v)"
                />
              </td>
              <td>
                <t-radio-group
                  :value="tierBenefitModes[idx]"
                  size="small"
                  @change="(v: any) => setBenefitMode(idx, v)"
                >
                  <t-radio-button value="fixed">固定</t-radio-button>
                  <t-radio-button value="range">区间</t-radio-button>
                </t-radio-group>
              </td>
              <td>
                <t-input-number
                  v-if="tierBenefitModes[idx] === 'fixed'"
                  :value="tier.benefitAmountFixed ?? undefined"
                  :min="0"
                  placeholder="例如 50"
                  theme="normal"
                  size="small"
                  @update:value="(v: any) => updateTierNumber(idx, 'benefitAmountFixed', v)"
                />
                <div v-else class="tier-range">
                  <t-input-number
                    :value="tier.benefitAmountMin ?? undefined"
                    :min="0"
                    placeholder="下限"
                    theme="normal"
                    size="small"
                    @update:value="(v: any) => updateTierNumber(idx, 'benefitAmountMin', v)"
                  />
                  <span class="tier-range-sep">~</span>
                  <t-input-number
                    :value="tier.benefitAmountMax ?? undefined"
                    :min="0"
                    placeholder="上限"
                    theme="normal"
                    size="small"
                    @update:value="(v: any) => updateTierNumber(idx, 'benefitAmountMax', v)"
                  />
                </div>
              </td>
              <td>
                <t-input
                  v-model="tier.benefitDescription"
                  size="small"
                  placeholder="满 200 减 20"
                />
              </td>
              <td>
                <t-input
                  v-model="tier.quotaPerCycleText"
                  size="small"
                  clearable
                  placeholder="每日 100 名"
                />
              </td>
              <td>
                <t-input
                  v-model="tier.quotaTotalText"
                  size="small"
                  clearable
                  placeholder="总共 1000 名"
                />
              </td>
              <td class="tier-col-op">
                <t-button
                  v-if="form.tiers.length > 1"
                  size="small"
                  theme="danger"
                  variant="text"
                  @click="removeTier(idx)"
                >
                  删除
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <slot name="actions" />
  </t-form>
</template>

<style scoped>
/* ===== 整体表单：紧凑分区布局 ===== */
.bca-form {
  font-size: 13px;
}
.bca-form :deep(.t-form__item) {
  margin-bottom: 10px;
}
.bca-form :deep(.t-form__label) {
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
}

.form-section {
  border: 1px solid var(--td-component-border, #e7e7e7);
  border-radius: 6px;
  padding: 12px 14px 4px;
  margin-bottom: 12px;
  background: var(--td-bg-color-container, #fff);
}
.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-primary, #1f2937);
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--td-component-border, #e7e7e7);
  display: flex;
  align-items: center;
  gap: 6px;
}
.form-section-title::before {
  content: '';
  width: 3px;
  height: 12px;
  background: var(--td-brand-color, #0052d9);
  border-radius: 2px;
}

.form-grid {
  display: grid;
  gap: 0 14px;
}
.form-grid-2 { grid-template-columns: repeat(2, 1fr); }
.form-grid-3 { grid-template-columns: repeat(3, 1fr); }
.form-grid-4 { grid-template-columns: repeat(4, 1fr); }
.col-span-2 { grid-column: span 2 / span 2; }
@media (max-width: 720px) {
  .form-grid-3, .form-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .col-span-2 { grid-column: span 2 / span 2; }
}

.tier-section {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--td-component-border, #e7e7e7);
  border-radius: 6px;
  background: var(--td-bg-color-container, #fafafa);
}
.tier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.tier-header-title {
  font-weight: 500;
  font-size: 14px;
  color: var(--td-text-color-primary, #333);
}
.tier-relation-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: var(--td-bg-color-page, #fff);
  border-radius: 4px;
}
.tier-relation-label {
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
}
.tier-relation-hint {
  font-size: 12px;
  color: var(--td-warning-color, #d4691f);
  margin-left: auto;
}
.tier-relation-hint--warn {
  color: var(--td-error-color, #d54941);
}
.tier-table-wrap {
  width: 100%;
  overflow-x: auto;
  background: var(--td-bg-color-page, #fff);
  border-radius: 4px;
}
.tier-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  table-layout: fixed;
}
.tier-table th,
.tier-table td {
  padding: 6px 8px;
  vertical-align: middle;
  border-bottom: 1px solid var(--td-component-border, #f0f0f0);
}
.tier-table th {
  font-weight: 500;
  font-size: 11px;
  color: var(--td-text-color-secondary, #666);
  text-align: left;
  background: var(--td-bg-color-secondarycontainer, #f5f5f5);
  white-space: nowrap;
}
.tier-table tbody tr:last-child td {
  border-bottom: none;
}
.tier-col-idx {
  width: 32px;
  text-align: center;
  color: var(--td-text-color-secondary, #666);
}
.tier-col-min { width: 110px; }
.tier-col-type { width: 130px; }
.tier-col-amount { width: 180px; }
.tier-col-desc { min-width: 160px; }
.tier-col-quota { width: 130px; }
.tier-col-op { width: 56px; text-align: center; }
.tier-range {
  display: flex;
  align-items: center;
  gap: 4px;
}
.tier-range-sep {
  color: var(--td-text-color-placeholder, #999);
  flex-shrink: 0;
}
.tier-range :deep(.t-input-number) {
  min-width: 0;
  flex: 1;
}
</style>
