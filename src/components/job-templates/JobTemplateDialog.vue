<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { REPEAT_TYPE_OPTIONS, type JobRewardWindowRule, type JobTemplateRow, type JobTemplateTier } from '@/types/jobTemplates'

const props = defineProps<{ visible: boolean, jobId: number | null }>()
const emit = defineEmits<{ 'update:visible': [boolean], 'saved': [] }>()

const LOGIC_OPTIONS = [{ label: '且', value: 'AND' }, { label: '或', value: 'OR' }]
const REWARD_WINDOW_MODE_OPTIONS = [
  { label: '下个月', value: 'NEXT_MONTH' },
  { label: '下周', value: 'NEXT_WEEK' },
  { label: '完成后 N 天内', value: 'AFTER_COMPLETION_DAYS' },
  { label: '固定日期范围', value: 'FIXED' },
] as const
const WEEK_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]
const MONTH_END_OPTIONS = [
  { label: '自然月最后一天', value: 'LAST_DAY' },
  { label: '指定日期', value: 'CUSTOM' },
]

type RewardWindowMode = JobRewardWindowRule['mode']
interface SelectOption {
  label: string
  value: number | string
  bankName?: string | null
  kind?: string
  repeatType?: string
  taskTemplateTitle?: string | null
}

const activityOptions = ref<SelectOption[]>([])
const reminderOptions = ref<SelectOption[]>([])
const monthEndMode = ref<'LAST_DAY' | 'CUSTOM'>('LAST_DAY')

async function searchActivities(q: string) {
  if (!q.trim()) {
    activityOptions.value = []
    return
  }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/jobTemplates/searchActivities?q=${encodeURIComponent(q)}`)
    activityOptions.value = res.options
  }
  catch {}
}

async function searchReminderTemplates(q = '') {
  try {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    const query = params.toString()
    const res = await requestJson<{ options: SelectOption[] }>(`/api/reminderTemplates/search${query ? `?${query}` : ''}`)
    reminderOptions.value = res.options
  }
  catch {}
}

function emptyTier(): JobTemplateTier {
  return { minAmount: null, minCount: null, logic: 'AND', description: null }
}

function defaultRewardWindowRule(): JobRewardWindowRule {
  return { mode: 'NEXT_MONTH', startDay: 1, endDay: 'LAST_DAY' }
}

const form = reactive({
  title: '',
  description: null as string | null,
  repeatType: 'MONTHLY' as JobTemplateRow['repeatType'],
  date: null as number | null,
  startDate: null as number | null,
  endDate: null as number | null,
  daysOfWeek: [] as number[],
  daysOfMonth: '',
  yearlyMonths: '',
  yearlyDaysOfMonth: '',
  tiers: [emptyTier()] as JobTemplateTier[],
  taskTemplateId: null as number | null,
  reminderTemplateId: null as number | null,
  rewardWindowRule: defaultRewardWindowRule(),
  rewardDescription: null as string | null,
  isVisible: false,
})
const saving = ref(false)

const descriptionModel = computed({
  get: () => form.description ?? '',
  set: (v) => {
    const text = typeof v === 'string' ? v : String(v ?? '')
    form.description = text.trim() ? text : null
  },
})
const rewardDescriptionModel = computed({
  get: () => form.rewardDescription ?? '',
  set: (v) => {
    const text = typeof v === 'string' ? v : String(v ?? '')
    form.rewardDescription = text.trim() ? text : null
  },
})
const cycleHelpText = computed(() => {
  if (form.repeatType === 'WEEKLY') return '每一期 job 是一个自然周；周内限定日为空时，表示整周都可以累计进度。'
  if (form.repeatType === 'MONTHLY') return '每一期 job 是一个自然月；每月统计日为空时，表示整月都可以累计进度。'
  if (form.repeatType === 'DAILY') return '每一期 job 是一个自然日，适合每天达标、次日可参与的活动。'
  if (form.repeatType === 'YEARLY') return '每一期 job 是一个年度周期；仅在确有年度活动时使用。'
  return '一次性 job 只生成一个达标周期，适合固定活动期内完成一次。'
})
const targetPeriodHelpText = computed(() => {
  if (form.rewardWindowRule.mode === 'NEXT_MONTH') return '达标后只从下一自然月里展开提醒模板，例如本月达标后生成下个月每周五 09:00 的 one-time task。'
  if (form.rewardWindowRule.mode === 'NEXT_WEEK') return '达标后只从下一自然周里展开提醒模板，例如本周达标后生成下周三 10:00 的 one-time task。'
  if (form.rewardWindowRule.mode === 'AFTER_COMPLETION_DAYS') return '达标后按完成时间偏移出一个目标范围，再从这个范围内展开提醒模板。'
  return '达标后只从固定日期范围内展开提醒模板，适合活动权益窗口不随 job 周期滚动的场景。'
})

function parseNumberList(raw: string | null | undefined) {
  const text = raw?.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed))
      return parsed.map(item => Number(item)).filter(item => Number.isInteger(item))
  }
  catch {}
  return text
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(item => Number(item.replace(/"/g, '').trim()))
    .filter(item => Number.isInteger(item))
}

function stringifyNumberList(list: number[]) {
  return list.join(',')
}

function reset() {
  form.title = ''
  form.description = null
  form.repeatType = 'MONTHLY'
  form.date = null
  form.startDate = null
  form.endDate = null
  form.daysOfWeek = []
  form.daysOfMonth = ''
  form.yearlyMonths = ''
  form.yearlyDaysOfMonth = ''
  form.tiers = [emptyTier()]
  form.taskTemplateId = null
  form.reminderTemplateId = null
  form.rewardWindowRule = defaultRewardWindowRule()
  form.rewardDescription = null
  form.isVisible = false
  monthEndMode.value = 'LAST_DAY'
  activityOptions.value = []
  reminderOptions.value = []
}

async function loadDetail(id: number) {
  try {
    const row = await requestJson<JobTemplateRow>(`/api/jobTemplates/${id}`)
    form.title = row.title
    form.description = row.description
    form.repeatType = row.repeatType
    form.date = row.date
    form.startDate = row.startDate
    form.endDate = row.endDate
    form.daysOfWeek = parseNumberList(row.daysOfWeek)
    form.daysOfMonth = row.daysOfMonth ?? ''
    form.yearlyMonths = row.yearlyMonths ?? ''
    form.yearlyDaysOfMonth = row.yearlyDaysOfMonth ?? ''
    form.tiers = row.tiers?.length ? row.tiers.map(t => ({ ...t })) : [emptyTier()]
    form.taskTemplateId = row.taskTemplateId
    form.reminderTemplateId = row.reminderTemplateId
    form.rewardWindowRule = row.rewardWindowRule ?? defaultRewardWindowRule()
    form.rewardDescription = row.rewardDescription
    form.isVisible = !!row.isVisible
    monthEndMode.value = form.rewardWindowRule.mode === 'NEXT_MONTH' && form.rewardWindowRule.endDay !== 'LAST_DAY' ? 'CUSTOM' : 'LAST_DAY'

    await Promise.allSettled([
      row.taskTemplateId ? searchActivities(String(row.taskTemplateId)) : Promise.resolve(),
      row.reminderTemplateId ? searchReminderTemplates(String(row.reminderTemplateId)) : Promise.resolve(),
    ])
    if (row.taskTemplateId && !activityOptions.value.find(o => o.value === row.taskTemplateId))
      activityOptions.value = [{ label: `活动 ID: ${row.taskTemplateId}`, value: row.taskTemplateId }]
    if (row.reminderTemplateId && !reminderOptions.value.find(o => o.value === row.reminderTemplateId))
      reminderOptions.value = [{ label: `提醒模板 ID: ${row.reminderTemplateId}`, value: row.reminderTemplateId }]
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载详情失败')
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    reset()
    if (props.jobId)
      loadDetail(props.jobId)
  }
})

watch(() => form.repeatType, (repeatType) => {
  if (repeatType !== 'ONE_TIME') form.date = null
  if (repeatType !== 'WEEKLY') form.daysOfWeek = []
  if (repeatType !== 'MONTHLY') form.daysOfMonth = ''
  if (repeatType !== 'YEARLY') {
    form.yearlyMonths = ''
    form.yearlyDaysOfMonth = ''
  }
})

function addTier() { form.tiers.push(emptyTier()) }
function removeTier(i: number) { if (form.tiers.length > 1) form.tiers.splice(i, 1) }

const dateModel = computed({
  get: () => form.date ?? undefined,
  set: (v) => { form.date = v ?? null },
})
const startDateModel = computed({
  get: () => form.startDate ?? undefined,
  set: (v) => { form.startDate = v ?? null },
})
const endDateModel = computed({
  get: () => form.endDate ?? undefined,
  set: (v) => { form.endDate = v ?? null },
})
const taskTemplateIdModel = computed({
  get: () => form.taskTemplateId ?? undefined,
  set: (v) => { form.taskTemplateId = typeof v === 'number' ? v : null },
})
const reminderTemplateIdModel = computed({
  get: () => form.reminderTemplateId ?? undefined,
  set: (v) => { form.reminderTemplateId = typeof v === 'number' ? v : null },
})
const rewardModeModel = computed({
  get: () => form.rewardWindowRule.mode,
  set: (mode: RewardWindowMode) => {
    if (mode === 'NEXT_MONTH') {
      form.rewardWindowRule = { mode, startDay: 1, endDay: 'LAST_DAY' }
      monthEndMode.value = 'LAST_DAY'
    }
    else if (mode === 'NEXT_WEEK') {
      form.rewardWindowRule = {
        mode,
        weekStartsOn: 1,
      }
    }
    else if (mode === 'AFTER_COMPLETION_DAYS') {
      form.rewardWindowRule = { mode, startOffsetDays: 0, durationDays: 1 }
    }
    else {
      form.rewardWindowRule = { mode }
    }
  },
})
const nextMonthStartDayModel = computed({
  get: () => form.rewardWindowRule.mode === 'NEXT_MONTH' && typeof form.rewardWindowRule.startDay === 'number'
    ? form.rewardWindowRule.startDay
    : 1,
  set: (v) => {
    if (form.rewardWindowRule.mode === 'NEXT_MONTH') form.rewardWindowRule.startDay = Number(v) || 1
  },
})
const nextMonthEndDayModel = computed({
  get: () => form.rewardWindowRule.mode === 'NEXT_MONTH' && typeof form.rewardWindowRule.endDay === 'number'
    ? form.rewardWindowRule.endDay
    : 1,
  set: (v) => {
    if (form.rewardWindowRule.mode === 'NEXT_MONTH') form.rewardWindowRule.endDay = Number(v) || 1
  },
})
const fixedRewardStartModel = computed({
  get: () => form.rewardWindowRule.mode === 'FIXED' ? form.rewardWindowRule.startAt : undefined,
  set: (v) => {
    if (form.rewardWindowRule.mode === 'FIXED') form.rewardWindowRule.startAt = v ?? undefined
  },
})
const fixedRewardEndModel = computed({
  get: () => form.rewardWindowRule.mode === 'FIXED' ? form.rewardWindowRule.endAt : undefined,
  set: (v) => {
    if (form.rewardWindowRule.mode === 'FIXED') form.rewardWindowRule.endAt = v ?? undefined
  },
})

function normalizeRewardWindowRule(): JobRewardWindowRule {
  const rule = form.rewardWindowRule
  if (rule.mode === 'NEXT_MONTH') {
    return {
      mode: 'NEXT_MONTH',
      startDay: typeof rule.startDay === 'number' ? rule.startDay : 1,
      endDay: monthEndMode.value === 'LAST_DAY' ? 'LAST_DAY' : (typeof rule.endDay === 'number' ? rule.endDay : 1),
    }
  }
  if (rule.mode === 'NEXT_WEEK') {
    return {
      mode: 'NEXT_WEEK',
      weekStartsOn: typeof rule.weekStartsOn === 'number' ? rule.weekStartsOn : 1,
    }
  }
  if (rule.mode === 'AFTER_COMPLETION_DAYS') {
    return {
      mode: 'AFTER_COMPLETION_DAYS',
      startOffsetDays: typeof rule.startOffsetDays === 'number' ? rule.startOffsetDays : 0,
      durationDays: typeof rule.durationDays === 'number' ? rule.durationDays : 1,
    }
  }
  return {
    mode: 'FIXED',
    startAt: rule.startAt,
    endAt: rule.endAt,
  }
}

function validateForm() {
  if (!form.title.trim()) return '请填写标题'
  if (!form.taskTemplateId) return '请选择关联活动'
  if (form.repeatType === 'ONE_TIME' && !form.date) return '一次性 job 需要选择周期日期'
  // daysOfWeek 为空表示自然周整周统计，不是漏填。
  // daysOfMonth 为空表示自然月整月统计，不是漏填。
  if (form.repeatType === 'YEARLY' && (!form.yearlyMonths.trim() || !form.yearlyDaysOfMonth.trim())) return '每年 job 需要填写月份和日期'
  if (form.tiers.some(t => t.minAmount == null && t.minCount == null)) return '每个档位至少填写金额或笔数'
  if (form.rewardWindowRule.mode === 'FIXED' && (!form.rewardWindowRule.startAt || !form.rewardWindowRule.endAt)) return '固定权益窗口需要填写起止日期'
  if (!form.rewardDescription?.trim()) return '请填写权益文案'
  if (!form.reminderTemplateId) return '请选择达标后提醒模板'
  return ''
}

async function handleConfirm() {
  const error = validateForm()
  if (error) {
    MessagePlugin.warning(error)
    return
  }
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      repeatType: form.repeatType,
      date: form.date,
      startDate: form.startDate,
      endDate: form.endDate,
      daysOfWeek: form.repeatType === 'WEEKLY' && form.daysOfWeek.length > 0 ? stringifyNumberList(form.daysOfWeek) : null,
      daysOfMonth: form.repeatType === 'MONTHLY' && form.daysOfMonth.trim() ? form.daysOfMonth.trim() : null,
      yearlyMonths: form.repeatType === 'YEARLY' ? form.yearlyMonths.trim() : null,
      yearlyDaysOfMonth: form.repeatType === 'YEARLY' ? form.yearlyDaysOfMonth.trim() : null,
      tiers: form.tiers.map(tier => ({
        minAmount: tier.minAmount,
        minCount: tier.minCount,
        logic: tier.logic,
        description: tier.description?.trim() || null,
      })),
      taskTemplateId: form.taskTemplateId,
      reminderTemplateId: form.reminderTemplateId,
      rewardWindowRule: normalizeRewardWindowRule(),
      rewardDescription: form.rewardDescription?.trim() || null,
      isVisible: form.isVisible,
    }
    if (props.jobId)
      await requestJson(`/api/jobTemplates/${props.jobId}`, { method: 'PUT', body })
    else
      await requestJson('/api/jobTemplates', { method: 'POST', body })
    MessagePlugin.success('保存成功')
    emit('saved')
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '保存失败')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <t-dialog
    :visible="visible"
    :header="jobId ? '编辑 Job 模板' : '新增 Job 模板'"
    width="920px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
    @close="emit('update:visible', false)"
  >
    <t-form label-width="116px" class="job-template-form">
      <section class="config-section">
        <div class="section-heading">
          <div>
            <div class="section-kicker">
              Step 1
            </div>
            <div class="section-title">
              基础归属
            </div>
            <p class="section-description">
              定义这个 job 模板属于哪个活动，以及运营侧如何识别它。
            </p>
          </div>
          <label class="section-switch">
            <span>前台可见</span>
            <t-switch v-model="form.isVisible" />
          </label>
        </div>
        <div class="section-body">
          <div class="form-grid form-grid-2">
            <t-form-item label="标题">
              <t-input v-model="form.title" placeholder="如：本月快捷支付满 50 万" />
            </t-form-item>
            <t-form-item label="关联活动">
              <t-select
                v-model="taskTemplateIdModel"
                filterable
                clearable
                :options="activityOptions"
                placeholder="搜索活动标题或银行"
                @search="searchActivities"
              >
                <t-option
                  v-for="opt in activityOptions"
                  :key="opt.value"
                  :value="opt.value"
                  :label="opt.label"
                >
                  <span>{{ opt.label }}</span>
                  <span v-if="opt.bankName" class="ml-1 text-xs text-gray-400">{{ opt.bankName }}</span>
                </t-option>
              </t-select>
            </t-form-item>
          </div>
          <t-form-item label="配置说明">
            <t-textarea v-model="descriptionModel" placeholder="给运营看的配置说明，可选" :autosize="{ minRows: 2, maxRows: 4 }" />
          </t-form-item>
        </div>
      </section>

      <section class="config-section">
        <div class="section-heading">
          <div>
            <div class="section-kicker">
              Step 2
            </div>
            <div class="section-title">
              达标周期
            </div>
            <p class="section-description">
              这里定义用户必须在哪个时间盒子里完成 job，进度会按每一期 occurrence 独立累计。
            </p>
          </div>
        </div>
        <div class="section-body">
          <div class="form-grid form-grid-3">
            <t-form-item label="周期类型">
              <t-select v-model="form.repeatType" :options="[...REPEAT_TYPE_OPTIONS]" />
            </t-form-item>
            <t-form-item v-if="form.repeatType === 'ONE_TIME'" label="周期日期">
              <t-date-picker v-model="dateModel" value-type="time-stamp" clearable />
            </t-form-item>
            <t-form-item label="活动有效期起">
              <t-date-picker v-model="startDateModel" value-type="time-stamp" clearable />
            </t-form-item>
            <t-form-item label="活动有效期止">
              <t-date-picker v-model="endDateModel" value-type="time-stamp" clearable />
            </t-form-item>
          </div>
          <div class="field-help section-note">
            {{ cycleHelpText }}
          </div>
          <t-form-item v-if="form.repeatType === 'WEEKLY'" label="周内统计限制">
            <div class="field-stack">
              <t-checkbox-group v-model="form.daysOfWeek" :options="WEEK_OPTIONS" />
              <div class="field-help">
                不选择表示自然周整周统计（周一 00:00:00 至周日 23:59:59）；只有“限定某几天发生”时才勾选。
              </div>
            </div>
          </t-form-item>
          <t-form-item v-if="form.repeatType === 'MONTHLY'" label="每月统计限制">
            <div class="field-stack">
              <t-input v-model="form.daysOfMonth" placeholder="可选。填写日期，逗号分隔。如：1,15,22" />
              <div class="field-help">
                不填写表示自然月整月统计；只有“每月固定几天可累计”时才填写。
              </div>
            </div>
          </t-form-item>
          <div v-if="form.repeatType === 'YEARLY'" class="form-grid form-grid-2">
            <t-form-item label="每年月份">
              <t-input v-model="form.yearlyMonths" placeholder="逗号分隔。如：1,6,12" />
            </t-form-item>
            <t-form-item label="每年日期">
              <t-input v-model="form.yearlyDaysOfMonth" placeholder="逗号分隔。如：1,15,31" />
            </t-form-item>
          </div>
        </div>
      </section>

      <section class="config-section">
        <div class="section-heading">
          <div>
            <div class="section-kicker">
              Step 3
            </div>
            <div class="section-title">
              达标条件
            </div>
            <p class="section-description">
              一个档位至少填写金额或笔数；多档位会在用户进度中按达标程度展示。
            </p>
          </div>
        </div>
        <div class="section-body">
          <t-form-item label="档位">
            <div class="tier-list">
              <div v-for="(tier, i) in form.tiers" :key="i" class="tier-row">
                <t-input-number
                  :model-value="tier.minAmount ?? undefined"
                  placeholder="金额"
                  theme="normal"
                  class="tier-amount"
                  @change="(v: string | number) => { tier.minAmount = typeof v === 'number' ? v : null }"
                />
                <t-input-number
                  :model-value="tier.minCount ?? undefined"
                  placeholder="笔数"
                  theme="normal"
                  class="tier-count"
                  @change="(v: string | number) => { tier.minCount = typeof v === 'number' ? v : null }"
                />
                <t-select v-model="tier.logic" :options="LOGIC_OPTIONS" class="tier-logic" />
                <t-input
                  :model-value="tier.description ?? ''"
                  placeholder="档位说明，如：刷满 2000 且 5 笔"
                  @update:model-value="(v: string | number) => { tier.description = String(v) || null }"
                />
                <t-button size="small" variant="text" theme="danger" :disabled="form.tiers.length <= 1" @click="removeTier(i)">
                  删除
                </t-button>
              </div>
              <t-button size="small" variant="outline" @click="addTier">
                + 增加档位
              </t-button>
            </div>
          </t-form-item>
        </div>
      </section>

      <section class="config-section">
        <div class="section-heading">
          <div>
            <div class="section-kicker">
              Step 4
            </div>
            <div class="section-title">
              达标后提醒生成
            </div>
            <p class="section-description">
              这里不配置具体周几几点，只配置“本期 job 达标后，从哪个目标周期里摘提醒点”。具体提醒时间由 reminder_template 维护。
            </p>
          </div>
        </div>
        <div class="section-body">
          <div class="form-grid form-grid-3">
            <t-form-item label="目标周期">
              <t-select v-model="rewardModeModel" :options="[...REWARD_WINDOW_MODE_OPTIONS]" />
            </t-form-item>
            <template v-if="form.rewardWindowRule.mode === 'NEXT_MONTH'">
              <t-form-item label="目标月开始日">
                <t-input-number
                  v-model="nextMonthStartDayModel"
                  theme="normal"
                  :min="1"
                  :max="31"
                />
              </t-form-item>
              <t-form-item label="目标月结束日">
                <div class="inline-pair">
                  <t-select v-model="monthEndMode" :options="MONTH_END_OPTIONS" />
                  <t-input-number
                    v-if="monthEndMode === 'CUSTOM'"
                    v-model="nextMonthEndDayModel"
                    theme="normal"
                    :min="1"
                    :max="31"
                  />
                </div>
              </t-form-item>
            </template>
            <template v-if="form.rewardWindowRule.mode === 'NEXT_WEEK'">
              <t-form-item label="目标周起始">
                <t-select v-model="form.rewardWindowRule.weekStartsOn" :options="WEEK_OPTIONS" />
              </t-form-item>
            </template>
            <template v-if="form.rewardWindowRule.mode === 'AFTER_COMPLETION_DAYS'">
              <t-form-item label="开始偏移天数">
                <t-input-number v-model="form.rewardWindowRule.startOffsetDays" theme="normal" :min="0" />
              </t-form-item>
              <t-form-item label="持续天数">
                <t-input-number v-model="form.rewardWindowRule.durationDays" theme="normal" :min="1" />
              </t-form-item>
            </template>
            <template v-if="form.rewardWindowRule.mode === 'FIXED'">
              <t-form-item label="目标范围起">
                <t-date-picker v-model="fixedRewardStartModel" value-type="time-stamp" clearable />
              </t-form-item>
              <t-form-item label="目标范围止">
                <t-date-picker v-model="fixedRewardEndModel" value-type="time-stamp" clearable />
              </t-form-item>
            </template>
          </div>
          <div class="field-help section-note">
            {{ targetPeriodHelpText }}
          </div>
          <t-form-item label="提醒模板">
            <div class="field-stack">
              <t-select
                v-model="reminderTemplateIdModel"
                filterable
                clearable
                :options="reminderOptions"
                placeholder="搜索提醒模板标题、活动标题或 ID"
                @focus="searchReminderTemplates()"
                @search="searchReminderTemplates"
              />
              <div class="field-help">
                例如“每周五 09:00”。用户达标后，系统只会从上方目标周期内展开这个模板并创建一次性提醒任务。
              </div>
            </div>
          </t-form-item>
          <t-form-item label="前台权益文案">
            <t-input v-model="rewardDescriptionModel" placeholder="如：下月可抽奖 5 次 / 下月每周三可购买 30 元券" />
          </t-form-item>
        </div>
      </section>
    </t-form>
  </t-dialog>
</template>

<style scoped>
.job-template-form {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}

.config-section {
  margin-bottom: 16px;
  border: 1px solid var(--td-component-border);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgb(0 82 217 / 5%), transparent 36%),
    var(--td-bg-color-container);
  padding: 16px 16px 4px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.section-kicker {
  margin-bottom: 2px;
  color: var(--td-brand-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.section-title {
  color: var(--td-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.section-description {
  margin: 6px 0 0;
  color: var(--td-text-color-secondary);
  font-size: 13px;
  line-height: 20px;
}

.section-switch {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: var(--td-bg-color-secondarycontainer);
  color: var(--td-text-color-secondary);
  font-size: 13px;
  padding: 6px 10px;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-note {
  margin: -2px 0 10px 116px;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tier-list {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.tier-row {
  display: grid;
  grid-template-columns: 120px 100px 78px minmax(180px, 1fr) 52px;
  align-items: center;
  gap: 8px;
}

.inline-pair {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(120px, 1fr) 96px;
  gap: 8px;
}

.field-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-help {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 760px) {
  .section-heading {
    flex-direction: column;
  }

  .section-switch {
    align-self: flex-start;
  }

  .section-note {
    margin-left: 0;
  }

  .form-grid-2,
  .form-grid-3,
  .tier-row,
  .inline-pair {
    grid-template-columns: 1fr;
  }
}
</style>
