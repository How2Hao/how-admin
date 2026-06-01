<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { REGION_MATCH_STRATEGY_OPTIONS, REPEAT_TYPE_OPTIONS, type JobTemplateRow, type JobTemplateTier } from '@/types/jobTemplates'

const props = defineProps<{ visible: boolean, jobId: number | null }>()
const emit = defineEmits<{ 'update:visible': [boolean], 'saved': [] }>()

const LOGIC_OPTIONS = [{ label: '且', value: 'AND' }, { label: '或', value: 'OR' }]

// ── 搜索选项状态 ──────────────────────────────────────────────
interface SelectOption { label: string, value: number | string, bankName?: string | null }

const bankOptions = ref<SelectOption[]>([])
const bankCardTemplateOptions = ref<SelectOption[]>([])
const activityOptions = ref<SelectOption[]>([])
const regionOptions = ref<SelectOption[]>([])

async function searchBanks(q: string) {
  if (!q.trim()) { bankOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/bankCardActivities/web/searchBanks?q=${encodeURIComponent(q)}`)
    bankOptions.value = res.options
  }
  catch {}
}

async function searchBankCardTemplates(q: string) {
  if (!q.trim()) { bankCardTemplateOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/bankCardActivities/web/searchBankCardTemplates?q=${encodeURIComponent(q)}`)
    bankCardTemplateOptions.value = res.options
  }
  catch {}
}

async function searchActivities(q: string) {
  if (!q.trim()) { activityOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/jobTemplates/searchActivities?q=${encodeURIComponent(q)}`)
    activityOptions.value = res.options
  }
  catch {}
}

async function searchRegions(q: string) {
  if (!q.trim()) { regionOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/bankCardActivities/web/searchRegions?q=${encodeURIComponent(q)}`)
    regionOptions.value = res.options
  }
  catch {}
}

// ── 表单 ─────────────────────────────────────────────────────
function emptyTier(): JobTemplateTier {
  return { minAmount: null, minCount: null, logic: 'AND', description: null }
}

const form = reactive({
  title: '',
  repeatType: 'MONTHLY' as JobTemplateRow['repeatType'],
  startDate: null as number | null,
  endDate: null as number | null,
  tiers: [emptyTier()] as JobTemplateTier[],
  taskTemplateId: null as number | null,
  bankId: null as number | null,
  bankCardTemplateId: null as number | null,
  regionCode: null as string | null,
  regionMatchStrategy: null as string | null,
  isVisible: false,
})
const saving = ref(false)

function reset() {
  form.title = ''
  form.repeatType = 'MONTHLY'
  form.startDate = null
  form.endDate = null
  form.tiers = [emptyTier()]
  form.taskTemplateId = null
  form.bankId = null
  form.bankCardTemplateId = null
  form.regionCode = null
  form.regionMatchStrategy = null
  form.isVisible = false
  bankOptions.value = []
  bankCardTemplateOptions.value = []
  activityOptions.value = []
  regionOptions.value = []
}

// 编辑时：加载详情并回填当前值到各搜索选项，让选择器显示可读名称
async function loadDetail(id: number) {
  try {
    const row = await requestJson<JobTemplateRow>(`/api/jobTemplates/${id}`)
    form.title = row.title
    form.repeatType = row.repeatType
    form.startDate = row.startDate
    form.endDate = row.endDate
    form.tiers = row.tiers?.length ? row.tiers.map(t => ({ ...t })) : [emptyTier()]
    form.taskTemplateId = row.taskTemplateId
    form.bankId = row.bankId
    form.bankCardTemplateId = row.bankCardTemplateId
    form.regionCode = row.regionCode
    form.regionMatchStrategy = row.regionMatchStrategy
    form.isVisible = !!row.isVisible

    // 回填选项（让选择器显示名称，不能只存 id/code）
    await Promise.allSettled([
      row.bankId ? searchBanks(String(row.bankId)) : Promise.resolve(),
      row.bankCardTemplateId ? searchBankCardTemplates(String(row.bankCardTemplateId)) : Promise.resolve(),
      row.taskTemplateId ? searchActivities(String(row.taskTemplateId)) : Promise.resolve(),
      row.regionCode ? searchRegions(row.regionCode) : Promise.resolve(),
    ])
    // 若搜索结果不含当前值（搜索词太短匹配不到），注入占位选项
    if (row.bankId && !bankOptions.value.find(o => o.value === row.bankId))
      bankOptions.value = [{ label: `银行 ID: ${row.bankId}`, value: row.bankId }]
    if (row.bankCardTemplateId && !bankCardTemplateOptions.value.find(o => o.value === row.bankCardTemplateId))
      bankCardTemplateOptions.value = [{ label: `模板卡 ID: ${row.bankCardTemplateId}`, value: row.bankCardTemplateId }]
    if (row.taskTemplateId && !activityOptions.value.find(o => o.value === row.taskTemplateId))
      activityOptions.value = [{ label: `活动 ID: ${row.taskTemplateId}`, value: row.taskTemplateId }]
    if (row.regionCode && !regionOptions.value.find(o => o.value === row.regionCode))
      regionOptions.value = [{ label: row.regionCode, value: row.regionCode }]
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

// ── 档位操作 ─────────────────────────────────────────────────
function addTier() { form.tiers.push(emptyTier()) }
function removeTier(i: number) { if (form.tiers.length > 1) form.tiers.splice(i, 1) }

// ── writable computeds（null↔undefined bridge for TDesign）──
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
const bankIdModel = computed({
  get: () => form.bankId ?? undefined,
  set: (v) => { form.bankId = typeof v === 'number' ? v : null },
})
const bankCardTemplateIdModel = computed({
  get: () => form.bankCardTemplateId ?? undefined,
  set: (v) => { form.bankCardTemplateId = typeof v === 'number' ? v : null },
})
const regionCodeModel = computed({
  get: () => form.regionCode ?? undefined,
  set: (v) => {
    form.regionCode = typeof v === 'string' && v ? v : null
    if (!form.regionCode) form.regionMatchStrategy = null
  },
})
const regionMatchStrategyModel = computed({
  get: () => form.regionMatchStrategy ?? undefined,
  set: (v) => { form.regionMatchStrategy = typeof v === 'string' && v ? v : null },
})

// ── 提交 ────────────────────────────────────────────────────
async function handleConfirm() {
  if (!form.title.trim()) { MessagePlugin.warning('请填写标题'); return }
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      repeatType: form.repeatType,
      startDate: form.startDate,
      endDate: form.endDate,
      tiers: form.tiers,
      taskTemplateId: form.taskTemplateId,
      bankId: form.bankId,
      bankCardTemplateId: form.bankCardTemplateId,
      regionCode: form.regionCode,
      regionMatchStrategy: form.regionMatchStrategy,
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
    :header="jobId ? '编辑任务模板' : '新增任务模板'"
    width="680px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
    @close="emit('update:visible', false)"
  >
    <t-form label-width="90px">
      <t-form-item label="标题">
        <t-input v-model="form.title" placeholder="如：本月刷满5笔" />
      </t-form-item>
      <t-form-item label="周期">
        <t-select v-model="form.repeatType" :options="[...REPEAT_TYPE_OPTIONS]" />
      </t-form-item>
      <t-form-item label="有效期起">
        <t-date-picker v-model="startDateModel" value-type="time-stamp" clearable />
      </t-form-item>
      <t-form-item label="有效期止">
        <t-date-picker v-model="endDateModel" value-type="time-stamp" clearable />
      </t-form-item>

      <t-form-item label="关联活动">
        <t-select
          v-model="taskTemplateIdModel"
          filterable
          clearable
          :options="activityOptions"
          placeholder="搜索活动标题"
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

      <t-form-item label="关联银行">
        <t-select
          v-model="bankIdModel"
          filterable
          clearable
          :options="bankOptions"
          placeholder="搜索银行名称"
          @search="searchBanks"
        />
      </t-form-item>

      <t-form-item label="关联模板卡">
        <t-select
          v-model="bankCardTemplateIdModel"
          filterable
          clearable
          :options="bankCardTemplateOptions"
          placeholder="搜索模板卡名称"
          @search="searchBankCardTemplates"
        />
      </t-form-item>

      <t-form-item label="适用地区">
        <t-select
          v-model="regionCodeModel"
          filterable
          clearable
          :options="regionOptions"
          placeholder="搜索地区名称"
          @search="searchRegions"
        />
      </t-form-item>

      <t-form-item v-if="form.regionCode" label="匹配策略">
        <t-select
          v-model="regionMatchStrategyModel"
          :options="REGION_MATCH_STRATEGY_OPTIONS"
          clearable
          placeholder="请选择"
        />
      </t-form-item>

      <t-form-item label="可见">
        <t-switch v-model="form.isVisible" />
      </t-form-item>

      <t-form-item label="档位">
        <div class="w-full flex flex-col gap-2">
          <div v-for="(tier, i) in form.tiers" :key="i" class="flex items-center gap-2">
            <t-input-number
              :model-value="tier.minAmount ?? undefined"
              placeholder="金额"
              theme="normal"
              style="width: 110px"
              @change="(v: string | number) => { tier.minAmount = typeof v === 'number' ? v : null }"
            />
            <t-input-number
              :model-value="tier.minCount ?? undefined"
              placeholder="笔数"
              theme="normal"
              style="width: 100px"
              @change="(v: string | number) => { tier.minCount = typeof v === 'number' ? v : null }"
            />
            <t-select v-model="tier.logic" :options="LOGIC_OPTIONS" style="width: 80px" />
            <t-input
              :model-value="tier.description ?? undefined"
              placeholder="说明"
              @change="(v: string | number) => { tier.description = String(v) || null }"
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
    </t-form>
  </t-dialog>
</template>
