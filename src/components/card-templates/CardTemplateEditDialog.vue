<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface SelectOption { label: string, value: number }

interface Options {
  banks: SelectOption[]
  cardOrganizations: SelectOption[]
  cardLevels: SelectOption[]
}

interface Detail {
  id: number
  bankId: string
  cardName: string
  cardType: string
  cardLevel: string | null
  cardOrganization: string
  cover: string | null
  alias: string | null
  tags: string | null
  annualFeeType: string | null
  rigidFeeAmount: number | null
}

const props = defineProps<{
  visible: boolean
  templateId: number | null
  options: Options
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

interface Form {
  cardName: string
  bankId: number | undefined
  cardOrganizationId: number | undefined
  cardLevelId: number | undefined
  cover: string
  alias: string
  tags: string
  annualFeeType: string
  rigidFeeAmount: number | undefined
}

const form = ref<Form>(emptyForm())
const saving = ref(false)
const loading = ref(false)

type EnhanceStep = 'idle' | 'enhancing' | 'previewing' | 'uploading' | 'uploaded'
const enhanceStep = ref<EnhanceStep>('idle')
const originalPreview = ref<string>('')
const enhancedPreview = ref<string>('')
const uploadedUrl = ref<string>('')
const enhanceMeta = ref<{ originalKb: number, enhancedKb: number, width: number, height: number } | null>(null)

const isExternalCover = computed(() => {
  const c = form.value.cover
  if (!c)
    return false
  return !c.includes('aliyuncs.com') && !c.includes('how2hao-static')
})

function resetEnhanceState() {
  enhanceStep.value = 'idle'
  originalPreview.value = ''
  enhancedPreview.value = ''
  uploadedUrl.value = ''
  enhanceMeta.value = null
}

async function handleEnhance() {
  if (!form.value.cover) {
    MessagePlugin.error('当前没有 cover URL，无法处理')
    return
  }
  enhanceStep.value = 'enhancing'
  try {
    const res = await requestJson<{
      originalBase64: string
      enhancedBase64: string
      originalKb: number
      enhancedKb: number
      width: number
      height: number
    }>('/api/cardTemplates/enhance-cover', {
      method: 'POST',
      body: { sourceUrl: form.value.cover },
    })
    originalPreview.value = res.originalBase64
    enhancedPreview.value = res.enhancedBase64
    enhanceMeta.value = { originalKb: res.originalKb, enhancedKb: res.enhancedKb, width: res.width, height: res.height }
    enhanceStep.value = 'previewing'
  }
  catch (e: any) {
    enhanceStep.value = 'idle'
    MessagePlugin.error(e?.message ?? '高清化失败')
  }
}

async function handleUpload() {
  if (!props.templateId || !enhancedPreview.value)
    return
  enhanceStep.value = 'uploading'
  try {
    const res = await requestJson<{ url: string }>(`/api/cardTemplates/${props.templateId}/upload-cover`, {
      method: 'POST',
      body: { enhancedBase64: enhancedPreview.value },
    })
    uploadedUrl.value = res.url
    enhanceStep.value = 'uploaded'
    MessagePlugin.success('已上传到 OSS')
  }
  catch (e: any) {
    enhanceStep.value = 'previewing'
    MessagePlugin.error(e?.message ?? '上传失败')
  }
}

function handleConfirmReplace() {
  if (!uploadedUrl.value)
    return
  form.value.cover = uploadedUrl.value
  resetEnhanceState()
  MessagePlugin.success('cover 已替换，记得点保存')
}

function handleCancelEnhance() {
  resetEnhanceState()
}

function emptyForm(): Form {
  return {
    cardName: '',
    bankId: undefined,
    cardOrganizationId: undefined,
    cardLevelId: undefined,
    cover: '',
    alias: '',
    tags: '',
    annualFeeType: '',
    rigidFeeAmount: undefined,
  }
}

function toIntOrUndef(s: string | null | undefined): number | undefined {
  if (s == null || s === '')
    return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

watch(() => props.visible, async (v) => {
  if (!v) {
    form.value = emptyForm()
    resetEnhanceState()
    return
  }
  if (!props.templateId)
    return
  loading.value = true
  try {
    const detail = await requestJson<Detail>(`/api/cardTemplates/${props.templateId}`)
    form.value = {
      cardName: detail.cardName ?? '',
      bankId: toIntOrUndef(detail.bankId),
      cardOrganizationId: toIntOrUndef(detail.cardOrganization),
      cardLevelId: toIntOrUndef(detail.cardLevel),
      cover: detail.cover ?? '',
      alias: detail.alias ?? '',
      tags: detail.tags ?? '',
      annualFeeType: detail.annualFeeType ?? '',
      rigidFeeAmount: detail.rigidFeeAmount ?? undefined,
    }
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载详情失败')
  }
  finally {
    loading.value = false
  }
})

async function save() {
  if (!props.templateId)
    return
  saving.value = true
  try {
    await requestJson(`/api/cardTemplates/${props.templateId}`, {
      method: 'PUT',
      body: form.value,
    })
    MessagePlugin.success('已保存')
    emit('saved')
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '保存失败')
  }
  finally {
    saving.value = false
  }
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <t-dialog
    :visible="visible"
    header="编辑卡片模板"
    width="640px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="save"
    @close="cancel"
  >
    <t-loading :loading="loading">
      <t-form label-width="100px">
        <t-form-item label="卡名">
          <t-input v-model="form.cardName" />
        </t-form-item>
        <t-form-item label="所属银行">
          <t-select
            v-model="form.bankId"
            :options="options.banks"
            filterable
            placeholder="选择银行"
          />
        </t-form-item>
        <t-form-item label="卡组织">
          <t-select
            v-model="form.cardOrganizationId"
            :options="options.cardOrganizations"
            filterable
            placeholder="选择卡组织"
          />
        </t-form-item>
        <t-form-item label="卡等级">
          <t-select
            v-model="form.cardLevelId"
            :options="options.cardLevels"
            filterable
            clearable
            placeholder="选择卡等级"
          />
        </t-form-item>
        <t-form-item label="卡面图">
          <div class="flex flex-col gap-3 w-full">
            <t-input v-model="form.cover" placeholder="https://..." />

            <div v-if="form.cover && enhanceStep === 'idle'" class="flex gap-3 items-start">
              <img :src="form.cover" class="h-24 w-40 object-cover rounded border" >
              <t-button v-if="isExternalCover" theme="primary" @click="handleEnhance">
                一键下载并高清化
              </t-button>
              <span v-else class="text-xs text-gray-500 self-center">已是 OSS 图片，无需处理</span>
            </div>

            <div v-if="enhanceStep === 'enhancing'" class="flex items-center gap-2 text-sm text-gray-500">
              <t-loading size="small" />
              <span>正在下载 + sharp 高清化…</span>
            </div>

            <div v-if="enhanceStep === 'previewing' || enhanceStep === 'uploading' || enhanceStep === 'uploaded'" class="border rounded p-3 bg-gray-50">
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <div class="text-xs text-gray-500 text-center">原图 ({{ enhanceMeta?.originalKb }} KB)</div>
                  <img :src="originalPreview" class="w-full max-h-64 object-contain bg-white rounded" >
                </div>
                <div class="flex flex-col gap-1">
                  <div class="text-xs text-gray-500 text-center">高清后 ({{ enhanceMeta?.width }}×{{ enhanceMeta?.height }} · {{ enhanceMeta?.enhancedKb }} KB)</div>
                  <img :src="enhancedPreview" class="w-full max-h-64 object-contain bg-white rounded" >
                </div>
              </div>

              <div class="flex justify-end gap-2 mt-3">
                <template v-if="enhanceStep === 'previewing'">
                  <t-button variant="outline" @click="handleCancelEnhance">取消</t-button>
                  <t-button theme="primary" @click="handleUpload">上传到 OSS</t-button>
                </template>
                <template v-else-if="enhanceStep === 'uploading'">
                  <t-button theme="primary" loading>上传中…</t-button>
                </template>
                <template v-else-if="enhanceStep === 'uploaded'">
                  <div class="text-xs text-gray-500 self-center mr-2 truncate max-w-md" :title="uploadedUrl">已上传：{{ uploadedUrl }}</div>
                  <t-button variant="outline" @click="handleCancelEnhance">取消</t-button>
                  <t-button theme="success" @click="handleConfirmReplace">确认替换</t-button>
                </template>
              </div>
            </div>
          </div>
        </t-form-item>
        <t-form-item label="别名">
          <t-input v-model="form.alias" />
        </t-form-item>
        <t-form-item label="标签 (JSON)">
          <t-input v-model="form.tags" placeholder='例如：["免年费","返现"]' />
        </t-form-item>
        <t-form-item label="年费类型">
          <t-input v-model="form.annualFeeType" />
        </t-form-item>
        <t-form-item label="固定年费">
          <t-input-number v-model="form.rigidFeeAmount" :min="0" />
        </t-form-item>
      </t-form>
    </t-loading>
  </t-dialog>
</template>
