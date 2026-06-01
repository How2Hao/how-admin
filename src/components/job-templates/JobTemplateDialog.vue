<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { REPEAT_TYPE_OPTIONS, type JobTemplateRow, type JobTemplateTier } from '@/types/jobTemplates'

const props = defineProps<{ visible: boolean, jobId: number | null }>()
const emit = defineEmits<{ 'update:visible': [boolean], 'saved': [] }>()

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
  form.isVisible = false
}

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
    form.isVisible = !!row.isVisible
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

function addTier() {
  form.tiers.push(emptyTier())
}
function removeTier(i: number) {
  if (form.tiers.length > 1)
    form.tiers.splice(i, 1)
}

async function handleConfirm() {
  if (!form.title.trim()) {
    MessagePlugin.warning('请填写标题')
    return
  }
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
    width="640px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
  >
    <t-form label-width="90px">
      <t-form-item label="标题">
        <t-input v-model="form.title" placeholder="如：本月刷满5笔" />
      </t-form-item>
      <t-form-item label="周期">
        <t-select v-model="form.repeatType" :options="[...REPEAT_TYPE_OPTIONS]" />
      </t-form-item>
      <t-form-item label="有效期起">
        <t-date-picker :model-value="(form.startDate as any)" value-type="time-stamp" clearable @change="(v: any) => form.startDate = v || null" />
      </t-form-item>
      <t-form-item label="有效期止">
        <t-date-picker :model-value="(form.endDate as any)" value-type="time-stamp" clearable @change="(v: any) => form.endDate = v || null" />
      </t-form-item>
      <t-form-item label="关联活动ID">
        <t-input-number :model-value="(form.taskTemplateId as any)" :min="1" theme="normal" placeholder="可空" @change="(v: any) => form.taskTemplateId = v ?? null" />
      </t-form-item>
      <t-form-item label="关联银行ID">
        <t-input-number :model-value="(form.bankId as any)" :min="1" theme="normal" placeholder="可空" @change="(v: any) => form.bankId = v ?? null" />
      </t-form-item>
      <t-form-item label="关联模板卡ID">
        <t-input-number :model-value="(form.bankCardTemplateId as any)" :min="1" theme="normal" placeholder="可空" @change="(v: any) => form.bankCardTemplateId = v ?? null" />
      </t-form-item>
      <t-form-item label="可见">
        <t-switch v-model="form.isVisible" />
      </t-form-item>
      <t-form-item label="档位">
        <div class="w-full flex flex-col gap-2">
          <div v-for="(tier, i) in form.tiers" :key="i" class="flex items-center gap-2">
            <t-input-number :model-value="(tier.minAmount as any)" placeholder="金额" theme="normal" style="width: 110px" @change="(v: any) => tier.minAmount = v ?? null" />
            <t-input-number :model-value="(tier.minCount as any)" placeholder="笔数" theme="normal" style="width: 100px" @change="(v: any) => tier.minCount = v ?? null" />
            <t-select v-model="tier.logic" :options="[{ label: '且', value: 'AND' }, { label: '或', value: 'OR' }]" style="width: 80px" />
            <t-input :model-value="(tier.description as any)" placeholder="说明" @change="(v: any) => tier.description = v || null" />
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
