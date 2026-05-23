<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  /** 列定义：colKey 必填；title 必填；render 可选自定义渲染 */
  columns: { colKey: string, title: string, width?: string | number }[]
  data: Record<string, any>[]
  /** 空数据提示 */
  emptyText?: string
  height?: number
  /** 传入则在右上角展示该总数（用于 LIMIT 列表展示数据子集时） */
  total?: number
}>()

const countText = computed(() => {
  if (props.total != null && props.total !== props.data.length)
    return `${props.data.length} / ${props.total} 条`
  return `${props.data.length} 条`
})
</script>

<template>
  <t-card :bordered="true" class="simple-table-card">
    <div class="t-title-row">
      <span class="t-title">{{ title }}</span>
      <span class="t-count">{{ countText }}</span>
    </div>
    <div class="t-body" :style="height ? { maxHeight: `${height}px` } : undefined">
      <t-table
        v-if="data.length"
        row-key="id"
        :data="data"
        :columns="columns"
        size="small"
        bordered
      >
        <template
          v-for="col in columns"
          #[col.colKey]="{ row }"
          :key="col.colKey"
        >
          <slot :name="col.colKey" :row="row">
            {{ row[col.colKey] }}
          </slot>
        </template>
      </t-table>
      <div v-else class="t-empty">{{ emptyText ?? '暂无数据' }}</div>
    </div>
  </t-card>
</template>

<style scoped>
.simple-table-card { padding: 0; }
:deep(.t-card__body) { padding: 0; }
.t-title-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid #f1f5f9;
}
.t-title { font-size: 14px; font-weight: 600; color: #0f172a; }
.t-count { font-size: 11px; color: #94a3b8; }
.t-body { overflow: auto; }
.t-empty {
  padding: 32px 16px; text-align: center;
  color: #94a3b8; font-size: 12px;
}
</style>
