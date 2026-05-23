<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface SelectOption { label: string, value: number }
interface Options {
  banks: SelectOption[]
  cardOrganizations: SelectOption[]
  cardLevels: SelectOption[]
}

const props = defineProps<{
  visible: boolean
  options: Options
  /** 当前选中的银行 id，作为新增表单的默认值 */
  defaultBankId?: string | null
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'created', payload: { id: number }): void
}>()

interface Form {
  cardName: string
  bankId: number | undefined
  cardOrganizationId: number | undefined
  cardLevelId: number | undefined
  /** 外部 URL 模式：直接存 cover URL 提交（不走 OSS） */
  coverUrl: string
  alias: string
  tags: string
  annualFeeType: string
  rigidFeeAmount: number | undefined
}

type CoverSourceMode = 'none' | 'file' | 'url'

const form = ref<Form>(emptyForm())
const saving = ref(false)
const coverMode = ref<CoverSourceMode>('none')

/** 本地选中的原始图片（FileReader 读出的 data URL）；尚未上传 OSS */
const localOriginal = ref<string>('')
const localOriginalKb = ref<number>(0)
/** 高清化后的本地预览（也是 data URL）；尚未上传 OSS */
const localEnhanced = ref<string>('')
const enhanceMeta = ref<{ width: number, height: number, kb: number } | null>(null)
const enhancing = ref(false)

const coverFinalBase64 = computed(() => localEnhanced.value || localOriginal.value)
const coverPreview = computed(() => coverFinalBase64.value || form.value.coverUrl || '')

function emptyForm(): Form {
  return {
    cardName: '',
    bankId: undefined,
    cardOrganizationId: undefined,
    cardLevelId: undefined,
    coverUrl: '',
    alias: '',
    tags: '',
    annualFeeType: '',
    rigidFeeAmount: undefined,
  }
}

function resetCoverState() {
  localOriginal.value = ''
  localOriginalKb.value = 0
  localEnhanced.value = ''
  enhanceMeta.value = null
  enhancing.value = false
}

function resetAll() {
  form.value = emptyForm()
  if (props.defaultBankId) {
    const id = Number(props.defaultBankId)
    if (Number.isInteger(id))
      form.value.bankId = id
  }
  coverMode.value = 'none'
  resetCoverState()
}

function onPickFile(ev: Event) {
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
    localOriginal.value = String(reader.result || '')
    localOriginalKb.value = Math.round(file.size / 1024)
    localEnhanced.value = ''
    enhanceMeta.value = null
  }
  reader.onerror = () => MessagePlugin.error('读取文件失败')
  reader.readAsDataURL(file)
  input.value = '' // 允许重复选同一文件
}

async function handleEnhance() {
  enhancing.value = true
  try {
    const payload = coverMode.value === 'file'
      ? { sourceBase64: localOriginal.value }
      : { sourceUrl: form.value.coverUrl.trim() }
    const res = await requestJson<{
      originalBase64: string
      enhancedBase64: string
      originalKb: number
      enhancedKb: number
      width: number
      height: number
    }>('/api/cardTemplates/enhance-cover', { method: 'POST', body: payload })
    // 外部 URL 模式高清化时，把原图也存到本地，转入"本地预览"流
    if (coverMode.value === 'url') {
      localOriginal.value = res.originalBase64
      localOriginalKb.value = res.originalKb
    }
    localEnhanced.value = res.enhancedBase64
    enhanceMeta.value = { width: res.width, height: res.height, kb: res.enhancedKb }
    MessagePlugin.success('高清化完成（本地预览，未上传）')
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '高清化失败')
  }
  finally {
    enhancing.value = false
  }
}

function discardEnhanced() {
  localEnhanced.value = ''
  enhanceMeta.value = null
}

async function handleConfirm() {
  if (!form.value.cardName.trim()) {
    MessagePlugin.error('请填写卡名')
    return
  }
  if (!form.value.bankId) {
    MessagePlugin.error('请选择银行')
    return
  }
  if (!form.value.cardOrganizationId) {
    MessagePlugin.error('请选择卡组织')
    return
  }

  // 优先用本地图（base64），其次 URL 模式下的纯 URL
  const enhancedBase64 = coverFinalBase64.value || null
  const coverUrl = (coverMode.value === 'url' && !localEnhanced.value && !localOriginal.value)
    ? form.value.coverUrl.trim() || null
    : null

  saving.value = true
  try {
    const res = await requestJson<{ id: number, cover: string | null }>('/api/cardTemplates', {
      method: 'POST',
      body: {
        cardName: form.value.cardName.trim(),
        bankId: form.value.bankId,
        cardOrganizationId: form.value.cardOrganizationId,
        cardLevelId: form.value.cardLevelId ?? null,
        cardType: '1',
        alias: form.value.alias || null,
        tags: form.value.tags || null,
        annualFeeType: form.value.annualFeeType || null,
        rigidFeeAmount: form.value.rigidFeeAmount ?? null,
        coverUrl,
        enhancedBase64,
      },
    })
    MessagePlugin.success(enhancedBase64 ? '已创建并上传 cover' : '已创建')
    emit('created', { id: res.id })
    emit('update:visible', false)
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '创建失败')
  }
  finally {
    saving.value = false
  }
}

function cancel() {
  emit('update:visible', false)
}

watch(() => props.visible, (v) => {
  if (v) resetAll()
})
</script>

<template>
  <t-dialog
    :visible="visible"
    header="新增卡片模板"
    width="640px"
    :confirm-btn="{ content: '确认添加', loading: saving }"
    :cancel-btn="{ content: '取消' }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
    @close="cancel"
  >
    <t-form label-width="100px">
      <t-form-item label="卡名" required>
        <t-input v-model="form.cardName" placeholder="例如：招商银行经典白金卡" />
      </t-form-item>
      <t-form-item label="所属银行" required>
        <t-select
          v-model="form.bankId"
          :options="options.banks"
          filterable
          placeholder="选择银行"
        />
      </t-form-item>
      <t-form-item label="卡组织" required>
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
          <t-radio-group v-model="coverMode" @change="resetCoverState">
            <t-radio value="none">无</t-radio>
            <t-radio value="file">本地上传</t-radio>
            <t-radio value="url">外部 URL</t-radio>
          </t-radio-group>

          <!-- 本地上传模式 -->
          <div v-if="coverMode === 'file'" class="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              class="text-sm"
              @change="onPickFile"
            >
            <span class="text-xs text-gray-500">
              图片仅本地预览，确认添加后才上传 OSS
            </span>
          </div>

          <!-- 外部 URL 模式 -->
          <div v-if="coverMode === 'url'">
            <t-input v-model="form.coverUrl" placeholder="https://..." />
          </div>

          <!-- 预览 + 高清化按钮 -->
          <div v-if="coverPreview" class="flex flex-col gap-2 border rounded p-3 bg-gray-50">
            <div class="grid gap-3" :class="localEnhanced ? 'grid-cols-2' : 'grid-cols-1'">
              <div class="flex flex-col gap-1">
                <div class="text-xs text-gray-500 text-center">
                  <template v-if="localEnhanced">原图 ({{ localOriginalKb }} KB)</template>
                  <template v-else>预览（{{ coverMode === 'file' ? '本地' : '外部 URL' }}）</template>
                </div>
                <img
                  :src="localOriginal || form.coverUrl"
                  class="w-full max-h-56 object-contain bg-white rounded"
                >
              </div>
              <div v-if="localEnhanced" class="flex flex-col gap-1">
                <div class="text-xs text-gray-500 text-center">
                  高清后 ({{ enhanceMeta?.width }}×{{ enhanceMeta?.height }} · {{ enhanceMeta?.kb }} KB)
                </div>
                <img :src="localEnhanced" class="w-full max-h-56 object-contain bg-white rounded">
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-1">
              <t-button
                v-if="!localEnhanced && (coverMode === 'file' ? !!localOriginal : !!form.coverUrl)"
                theme="primary"
                size="small"
                :loading="enhancing"
                @click="handleEnhance"
              >
                {{ enhancing ? '高清化中…' : '高清化（仅本地预览）' }}
              </t-button>
              <t-button
                v-if="localEnhanced"
                variant="outline"
                size="small"
                @click="discardEnhanced"
              >
                丢弃高清版本
              </t-button>
            </div>
          </div>
        </div>
      </t-form-item>

      <t-form-item label="别名">
        <t-input v-model="form.alias" placeholder="可选，用于内部识别" />
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
  </t-dialog>
</template>
