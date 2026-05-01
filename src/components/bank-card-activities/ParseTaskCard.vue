<script setup lang="ts">
import type { CreateBankCardActivityResponse, ParseBankCardActivityResponse, SelectOption } from '@/types/bankCardActivities'
import { MessagePlugin } from 'tdesign-vue-next'
import { ensureCurrentOption, useBankCardActivityForm } from '@/composables/useBankCardActivityForm'
import { requestJson } from '@/composables/useJsonRequest'
import BankCardActivityForm from '@/components/bank-card-activities/BankCardActivityForm.vue'

export type ParseTaskStatus = 'empty' | 'parsing' | 'parsed' | 'saving' | 'saved' | 'error'
export type InputType = 'url' | 'image'

const props = defineProps<{
  taskId: string
  taskIndex: number
  bankOptions: SelectOption[]
  bankCardTemplateOptions: SelectOption[]
  regionOptions: SelectOption[]
  benefitUsagePlatformOptions: SelectOption[]
  activityCategoryOptions: SelectOption[]
  cardOrganizationOptions: SelectOption[]
  benefitCategoryOptions: SelectOption[]
  benefitPayPlatformOptions: SelectOption[]
  bankCardTypeOptions: SelectOption[]
  regionMatchStrategyOptions: SelectOption[]
  repeatTypeOptions: SelectOption[]
}>()

const emit = defineEmits<{
  remove: [taskId: string]
  statusChange: [taskId: string, status: ParseTaskStatus]
  searchBanks: [keyword: string]
  searchBankCardTemplates: [keyword: string]
  searchRegions: [keyword: string]
  searchBenefitUsagePlatforms: [keyword: string]
  searchActivityCategories: [keyword: string]
  resolveSelections: [parsed: ParseBankCardActivityResponse]
}>()

const { form, fillForm, buildPayload, validateForm, cleanupRepeatFields } = useBankCardActivityForm()

const status = ref<ParseTaskStatus>('empty')
const errorMsg = ref('')
const savedId = ref<number | null>(null)

watch(status, (s) => {
  emit('statusChange', props.taskId, s)
}, { immediate: true })

const inputType = ref<InputType>('url')
const url = ref('')
const text = ref('')

interface UploadedImage { url: string, thumbBase64: string }
const images = ref<UploadedImage[]>([])
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const previewedUrl = ref('')
const iframeLoaded = ref(false)
const previewFrameUrl = computed(() =>
  previewedUrl.value ? `/api/bankCardActivities/web/preview?url=${encodeURIComponent(previewedUrl.value)}` : '')

const hasInput = computed(() => {
  if (inputType.value === 'url')
    return Boolean(url.value.trim() || text.value.trim())
  return Boolean(images.value.length || text.value.trim())
})
const inputsLocked = computed(() => status.value === 'parsing' || status.value === 'saving')

const bankSelectOptions = computed(() =>
  ensureCurrentOption(props.bankOptions, form.bankId, value => `当前银行 ID: ${value}`))
const bankCardTemplateSelectOptions = computed(() =>
  ensureCurrentOption(props.bankCardTemplateOptions, form.bankCardTemplateId, value => `当前卡模板 ID: ${value}`))
const regionSelectOptions = computed(() =>
  ensureCurrentOption(props.regionOptions, form.regionCode, value => `当前区域代码: ${value}`))
const benefitUsagePlatformSelectOptions = computed(() =>
  ensureCurrentOption(props.benefitUsagePlatformOptions, form.benefitUsagePlatformId, value => `当前使用平台 ID: ${value}`))
const activityCategorySelectOptions = computed(() =>
  ensureCurrentOption(props.activityCategoryOptions, form.activityCategoryId, value => `当前活动分类 ID: ${value}`))

const statusBadge = computed<{ label: string, theme: 'primary' | 'success' | 'warning' | 'danger' | 'default' }>(() => {
  switch (status.value) {
    case 'empty': return { label: '待解析', theme: 'default' }
    case 'parsing': return { label: '解析中', theme: 'primary' }
    case 'parsed': return { label: '待保存', theme: 'warning' }
    case 'saving': return { label: '保存中', theme: 'primary' }
    case 'saved': return { label: '已保存', theme: 'success' }
    case 'error': return { label: '失败', theme: 'danger' }
  }
})

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

async function uploadOne(dataUrl: string) {
  const res = await requestJson<{ url: string }>('/api/bankCardActivities/web/uploadParseImage', {
    method: 'POST',
    body: { base64: dataUrl },
  })
  images.value.push({ url: res.url, thumbBase64: dataUrl })
}

async function handleFiles(files: FileList | File[] | null) {
  if (!files) return
  const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
  if (arr.length === 0) return
  uploading.value = true
  try {
    for (const f of arr) {
      const dataUrl = await fileToDataUrl(f)
      try { await uploadOne(dataUrl) }
      catch (e: any) { MessagePlugin.error(`上传失败：${e?.message ?? e}`) }
    }
  }
  finally { uploading.value = false }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) files.push(f)
    }
  }
  if (files.length) {
    e.preventDefault()
    handleFiles(files)
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  handleFiles(e.dataTransfer?.files ?? null)
}

function triggerPick() {
  if (!inputsLocked.value) fileInput.value?.click()
}

function removeImage(idx: number) {
  if (!inputsLocked.value) images.value.splice(idx, 1)
}

async function handleParse() {
  if (!hasInput.value) {
    MessagePlugin.warning(inputType.value === 'url' ? '请先填写 URL' : '请先添加图片')
    return
  }
  status.value = 'parsing'
  errorMsg.value = ''
  iframeLoaded.value = false
  if (inputType.value === 'url')
    previewedUrl.value = url.value.trim()
  else
    previewedUrl.value = ''
  try {
    const body: { url?: string, imageUrls?: string[], text?: string } = { text: text.value.trim() }
    if (inputType.value === 'url')
      body.url = url.value.trim()
    else
      body.imageUrls = images.value.map(i => i.url)
    const parsed = await requestJson<ParseBankCardActivityResponse>('/api/bankCardActivities/web/parse', {
      method: 'POST',
      body,
    })
    fillForm(parsed)
    emit('resolveSelections', parsed)
    status.value = 'parsed'
  }
  catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message ?? '解析失败'
  }
}

async function handleSave() {
  const validationError = validateForm()
  if (validationError) {
    MessagePlugin.warning(validationError)
    return
  }
  status.value = 'saving'
  try {
    const result = await requestJson<CreateBankCardActivityResponse>('/api/bankCardActivities/web/create', {
      method: 'POST',
      body: buildPayload(),
    })
    savedId.value = result.id
    status.value = 'saved'
    MessagePlugin.success(`已保存，ID：${result.id}`)
  }
  catch (e: any) {
    status.value = 'parsed'
    MessagePlugin.error(e?.message ?? '保存失败')
  }
}
</script>

<template>
  <t-card class="task-card">
    <div class="flex items-center gap-2 pb-2 border-b">
      <span class="text-sm font-medium text-gray-700">#{{ taskIndex }}</span>
      <t-tag size="small" :theme="statusBadge.theme === 'default' ? 'default' : statusBadge.theme" variant="light">
        {{ statusBadge.label }}
      </t-tag>
      <span v-if="savedId" class="text-xs text-green-600">ID:{{ savedId }}</span>
      <div class="flex-1" />
      <t-radio-group v-model="inputType" size="small" variant="default-filled" :disabled="inputsLocked">
        <t-radio-button value="url">网址</t-radio-button>
        <t-radio-button value="image">图片</t-radio-button>
      </t-radio-group>
      <t-button size="small" variant="text" theme="danger" @click="emit('remove', taskId)">移除</t-button>
    </div>

    <div v-if="status === 'error'" class="text-xs text-red-500 mt-2 px-2 py-1 bg-red-50 rounded">
      {{ errorMsg }}
    </div>

    <div class="task-body grid gap-3 mt-2">
      <!-- 左：输入源 -->
      <div class="task-col flex flex-col gap-2 border rounded p-2 bg-gray-50/50 min-h-0">
        <!-- URL 模式：URL 输入 → iframe 预览 → textarea -->
        <template v-if="inputType === 'url'">
          <t-input
            v-model="url"
            placeholder="网页 URL"
            clearable
            size="small"
            :disabled="inputsLocked"
          />
          <div class="flex-1 min-h-0 border rounded overflow-hidden bg-white relative">
            <template v-if="previewedUrl">
              <div
                v-if="!iframeLoaded"
                class="absolute inset-0 z-1 bg-white/80 flex items-center justify-center text-xs text-gray-500 backdrop-blur-sm"
              >
                正在加载预览…
              </div>
              <iframe
                :src="previewFrameUrl"
                class="w-full h-full border-0 bg-white"
                referrerpolicy="no-referrer"
                @load="iframeLoaded = true"
              />
            </template>
            <div v-else class="h-full flex items-center justify-center text-xs text-gray-400 px-3 text-center">
              输入 URL 后点「解析」<br>这里会展示网页预览
            </div>
          </div>
        </template>

        <!-- 图片模式：dropzone（含缩略图） → textarea -->
        <template v-else>
          <div
            class="flex-1 min-h-0 border-2 border-dashed rounded p-2 cursor-pointer hover:bg-white transition-colors overflow-y-auto"
            :class="(inputsLocked || uploading) ? 'pointer-events-none opacity-60' : ''"
            tabindex="0"
            @click="triggerPick"
            @paste="handlePaste"
            @dragover.prevent
            @drop="handleDrop"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="(e) => handleFiles((e.target as HTMLInputElement).files)"
            >
            <div v-if="!images.length" class="h-full flex items-center justify-center text-xs text-gray-400 text-center">
              点击 / 粘贴 / 拖入图片
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <div v-for="(img, idx) in images" :key="img.url" class="relative">
                <img :src="img.thumbBase64" class="h-14 w-14 object-cover rounded border" >
                <button
                  type="button"
                  class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none hover:bg-red-600"
                  @click.stop="removeImage(idx)"
                >×</button>
              </div>
            </div>
            <div v-if="uploading" class="mt-2 text-xs text-gray-500 text-center">上传中…</div>
          </div>
        </template>

        <t-textarea
          v-model="text"
          placeholder="补充文本（可选）"
          :autosize="{ minRows: 2, maxRows: 3 }"
          :disabled="inputsLocked"
        />

        <t-button
          theme="primary"
          size="small"
          block
          :loading="status === 'parsing'"
          :disabled="!hasInput || inputsLocked || uploading"
          @click="handleParse"
        >
          {{ status === 'parsed' || status === 'saved' ? '重新解析' : '解析' }}
        </t-button>
      </div>

      <!-- 右：设置项 -->
      <div class="task-col overflow-y-auto pr-1 relative min-h-0">
        <div
          v-if="status === 'empty'"
          class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded"
        >
          <div class="text-xs text-gray-400 text-center px-4">
            点「解析」后<br>AI 自动填充
          </div>
        </div>
        <div
          v-if="status === 'parsing'"
          class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded"
        >
          <t-loading size="small" text="AI 解析中…" />
        </div>

        <BankCardActivityForm
          v-model:form="form"
          :bank-select-options="bankSelectOptions"
          :bank-card-template-select-options="bankCardTemplateSelectOptions"
          :region-select-options="regionSelectOptions"
          :benefit-usage-platform-select-options="benefitUsagePlatformSelectOptions"
          :activity-category-select-options="activityCategorySelectOptions"
          :card-organization-options="cardOrganizationOptions"
          :benefit-category-options="benefitCategoryOptions"
          :benefit-pay-platform-options="benefitPayPlatformOptions"
          :bank-card-type-options="bankCardTypeOptions"
          :region-match-strategy-options="regionMatchStrategyOptions"
          :repeat-type-options="repeatTypeOptions"
          @search-banks="(kw) => emit('searchBanks', kw)"
          @search-bank-card-templates="(kw) => emit('searchBankCardTemplates', kw)"
          @search-regions="(kw) => emit('searchRegions', kw)"
          @search-benefit-usage-platforms="(kw) => emit('searchBenefitUsagePlatforms', kw)"
          @search-activity-categories="(kw) => emit('searchActivityCategories', kw)"
          @repeat-type-change="cleanupRepeatFields"
        />

        <div
          v-if="status === 'parsed' || status === 'saving' || status === 'saved'"
          class="sticky bottom-0 bg-white pt-2 pb-1 -mx-1 px-1 border-t flex justify-end"
        >
          <t-button
            size="small"
            theme="primary"
            :loading="status === 'saving'"
            :disabled="status === 'saved'"
            @click="handleSave"
          >
            {{ status === 'saved' ? '已保存' : '保存' }}
          </t-button>
        </div>
      </div>
    </div>
  </t-card>
</template>

<style scoped>
.task-body {
  /* iPhone 13 高度 844 - header/border 大约 100 = 744，圆整到 720 */
  height: 720px;
  /* 左侧固定 ~ iPhone 宽度（390px + 内边距），右侧表单自适应剩余空间 */
  grid-template-columns: 410px minmax(0, 1fr);
}

.task-col {
  min-height: 0;
}

@media (max-width: 1024px) {
  .task-body {
    grid-template-columns: 1fr;
    height: auto;
  }
  .task-col {
    max-height: 600px;
  }
}
</style>
