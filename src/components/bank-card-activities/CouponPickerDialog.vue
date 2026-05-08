<script setup lang="ts">
import type { CouponCategoryDto, CouponCategoryTreeNode } from '@/types/couponCategory'
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { fetchCouponCategoryTree } from '@/composables/useCouponCategories'

interface PickedCoupon {
  couponId: number
  couponName: string
  couponLogoUrl: string | null
}

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', picked: PickedCoupon[]): void
}>()

const tree = ref<CouponCategoryTreeNode[]>([])
const loading = ref(false)
const activeFirstLevelId = ref<number | null>(null)
const selectedIds = ref<Set<number>>(new Set())

const activeBrands = computed<CouponCategoryDto[]>(() => {
  const node = tree.value.find(n => n.id === activeFirstLevelId.value)
  return node?.children?.filter(b => b.isVisible) ?? []
})

watch(() => props.visible, async (v) => {
  if (!v) {
    selectedIds.value = new Set()
    return
  }
  if (tree.value.length === 0) {
    loading.value = true
    try {
      tree.value = await fetchCouponCategoryTree()
      if (tree.value.length > 0)
        activeFirstLevelId.value = tree.value[0].id
    }
    catch (e: any) {
      MessagePlugin.error(e?.message ?? '加载卡券分类失败')
    }
    finally {
      loading.value = false
    }
  }
  // 重置选择
  selectedIds.value = new Set()
})

function selectFirstLevel(id: number) {
  activeFirstLevelId.value = id
}

function toggleBrand(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function confirm() {
  const selected: PickedCoupon[] = []
  // 保持点击顺序：按 tree 全量遍历，取已勾选
  for (const fl of tree.value) {
    for (const b of fl.children) {
      if (selectedIds.value.has(b.id)) {
        selected.push({ couponId: b.id, couponName: b.name, couponLogoUrl: b.logoUrl })
      }
    }
  }
  emit('confirm', selected)
  emit('update:visible', false)
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <t-dialog
    :visible="visible"
    header="选择关联卡券品牌"
    width="780px"
    :confirm-btn="{ content: `确认加入 ${selectedIds.size} 项`, disabled: selectedIds.size === 0 }"
    @update:visible="emit('update:visible', $event)"
    @confirm="confirm"
    @close="cancel"
  >
    <t-loading :loading="loading">
      <div class="flex gap-4 min-h-[420px]">
        <!-- 左：一级分类 nav -->
        <div class="w-32 flex-shrink-0 border-r border-gray-100 pr-3">
          <ul class="flex flex-col gap-1">
            <li
              v-for="node in tree" :key="node.id"
              class="px-3 py-2 rounded cursor-pointer text-sm transition-colors"
              :class="node.id === activeFirstLevelId
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'hover:bg-gray-50 text-gray-700'"
              @click="selectFirstLevel(node.id)"
            >
              {{ node.name }}
              <span class="text-xs text-gray-400 ml-1">{{ node.children.filter(c => c.isVisible).length }}</span>
            </li>
          </ul>
        </div>

        <!-- 右：二级品牌网格（checkbox） -->
        <div class="flex-1 min-w-0">
          <div v-if="activeBrands.length === 0" class="text-gray-400 text-sm py-12 text-center">
            该分类下暂无可见品牌
          </div>
          <div
            v-else
            class="grid gap-2"
            style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));"
          >
            <div
              v-for="brand in activeBrands" :key="brand.id"
              class="border rounded-lg p-2 cursor-pointer transition-colors flex flex-col items-center"
              :class="selectedIds.has(brand.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'"
              @click="toggleBrand(brand.id)"
            >
              <div class="w-12 h-12 flex items-center justify-center bg-gray-50 rounded mb-1 overflow-hidden">
                <img v-if="brand.logoUrl" :src="brand.logoUrl" class="w-full h-full object-contain">
                <span v-else class="text-xs text-gray-400">无</span>
              </div>
              <div class="text-xs text-center truncate w-full" :title="brand.name">
                {{ brand.name }}
              </div>
              <t-checkbox :checked="selectedIds.has(brand.id)" class="mt-1" @click.stop @change="toggleBrand(brand.id)" />
            </div>
          </div>
        </div>
      </div>
    </t-loading>
  </t-dialog>
</template>
