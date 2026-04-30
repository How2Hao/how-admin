<script setup lang="ts">
import type { BankTaskFormData, SelectOption } from '@/types/bankCardActivities'

defineProps<{
  bankSelectOptions: SelectOption[]
  bankCardTemplateSelectOptions: SelectOption[]
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
  searchRegions: [keyword: string]
  searchBenefitUsagePlatforms: [keyword: string]
  searchActivityCategories: [keyword: string]
  repeatTypeChange: []
}>()

const form = defineModel<BankTaskFormData>('form', { required: true })

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

const benefitAmountModel = computed({
  get: () => form.value.benefitAmount ?? undefined,
  set: (value) => {
    form.value.benefitAmount = typeof value === 'number' ? value : null
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

const qualifyDeadlineModel = computed({
  get: () => form.value.qualifyDeadline || undefined,
  set: (value) => {
    form.value.qualifyDeadline = typeof value === 'string' ? value : ''
  },
})

const qualifyCycleOptions = [
  { label: '本月达标本月用', value: 'SAME_MONTH' },
  { label: '上月达标本月用', value: 'PREV_MONTH' },
]

const tierModeOptions = [
  { label: '无分档（兼容旧）', value: 'NONE' },
  { label: '多档独立达成', value: 'INDEPENDENT' },
  { label: '多档互斥取一', value: 'EXCLUSIVE' },
]

function addTier() {
  form.value.tiers = [
    ...form.value.tiers,
    { minAmount: null, minCount: null, benefitAmount: null, benefitDescription: '' },
  ]
}

function removeTier(index: number) {
  form.value.tiers = form.value.tiers.filter((_, i) => i !== index)
}
</script>

<template>
  <t-form :data="form" label-align="left" label-width="84px" required-mark>
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
          @search="emit('searchBanks', $event)"
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
          @search="emit('searchBankCardTemplates', $event)"
        />
      </t-form-item>
      <t-form-item label="活动区域">
        <t-select
          v-model="form.regionCode"
          filterable
          clearable
          :options="regionSelectOptions"
          placeholder="搜索地区名称"
          @search="emit('searchRegions', $event)"
        />
      </t-form-item>
    </div>

    <div class="gap-4 grid md:grid-cols-2">
      <t-form-item label="区域匹配策略">
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
          @search="emit('searchBenefitUsagePlatforms', $event)"
        />
      </t-form-item>
      <t-form-item label="活动分类">
        <t-select
          v-model="activityCategoryIdModel"
          filterable
          clearable
          :options="activityCategorySelectOptions"
          placeholder="搜索活动分类"
          @search="emit('searchActivityCategories', $event)"
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

    <div class="border rounded p-3 mt-4 space-y-3">
      <div class="font-medium text-base">达标 / 报名 / 分档</div>

      <t-form-item label="是否需要先达标才能享受">
        <t-switch v-model="form.requiresQualify" />
      </t-form-item>

      <div v-if="form.requiresQualify" class="gap-4 grid md:grid-cols-2">
        <t-form-item label="达标周期">
          <t-radio-group v-model="form.qualifyCycle" :options="qualifyCycleOptions" />
        </t-form-item>
        <t-form-item label="档位模式">
          <t-radio-group v-model="form.tierMode" :options="tierModeOptions" />
        </t-form-item>
      </div>

      <t-form-item v-if="form.requiresQualify" label="达标截止时间">
        <t-date-picker
          v-model="qualifyDeadlineModel"
          enable-time-picker
          format="YYYY-MM-DD HH:mm:ss"
          value-type="YYYY-MM-DD HH:mm:ss"
          clearable
          placeholder="选填，仅展示用，例如本月 22 日 23:59"
        />
      </t-form-item>

      <t-form-item v-if="form.requiresQualify" label="档位">
        <div class="space-y-2 w-full">
          <div
            v-for="(tier, idx) in form.tiers"
            :key="idx"
            class="border rounded p-3 space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">档 {{ idx + 1 }}</span>
              <t-button theme="danger" variant="text" @click="removeTier(idx)">
                删除
              </t-button>
            </div>
            <div class="gap-2 grid md:grid-cols-2">
              <t-input-number
                v-model="tier.minAmount"
                :min="0"
                placeholder="累计金额门槛（无填空）"
                theme="normal"
              />
              <t-input-number
                v-model="tier.minCount"
                :min="0"
                placeholder="累计笔数门槛（无填空）"
                theme="normal"
              />
              <t-input-number
                v-model="tier.benefitAmount"
                :min="0"
                placeholder="优惠金额"
                theme="normal"
              />
              <t-input
                v-model="tier.benefitDescription"
                placeholder="例如：满 200 减 20"
              />
            </div>
          </div>
          <t-button @click="addTier">+ 新增一档</t-button>
        </div>
      </t-form-item>
    </div>

    <slot name="actions" />
  </t-form>
</template>
