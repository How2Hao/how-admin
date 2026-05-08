<script setup lang="ts">
import type { CouponCategoryDto, CouponCategoryTreeNode } from '@/types/couponCategory'
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref } from 'vue'
import CouponCategoryEditDialog from '@/components/coupon-categories/CouponCategoryEditDialog.vue'
import { fetchCouponCategoryTree, updateCouponCategory } from '@/composables/useCouponCategories'

const tree = ref<CouponCategoryTreeNode[]>([])
const loading = ref(false)
const activeFirstLevelId = ref<number | null>(null)

const dialogVisible = ref(false)
const editingRow = ref<CouponCategoryDto | null>(null)

const activeFirstLevel = computed(() =>
  tree.value.find(n => n.id === activeFirstLevelId.value) ?? null,
)

const brands = computed<CouponCategoryDto[]>(() => activeFirstLevel.value?.children ?? [])

async function load() {
  loading.value = true
  try {
    tree.value = await fetchCouponCategoryTree()
    if (activeFirstLevelId.value == null && tree.value.length > 0)
      activeFirstLevelId.value = tree.value[0].id
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

function selectFirstLevel(id: number) {
  activeFirstLevelId.value = id
}

function openAdd() {
  if (activeFirstLevelId.value == null) {
    MessagePlugin.warning('请先选择左侧一级分类')
    return
  }
  editingRow.value = null
  dialogVisible.value = true
}

function openEdit(row: CouponCategoryDto) {
  editingRow.value = row
  dialogVisible.value = true
}

async function toggleVisibility(row: CouponCategoryDto, next: unknown) {
  const nextBool = !!next
  const prev = row.isVisible
  row.isVisible = nextBool
  try {
    await updateCouponCategory(row.id, { isVisible: nextBool })
  }
  catch (e: any) {
    row.isVisible = prev
    MessagePlugin.error(e?.message ?? '更新失败')
  }
}

function handleSaved() {
  load()
}

onMounted(load)
</script>

<template>
  <div class="p-6">
    <t-card title="卡券管理">
      <template #subtitle>
        <span class="text-xs text-gray-400">数据来源：quanma51.com（同步脚本入库 + OSS logo），可手动新增 / 编辑 / 控制显隐</span>
      </template>
      <template #actions>
        <t-button theme="primary" :disabled="activeFirstLevelId == null" @click="openAdd">
          + 新建二级品牌
        </t-button>
      </template>

      <t-loading :loading="loading">
        <div class="flex gap-4 min-h-[480px]">
          <!-- 左侧：一级分类 nav -->
          <div class="w-40 flex-shrink-0 border-r border-gray-100 pr-3">
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
                <span class="text-xs text-gray-400 ml-1">({{ node.children.length }})</span>
              </li>
            </ul>
          </div>

          <!-- 右侧：二级品牌网格 -->
          <div class="flex-1 min-w-0">
            <div v-if="activeFirstLevel" class="mb-3 text-sm text-gray-600">
              当前：<span class="font-medium text-gray-900">{{ activeFirstLevel.name }}</span>
              <span class="ml-1 text-gray-400">{{ activeFirstLevel.children.length }} 个品牌</span>
            </div>

            <div v-if="brands.length === 0" class="text-gray-400 text-sm py-12 text-center">
              暂无二级品牌
            </div>
            <div
              v-else
              class="grid gap-3"
              style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"
            >
              <div
                v-for="row in brands" :key="row.id"
                class="border border-gray-200 rounded-lg p-3 flex flex-col items-center bg-white hover:shadow-sm transition-shadow"
                :class="{ 'opacity-50': !row.isVisible }"
              >
                <div class="w-16 h-16 flex items-center justify-center bg-gray-50 rounded mb-2 overflow-hidden">
                  <img v-if="row.logoUrl" :src="row.logoUrl" class="w-full h-full object-contain">
                  <span v-else class="text-xs text-gray-400">无 logo</span>
                </div>
                <div class="text-sm font-medium text-gray-900 text-center truncate w-full" :title="row.name">
                  {{ row.name }}
                </div>
                <div class="flex items-center justify-between w-full mt-2 px-1">
                  <t-switch
                    :value="row.isVisible"
                    size="small"
                    @change="(v: unknown) => toggleVisibility(row, v)"
                  />
                  <t-button size="small" variant="text" theme="primary" @click="openEdit(row)">
                    编辑
                  </t-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </t-loading>
    </t-card>

    <CouponCategoryEditDialog
      v-model:visible="dialogVisible"
      :editing-row="editingRow"
      :current-parent-id="activeFirstLevelId ?? 0"
      @saved="handleSaved"
    />
  </div>
</template>
