<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import {
  REMINDER_REPEAT_TYPE_OPTIONS,
  REMINDER_TEMPLATE_KIND_OPTIONS,
  type ReminderRepeatType,
  type ReminderTemplateKind,
  type ReminderTemplateRow,
} from '@/types/reminderTemplates'

const props = defineProps<{ visible: boolean, reminderId: number | null }>()
const emit = defineEmits<{ 'update:visible': [boolean], 'saved': [] }>()

const WEEK_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: i + 1 }))
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ label: `${i + 1}日`, value: i + 1 }))
const kindLabelMap = Object.fromEntries(REMINDER_TEMPLATE_KIND_OPTIONS.map(item => [item.value, item.label])) as Record<ReminderTemplateKind, string>

const loading = ref(false)
const saving = ref(false)

const form = reactive({
  id: null as number | null,
  taskTemplateId: null as number | null,
  taskTemplateTitle: null as string | null,
  title: '',
  description: null as string | null,
  kind: 'REMINDER' as ReminderTemplateKind,
  repeatType: 'ONE_TIME' as ReminderRepeatType,
  date: null as number | null,
  startDate: null as number | null,
  endDate: null as number | null,
  daysOfWeek: [] as number[],
  daysOfMonth: [] as number[],
  yearlyMonths: [] as number[],
  yearlyDaysOfMonth: [] as number[],
  reminderTime: null as string | null,
  advanceReminderMinutes: null as number | null,
  isVisible: true,
})

function parseNumberList(raw: string | null | undefined) {
  const text = raw?.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => Number(item))
        .filter(item => Number.isInteger(item) && item > 0)
    }
  }
  catch {}
  return text
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(item => Number(item.replace(/"/g, '').trim()))
    .filter(item => Number.isInteger(item) && item > 0)
}

function stringifyNumberList(list: number[]) {
  return JSON.stringify([...new Set(list)].sort((a, b) => a - b))
}

function reset() {
  form.id = null
  form.taskTemplateId = null
  form.taskTemplateTitle = null
  form.title = ''
  form.description = null
  form.kind = 'REMINDER'
  form.repeatType = 'ONE_TIME'
  form.date = null
  form.startDate = null
  form.endDate = null
  form.daysOfWeek = []
  form.daysOfMonth = []
  form.yearlyMonths = []
  form.yearlyDaysOfMonth = []
  form.reminderTime = null
  form.advanceReminderMinutes = null
  form.isVisible = true
}

async function loadDetail(id: number) {
  loading.value = true
  try {
    const row = await requestJson<ReminderTemplateRow>(`/api/reminderTemplates/${id}`)
    form.id = row.id
    form.taskTemplateId = row.taskTemplateId
    form.taskTemplateTitle = row.taskTemplateTitle ?? null
    form.title = row.title
    form.description = row.description
    form.kind = row.kind
    form.repeatType = row.repeatType
    form.date = row.date
    form.startDate = row.startDate
    form.endDate = row.endDate
    form.daysOfWeek = parseNumberList(row.daysOfWeek)
    form.daysOfMonth = parseNumberList(row.daysOfMonth)
    form.yearlyMonths = parseNumberList(row.yearlyMonths)
    form.yearlyDaysOfMonth = parseNumberList(row.yearlyDaysOfMonth)
    form.reminderTime = row.reminderTime
    form.advanceReminderMinutes = row.advanceReminderMinutes
    form.isVisible = !!row.isVisible
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载提醒模板失败')
  }
  finally {
    loading.value = false
  }
}

watch(() => props.visible, (visible) => {
  if (!visible) {
    reset()
    return
  }
  reset()
  if (props.reminderId)
    loadDetail(props.reminderId)
})

watch(() => form.repeatType, (repeatType) => {
  if (repeatType !== 'ONE_TIME') form.date = null
  if (repeatType !== 'WEEKLY') form.daysOfWeek = []
  if (repeatType !== 'MONTHLY') form.daysOfMonth = []
  if (repeatType !== 'YEARLY') {
    form.yearlyMonths = []
    form.yearlyDaysOfMonth = []
  }
})

const descriptionModel = computed({
  get: () => form.description ?? '',
  set: (value) => {
    const text = typeof value === 'string' ? value : String(value ?? '')
    form.description = text.trim() ? text : null
  },
})
const reminderTimeModel = computed({
  get: () => form.reminderTime ?? undefined,
  set: (value) => {
    form.reminderTime = typeof value === 'string' && value.trim() ? value.trim() : null
  },
})
const advanceReminderMinutesModel = computed({
  get: () => form.advanceReminderMinutes ?? undefined,
  set: (value) => {
    form.advanceReminderMinutes = typeof value === 'number' ? value : null
  },
})
const dateModel = computed({
  get: () => form.date ?? undefined,
  set: (value) => { form.date = value ?? null },
})
const startDateModel = computed({
  get: () => form.startDate ?? undefined,
  set: (value) => { form.startDate = value ?? null },
})
const endDateModel = computed({
  get: () => form.endDate ?? undefined,
  set: (value) => { form.endDate = value ?? null },
})

function validateForm() {
  if (!props.reminderId) return '缺少提醒模板 ID'
  if (!form.title.trim()) return '请填写标题'
  if (form.repeatType === 'ONE_TIME' && !form.date) return '一次性提醒需要选择日期'
  if (form.repeatType === 'WEEKLY' && form.daysOfWeek.length === 0) return '每周提醒至少选择一个星期'
  if (form.repeatType === 'MONTHLY' && form.daysOfMonth.length === 0) return '每月提醒至少选择一个日期'
  if (form.repeatType === 'YEARLY' && (form.yearlyMonths.length === 0 || form.yearlyDaysOfMonth.length === 0)) return '每年提醒需要选择月份和日期'
  return ''
}

async function save() {
  const error = validateForm()
  if (error) {
    MessagePlugin.warning(error)
    return
  }

  saving.value = true
  try {
    await requestJson(`/api/reminderTemplates/${props.reminderId}`, {
      method: 'PUT',
      body: {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        repeatType: form.repeatType,
        date: form.repeatType === 'ONE_TIME' ? form.date : null,
        startDate: form.startDate,
        endDate: form.endDate,
        daysOfWeek: form.repeatType === 'WEEKLY' ? stringifyNumberList(form.daysOfWeek) : null,
        daysOfMonth: form.repeatType === 'MONTHLY' ? stringifyNumberList(form.daysOfMonth) : null,
        yearlyMonths: form.repeatType === 'YEARLY' ? stringifyNumberList(form.yearlyMonths) : null,
        yearlyDaysOfMonth: form.repeatType === 'YEARLY' ? stringifyNumberList(form.yearlyDaysOfMonth) : null,
        reminderTime: form.reminderTime,
        advanceReminderMinutes: form.advanceReminderMinutes,
        isVisible: form.isVisible,
      },
    })
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
    header="编辑提醒模板"
    width="860px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="save"
    @close="emit('update:visible', false)"
  >
    <t-loading :loading="loading">
      <t-form label-width="112px" class="reminder-template-form">
        <div class="readonly-strip">
          <div>
            <span class="readonly-label">模板 ID</span>
            <span>{{ form.id ?? '-' }}</span>
          </div>
          <div>
            <span class="readonly-label">类型</span>
            <t-tag theme="primary" variant="light">
              {{ kindLabelMap[form.kind] ?? form.kind }}
            </t-tag>
          </div>
          <div>
            <span class="readonly-label">关联活动</span>
            <span>{{ form.taskTemplateTitle || (form.taskTemplateId ? `活动 ID: ${form.taskTemplateId}` : '-') }}</span>
          </div>
        </div>

        <t-form-item label="标题">
          <t-input v-model="form.title" placeholder="提醒任务标题" :maxlength="200" />
        </t-form-item>
        <t-form-item label="说明">
          <t-textarea v-model="descriptionModel" placeholder="提醒说明，可选" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>

        <div class="form-grid form-grid-3">
          <t-form-item label="重复类型">
            <t-select v-model="form.repeatType" :options="[...REMINDER_REPEAT_TYPE_OPTIONS]" />
          </t-form-item>
          <t-form-item v-if="form.repeatType === 'ONE_TIME'" label="日期">
            <t-date-picker v-model="dateModel" value-type="time-stamp" clearable />
          </t-form-item>
          <t-form-item label="提醒时间">
            <t-time-picker v-model="reminderTimeModel" format="HH:mm" clearable placeholder="全天/不指定" />
          </t-form-item>
          <t-form-item label="提前提醒">
            <t-input-number
              v-model="advanceReminderMinutesModel"
              theme="normal"
              :min="0"
              :max="60"
              placeholder="分钟"
            />
          </t-form-item>
          <t-form-item label="有效期起">
            <t-date-picker v-model="startDateModel" value-type="time-stamp" clearable />
          </t-form-item>
          <t-form-item label="有效期止">
            <t-date-picker v-model="endDateModel" value-type="time-stamp" clearable />
          </t-form-item>
        </div>

        <t-form-item v-if="form.repeatType === 'WEEKLY'" label="每周触发">
          <t-checkbox-group v-model="form.daysOfWeek" :options="WEEK_OPTIONS" />
        </t-form-item>
        <t-form-item v-if="form.repeatType === 'MONTHLY'" label="每月触发">
          <t-checkbox-group v-model="form.daysOfMonth" :options="MONTH_DAY_OPTIONS" class="dense-checkbox-group" />
        </t-form-item>
        <template v-if="form.repeatType === 'YEARLY'">
          <t-form-item label="每年月份">
            <t-checkbox-group v-model="form.yearlyMonths" :options="MONTH_OPTIONS" class="dense-checkbox-group" />
          </t-form-item>
          <t-form-item label="每年日期">
            <t-checkbox-group v-model="form.yearlyDaysOfMonth" :options="MONTH_DAY_OPTIONS" class="dense-checkbox-group" />
          </t-form-item>
        </template>

        <t-form-item label="可见">
          <t-switch v-model="form.isVisible" />
        </t-form-item>
      </t-form>
    </t-loading>
  </t-dialog>
</template>

<style scoped>
.reminder-template-form {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}

.readonly-strip {
  display: grid;
  grid-template-columns: 120px 150px minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--component-border, #e5edf5);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.02);
  color: var(--td-text-color-primary);
}

.readonly-label {
  margin-right: 8px;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dense-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

@media (max-width: 760px) {
  .readonly-strip,
  .form-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
