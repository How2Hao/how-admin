<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

type BankType =
  | 'STATE_OWNED'
  | 'JOINT_STOCK'
  | 'CITY_COMMERCIAL'
  | 'RURAL_COMMERCIAL'
  | 'RURAL_CREDIT_COOP'
  | 'JOINT_VENTURE'
  | 'VILLAGE'
  | 'PRIVATE'

const BANK_TYPE_OPTIONS: { label: string, value: BankType }[] = [
  { label: '国有银行', value: 'STATE_OWNED' },
  { label: '股份制银行', value: 'JOINT_STOCK' },
  { label: '城商行', value: 'CITY_COMMERCIAL' },
  { label: '农商行', value: 'RURAL_COMMERCIAL' },
  { label: '农村信用社', value: 'RURAL_CREDIT_COOP' },
  { label: '合资银行', value: 'JOINT_VENTURE' },
  { label: '村镇银行', value: 'VILLAGE' },
  { label: '民营银行', value: 'PRIVATE' },
]

const props = defineProps<{
  visible: boolean
  /** 当前选中的分类（弹窗打开时用作默认 bankType） */
  defaultBankType?: BankType | null
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'created'): void
}>()

interface Form {
  name: string
  code: string
  shortName: string
  pinyinIndex: string
  themeColor: string
  bankType: BankType | null
  isHot: boolean
  isVisible: boolean
}

function emptyForm(): Form {
  return {
    name: '',
    code: '',
    shortName: '',
    pinyinIndex: '',
    themeColor: '',
    bankType: null,
    isHot: false,
    isVisible: true,
  }
}

const form = ref<Form>(emptyForm())
const saving = ref(false)
const logoBase64 = ref<string>('')
const logoSizeKb = ref<number>(0)

const codeNormalized = computed(() => form.value.code.trim().toLowerCase())

function resetAll() {
  form.value = emptyForm()
  if (props.defaultBankType)
    form.value.bankType = props.defaultBankType
  logoBase64.value = ''
  logoSizeKb.value = 0
}

function onPickLogo(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    MessagePlugin.error('请选择图片文件')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    MessagePlugin.error('logo 不能超过 5MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    logoBase64.value = String(reader.result || '')
    logoSizeKb.value = Math.round(file.size / 1024)
  }
  reader.onerror = () => MessagePlugin.error('读取文件失败')
  reader.readAsDataURL(file)
  input.value = ''
}

function clearLogo() {
  logoBase64.value = ''
  logoSizeKb.value = 0
}

async function handleConfirm() {
  if (!form.value.name.trim()) {
    MessagePlugin.error('请填写银行名称')
    return
  }
  if (!codeNormalized.value) {
    MessagePlugin.error('请填写 code')
    return
  }
  if (!/^[a-z0-9_-]+$/i.test(codeNormalized.value)) {
    MessagePlugin.error('code 只允许字母数字下划线连字符')
    return
  }
  if (form.value.themeColor && !/^#[0-9A-F]{6}$/i.test(form.value.themeColor.trim())) {
    MessagePlugin.error('themeColor 需为 #RRGGBB 格式')
    return
  }

  saving.value = true
  try {
    await requestJson('/api/banks', {
      method: 'POST',
      body: {
        name: form.value.name.trim(),
        code: codeNormalized.value,
        shortName: form.value.shortName.trim() || null,
        pinyinIndex: form.value.pinyinIndex.trim() || null,
        themeColor: form.value.themeColor.trim() || null,
        bankType: form.value.bankType,
        isHot: form.value.isHot,
        isVisible: form.value.isVisible,
        logoBase64: logoBase64.value || null,
      },
    })
    MessagePlugin.success('已创建')
    emit('created')
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
    header="新增银行"
    width="560px"
    :confirm-btn="{ content: '确认添加', loading: saving }"
    :cancel-btn="{ content: '取消' }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
    @close="cancel"
  >
    <t-form label-width="100px">
      <t-form-item label="名称" required>
        <t-input v-model="form.name" placeholder="例如：中国工商银行" />
      </t-form-item>
      <t-form-item label="Code" required>
        <t-input
          v-model="form.code"
          placeholder="例如：icbc（小写英文，作为 logo 文件名）"
        />
      </t-form-item>
      <t-form-item label="简称">
        <t-input v-model="form.shortName" placeholder="例如：工商银行" />
      </t-form-item>
      <t-form-item label="拼音索引">
        <t-input v-model="form.pinyinIndex" placeholder="例如：zhongguogongshangyinhang" />
      </t-form-item>
      <t-form-item label="主题色">
        <t-input v-model="form.themeColor" placeholder="例如：#CF0106" />
      </t-form-item>
      <t-form-item label="分类">
        <t-select
          v-model="form.bankType"
          :options="BANK_TYPE_OPTIONS"
          placeholder="选择分类"
          clearable
        />
      </t-form-item>
      <t-form-item label="Logo">
        <div class="flex flex-col gap-2 w-full">
          <input
            type="file"
            accept="image/*"
            class="text-sm"
            @change="onPickLogo"
          >
          <span class="text-xs text-gray-500">
            上传后路径：<code>bank_logo/{{ codeNormalized || '{code}' }}.png</code>
          </span>
          <div v-if="logoBase64" class="flex items-end gap-3 border rounded p-3 bg-gray-50">
            <img :src="logoBase64" class="w-24 h-24 object-contain bg-white rounded">
            <div class="flex-1">
              <div class="text-xs text-gray-500">本地预览（{{ logoSizeKb }} KB），确认添加后才上传 OSS</div>
              <t-button size="small" variant="outline" @click="clearLogo">移除</t-button>
            </div>
          </div>
        </div>
      </t-form-item>
      <t-form-item label="热门">
        <t-switch v-model="form.isHot" />
      </t-form-item>
      <t-form-item label="对外可见">
        <t-switch v-model="form.isVisible" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>
