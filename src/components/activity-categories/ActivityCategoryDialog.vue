<!-- src/components/activity-categories/ActivityCategoryDialog.vue -->
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface Row {
  id: number
  code: string
  name: string
  parentId: number | null
  icon: string | null
  sortOrder: number
  createdAt: string | null
}

const props = defineProps<{
  visible: boolean
  editingRow: Row | null
  parentOptions: { label: string, value: number }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

interface Form {
  code: string
  name: string
  parentId: number | null
  sortOrder: number
}

const form = ref<Form>({ code: '', name: '', parentId: null, sortOrder: 0 })
const saving = ref(false)
const iconPreview = ref('')
const iconBase64 = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const isEdit = computed(() => props.editingRow !== null)

function reset() {
  form.value = { code: '', name: '', parentId: null, sortOrder: 0 }
  iconPreview.value = ''
  iconBase64.value = ''
}

watch(() => props.visible, (v) => {
  if (!v) {
    reset()
    return
  }
  if (!props.editingRow) {
    reset()
    return
  }
  form.value = {
    code: props.editingRow.code,
    name: props.editingRow.name,
    parentId: props.editingRow.parentId,
    sortOrder: props.editingRow.sortOrder,
  }
  iconPreview.value = props.editingRow.icon ?? ''
  iconBase64.value = ''
})

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  if (file.size > 5 * 1024 * 1024) {
    MessagePlugin.error('图片不能超过 5MB')
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    iconBase64.value = result
    iconPreview.value = result
  }
  reader.readAsDataURL(file)
  if (fileInputRef.value)
    fileInputRef.value.value = ''
}

async function save() {
  if (!form.value.code.trim()) {
    MessagePlugin.error('code 不能为空')
    return
  }
  if (!form.value.name.trim()) {
    MessagePlugin.error('name 不能为空')
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      code: form.value.code.trim(),
      name: form.value.name.trim(),
      parentId: form.value.parentId,
      sortOrder: form.value.sortOrder,
    }
    if (iconBase64.value)
      body.iconBase64 = iconBase64.value

    if (isEdit.value) {
      await requestJson(`/api/activityCategories/${props.editingRow!.id}`, { method: 'PUT', body })
    }
    else {
      await requestJson('/api/activityCategories', { method: 'POST', body })
    }
    MessagePlugin.success('保存成功')
    emit('update:visible', false)
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
    :header="isEdit ? '编辑活动分类' : '新增活动分类'"
    width="480px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="save"
    @close="cancel"
  >
    <t-loading :loading="saving">
      <t-form label-width="80px" class="pt-2">
      <t-form-item label="Code">
        <t-input v-model="form.code" placeholder="如 dining" :maxlength="32" />
      </t-form-item>
      <t-form-item label="名称">
        <t-input v-model="form.name" placeholder="如 餐饮" :maxlength="50" />
      </t-form-item>
      <t-form-item label="父分类">
        <t-select
          v-model="form.parentId"
          :options="editingRow ? parentOptions.filter(o => o.value !== editingRow.id) : parentOptions"
          placeholder="留空表示顶级分类"
          clearable
          style="width: 240px"
        />
      </t-form-item>
      <t-form-item label="排序">
        <t-input-number v-model="form.sortOrder" :min="0" style="width: 120px" />
      </t-form-item>
      <t-form-item label="图标">
        <div
          class="relative w-16 h-16 border-2 border-dashed rounded cursor-pointer flex items-center justify-center overflow-hidden"
          :class="iconPreview ? 'border-gray-200' : 'border-gray-300'"
          @click="triggerFileInput"
        >
          <img v-if="iconPreview" :src="iconPreview" class="w-full h-full object-contain">
          <span v-else class="text-xs text-gray-400 text-center leading-tight px-1">点击上传</span>
          <div
            v-if="iconPreview"
            class="absolute inset-0 bg-black bg-opacity-40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <span class="text-white text-xs">更换</span>
          </div>
          <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileChange">
        </div>
        <span class="ml-3 text-xs text-gray-400 self-end">PNG / JPG，≤ 5MB</span>
      </t-form-item>
      </t-form>
    </t-loading>
  </t-dialog>
</template>
