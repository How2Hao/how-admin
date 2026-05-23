<!-- src/components/plaza-custom-tabs/PlazaCustomTabDialog.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import TemplateMultiSelect from './TemplateMultiSelect.vue'

interface Row {
  id: number
  code: string
  name: string
  logo: string | null
  templateIds: number[]
  sortOrder: number
  isVisible: number
  startTime: number | null
  endTime: number | null
}

const props = defineProps<{ visible: boolean, row: Row | null }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

const form = ref({
  code: '',
  name: '',
  logo: '' as string | undefined,
  templateIds: [] as number[],
  isVisible: 1,
  startTime: undefined as number | undefined,
  endTime: undefined as number | undefined,
  sortOrder: 0,
})

const saving = ref(false)
const isEdit = computed(() => props.row != null)

const logoUploading = ref(false)
async function onPickLogo(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    MessagePlugin.error('请选择图片文件')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    MessagePlugin.error('logo 不能超过 2MB')
    return
  }
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = String(reader.result || '')
    logoUploading.value = true
    try {
      const r = await requestJson<{ url: string }>('/api/plazaCustomTabs/upload-logo', {
        method: 'POST',
        body: { imageBase64: base64 },
      })
      form.value.logo = r.url
      MessagePlugin.success('logo 上传完成')
    }
    catch (e: any) {
      MessagePlugin.error(e?.message ?? 'logo 上传失败')
    }
    finally {
      logoUploading.value = false
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function reset() {
  if (props.row) {
    form.value = {
      code: props.row.code,
      name: props.row.name,
      logo: props.row.logo ?? undefined,
      templateIds: [...props.row.templateIds],
      isVisible: props.row.isVisible,
      startTime: props.row.startTime ?? undefined,
      endTime: props.row.endTime ?? undefined,
      sortOrder: props.row.sortOrder,
    }
  }
  else {
    form.value = { code: '', name: '', logo: '', templateIds: [], isVisible: 1, startTime: undefined, endTime: undefined, sortOrder: 0 }
  }
}

watch(() => props.visible, (v) => { if (v) reset() })

async function handleSubmit() {
  saving.value = true
  try {
    if (isEdit.value) {
      await requestJson(`/api/plazaCustomTabs/${props.row!.id}`, {
        method: 'PUT',
        body: {
          name: form.value.name,
          logo: form.value.logo || null,
          templateIds: form.value.templateIds,
          isVisible: form.value.isVisible,
          startTime: form.value.startTime ?? null,
          endTime: form.value.endTime ?? null,
        },
      })
    }
    else {
      await requestJson('/api/plazaCustomTabs', {
        method: 'POST',
        body: {
          code: form.value.code,
          name: form.value.name,
          logo: form.value.logo || null,
          templateIds: form.value.templateIds,
          isVisible: form.value.isVisible,
          startTime: form.value.startTime ?? null,
          endTime: form.value.endTime ?? null,
          sortOrder: form.value.sortOrder,
        },
      })
    }
    MessagePlugin.success('保存成功')
    emit('saved')
    emit('update:visible', false)
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
    :header="isEdit ? '编辑 Tab' : '新增 Tab'"
    width="720px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleSubmit"
    @close="emit('update:visible', false)"
  >
    <t-form label-width="100px" class="pt-2">
      <t-form-item label="Code" :required-mark="!isEdit">
        <t-input
          v-model="form.code"
          :disabled="isEdit"
          placeholder="^[A-Z][A-Z0-9_]{1,31}$，如 SPRING_2026"
        />
      </t-form-item>
      <t-form-item label="名称" required-mark>
        <t-input v-model="form.name" :maxlength="20" />
      </t-form-item>
      <t-form-item label="Logo 图标">
        <div class="logo-uploader">
          <div class="logo-row">
            <input
              type="file"
              accept="image/*"
              class="text-sm"
              @change="onPickLogo"
            >
            <span v-if="logoUploading" class="logo-hint">上传中...</span>
          </div>
          <div v-if="form.logo" class="logo-preview">
            <img :src="form.logo" class="logo-img">
            <t-button size="small" variant="text" theme="danger" @click="form.logo = ''">移除</t-button>
          </div>
          <t-input v-model="form.logo" class="logo-url" placeholder="或直接填写已有 OSS URL（方形小图标，可选）" />
        </div>
      </t-form-item>
      <t-form-item label="关联活动">
        <TemplateMultiSelect v-model="form.templateIds" />
      </t-form-item>
      <t-form-item label="生效开始">
        <t-date-picker
          v-model="form.startTime"
          enable-time-picker
          mode="date"
          value-type="time-stamp"
          clearable
          placeholder="请选择"
        />
      </t-form-item>
      <t-form-item label="生效结束">
        <t-date-picker
          v-model="form.endTime"
          enable-time-picker
          mode="date"
          value-type="time-stamp"
          clearable
          placeholder="请选择"
        />
      </t-form-item>
      <t-form-item label="显示">
        <t-switch v-model="form.isVisible" :custom-value="[1, 0]" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped>
.logo-uploader {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.logo-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-hint {
  font-size: 12px;
  color: #94a3b8;
}
.logo-preview {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-img {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: contain;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.logo-url {
  width: 100%;
}
</style>
