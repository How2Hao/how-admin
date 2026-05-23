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
  dataSource: string | null
}

type DataSource = 'flyert' | '51credit' | 'self'
const DATA_SOURCE_OPTIONS: { label: string, value: DataSource }[] = [
  { label: 'flyert（飞客）', value: 'flyert' },
  { label: '51credit（51 信用卡）', value: '51credit' },
  { label: 'self（手工录入）', value: 'self' },
]

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
  dataSource: DataSource | undefined
}

const form = ref<Form>(emptyForm())
const saving = ref(false)
const loading = ref(false)

type EnhanceStep = 'idle' | 'enhancing' | 'previewing' | 'uploading' | 'direct-uploading' | 'uploaded'
const enhanceStep = ref<EnhanceStep>('idle')
const originalPreview = ref<string>('')
const enhancedPreview = ref<string>('')
const uploadedUrl = ref<string>('')
const enhanceMeta = ref<{ originalKb: number, enhancedKb: number, width: number, height: number } | null>(null)
/** true 表示走"一键上传（不高清化）"路径；展示样式与高清流程不同 */
const directUploaded = ref(false)
/** true 表示当前 originalPreview 来自本地文件选择（不是从 URL 下载） */
const localPicked = ref(false)
/** 本地选文件的原始字节大小，用于在预览里显示 KB */
const localOriginalKb = ref(0)

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
  directUploaded.value = false
  localPicked.value = false
  localOriginalKb.value = 0
}

function onPickLocalFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    MessagePlugin.error('请选择图片文件')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    MessagePlugin.error('图片不能超过 20MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    originalPreview.value = String(reader.result || '')
    localOriginalKb.value = Math.round(file.size / 1024)
    enhancedPreview.value = ''
    enhanceMeta.value = null
    directUploaded.value = false
    localPicked.value = true
    enhanceStep.value = 'previewing'
  }
  reader.onerror = () => MessagePlugin.error('读取文件失败')
  reader.readAsDataURL(file)
  input.value = '' // 允许重复选同一文件
}

async function handleEnhance() {
  // 本地源：使用已有 base64 不再下载；远程源：用 form.cover 作为 sourceUrl
  const usingLocal = localPicked.value && !!originalPreview.value
  if (!usingLocal && !form.value.cover) {
    MessagePlugin.error('当前没有 cover URL，无法处理')
    return
  }
  const prevStep = enhanceStep.value
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
      body: usingLocal
        ? { sourceBase64: originalPreview.value }
        : { sourceUrl: form.value.cover },
    })
    if (!usingLocal) originalPreview.value = res.originalBase64
    enhancedPreview.value = res.enhancedBase64
    enhanceMeta.value = {
      originalKb: usingLocal ? localOriginalKb.value : res.originalKb,
      enhancedKb: res.enhancedKb,
      width: res.width,
      height: res.height,
    }
    enhanceStep.value = 'previewing'
  }
  catch (e: any) {
    // 本地源高清化失败时回到 previewing 单图状态，URL 源回到 idle
    enhanceStep.value = usingLocal ? 'previewing' : prevStep
    MessagePlugin.error(e?.message ?? '高清化失败')
  }
}

async function handleUpload() {
  if (!props.templateId) return
  // 优先上传高清版；如果还没高清化（本地选图直接上传场景），则上传 originalPreview
  const buf = enhancedPreview.value || originalPreview.value
  if (!buf) return
  const usingOriginalOnly = !enhancedPreview.value
  enhanceStep.value = 'uploading'
  try {
    const res = await requestJson<{ url: string }>(`/api/cardTemplates/${props.templateId}/upload-cover`, {
      method: 'POST',
      body: { enhancedBase64: buf },
    })
    uploadedUrl.value = res.url
    if (usingOriginalOnly) directUploaded.value = true
    enhanceStep.value = 'uploaded'
    MessagePlugin.success(usingOriginalOnly ? '已上传到 OSS（未高清化）' : '已上传到 OSS')
  }
  catch (e: any) {
    enhanceStep.value = 'previewing'
    MessagePlugin.error(e?.message ?? '上传失败')
  }
}

async function handleDirectUpload() {
  if (!props.templateId || !form.value.cover) {
    MessagePlugin.error('当前没有 cover URL，无法上传')
    return
  }
  enhanceStep.value = 'direct-uploading'
  try {
    const res = await requestJson<{ url: string }>(`/api/cardTemplates/${props.templateId}/upload-cover`, {
      method: 'POST',
      body: { sourceUrl: form.value.cover },
    })
    uploadedUrl.value = res.url
    directUploaded.value = true
    enhanceStep.value = 'uploaded'
    MessagePlugin.success('已上传到 OSS（未高清化）')
  }
  catch (e: any) {
    enhanceStep.value = 'idle'
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
    dataSource: undefined,
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
    const ds = detail.dataSource as DataSource | null
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
      dataSource: (ds === 'flyert' || ds === '51credit' || ds === 'self') ? ds : undefined,
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

            <div v-if="enhanceStep === 'idle'" class="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                class="text-sm"
                @change="onPickLocalFile"
              >
              <span class="text-xs text-gray-500">选择本地图片直接替换封面（仅本地预览，确认后再上传）</span>
            </div>

            <div v-if="form.cover && enhanceStep === 'idle'" class="flex gap-3 items-start flex-wrap">
              <img :src="form.cover" class="h-24 w-40 object-cover rounded border" >
              <template v-if="isExternalCover">
                <div class="flex flex-col gap-2">
                  <t-button theme="primary" @click="handleEnhance">
                    一键下载并高清化
                  </t-button>
                  <t-button variant="outline" @click="handleDirectUpload">
                    一键上传（不高清化）
                  </t-button>
                  <span class="text-xs text-gray-500">原图清晰够用时直接上传，省去 sharp 处理</span>
                </div>
              </template>
              <span v-else class="text-xs text-gray-500 self-center">已是 OSS 图片，无需处理</span>
            </div>

            <div v-if="enhanceStep === 'enhancing'" class="flex items-center gap-2 text-sm text-gray-500">
              <t-loading size="small" />
              <span>正在下载 + sharp 高清化…</span>
            </div>

            <div v-if="enhanceStep === 'direct-uploading'" class="flex items-center gap-2 text-sm text-gray-500">
              <t-loading size="small" />
              <span>正在下载并直传 OSS…</span>
            </div>

            <div v-if="enhanceStep === 'previewing' || enhanceStep === 'uploading' || (enhanceStep === 'uploaded' && !directUploaded)" class="border rounded p-3 bg-gray-50">
              <div class="grid gap-3" :class="enhancedPreview ? 'grid-cols-2' : 'grid-cols-1'">
                <div class="flex flex-col gap-1">
                  <div class="text-xs text-gray-500 text-center">
                    <template v-if="enhancedPreview">原图 ({{ enhanceMeta?.originalKb ?? localOriginalKb }} KB)</template>
                    <template v-else>{{ localPicked ? '本地预览' : '原图' }} ({{ localOriginalKb || enhanceMeta?.originalKb }} KB)</template>
                  </div>
                  <img :src="originalPreview" class="w-full max-h-64 object-contain bg-white rounded" >
                </div>
                <div v-if="enhancedPreview" class="flex flex-col gap-1">
                  <div class="text-xs text-gray-500 text-center">高清后 ({{ enhanceMeta?.width }}×{{ enhanceMeta?.height }} · {{ enhanceMeta?.enhancedKb }} KB)</div>
                  <img :src="enhancedPreview" class="w-full max-h-64 object-contain bg-white rounded" >
                </div>
              </div>

              <div class="flex justify-end gap-2 mt-3">
                <template v-if="enhanceStep === 'previewing'">
                  <t-button variant="outline" @click="handleCancelEnhance">取消</t-button>
                  <t-button v-if="!enhancedPreview" variant="outline" @click="handleEnhance">高清化</t-button>
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

            <!-- 直传路径成功后的简化预览（不与高清流程合并展示，避免空 base64 占位） -->
            <div v-if="enhanceStep === 'uploaded' && directUploaded" class="border rounded p-3 bg-gray-50">
              <div class="text-xs text-gray-500 mb-2 text-center">已上传到 OSS（未高清化）</div>
              <img :src="uploadedUrl" class="w-full max-h-64 object-contain bg-white rounded">
              <div class="flex justify-end gap-2 mt-3">
                <div class="text-xs text-gray-500 self-center mr-2 truncate max-w-md" :title="uploadedUrl">{{ uploadedUrl }}</div>
                <t-button variant="outline" @click="handleCancelEnhance">取消</t-button>
                <t-button theme="success" @click="handleConfirmReplace">确认替换</t-button>
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
        <t-form-item label="数据来源">
          <t-select
            v-model="form.dataSource"
            :options="DATA_SOURCE_OPTIONS"
            placeholder="选择来源"
          />
        </t-form-item>
      </t-form>
    </t-loading>
  </t-dialog>
</template>
