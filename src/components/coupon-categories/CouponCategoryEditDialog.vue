<script setup lang="ts">
import type { CouponCategoryDto } from '@/types/couponCategory'
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import {
  createCouponCategory,
  updateCouponCategory,
} from '@/composables/useCouponCategories'

const props = defineProps<{
  visible: boolean
  /** 编辑现有二级品牌；为空则表示在 currentParentId 下新增 */
  editingRow: CouponCategoryDto | null
  currentParentId: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

interface Form {
  name: string
  sortOrder: number
  isVisible: boolean
  logoUrl: string
}

const form = ref<Form>({ name: '', sortOrder: 0, isVisible: true, logoUrl: '' })
const saving = ref(false)

const isEdit = computed(() => props.editingRow !== null)

function reset() {
  form.value = { name: '', sortOrder: 0, isVisible: true, logoUrl: '' }
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
    name: props.editingRow.name,
    sortOrder: props.editingRow.sortOrder,
    isVisible: props.editingRow.isVisible,
    logoUrl: props.editingRow.logoUrl ?? '',
  }
})

async function save() {
  const name = form.value.name.trim()
  if (!name) {
    MessagePlugin.error('name 不能为空')
    return
  }
  saving.value = true
  try {
    const logoUrl = form.value.logoUrl.trim() || null
    if (isEdit.value) {
      await updateCouponCategory(props.editingRow!.id, {
        name,
        sortOrder: form.value.sortOrder,
        isVisible: form.value.isVisible,
        logoUrl,
      })
    }
    else {
      await createCouponCategory({
        parentId: props.currentParentId,
        name,
        sortOrder: form.value.sortOrder,
        logoUrl,
      })
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
    :header="isEdit ? '编辑卡券品牌' : '新增卡券品牌'"
    width="480px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="save"
    @close="cancel"
  >
    <t-loading :loading="saving">
      <t-form label-width="80px" class="pt-2">
        <t-form-item label="名称">
          <t-input v-model="form.name" placeholder="如 星巴克" :maxlength="64" />
        </t-form-item>
        <t-form-item label="排序">
          <t-input-number v-model="form.sortOrder" :min="0" style="width: 120px" />
        </t-form-item>
        <t-form-item v-if="isEdit" label="是否显示">
          <t-switch v-model="form.isVisible" />
        </t-form-item>
        <t-form-item label="Logo URL">
          <div class="flex items-start gap-3 w-full">
            <t-input
              v-model="form.logoUrl"
              placeholder="https://how2hao-static.oss-cn-beijing.aliyuncs.com/coupon-category/..."
              class="flex-1"
            />
            <div
              class="w-12 h-12 border border-gray-200 rounded flex items-center justify-center overflow-hidden flex-shrink-0 bg-gray-50"
            >
              <img v-if="form.logoUrl" :src="form.logoUrl" class="w-full h-full object-contain">
              <span v-else class="text-xs text-gray-400">预览</span>
            </div>
          </div>
        </t-form-item>
      </t-form>
    </t-loading>
  </t-dialog>
</template>
