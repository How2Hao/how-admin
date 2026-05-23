<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'

use([CanvasRenderer, BarChart, GridComponent, TitleComponent, TooltipComponent])

interface Props {
  title: string
  items: { label: string, value: number }[]
  height?: number
  color?: string
}
const props = withDefaults(defineProps<Props>(), { height: 280, color: '#3b82f6' })

const option = computed(() => {
  // Reverse so largest is at top
  const sorted = [...props.items].sort((a, b) => a.value - b.value)
  return {
    title: { text: props.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 40, left: 100, right: 28, bottom: 16 },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 10, color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(i => i.label),
      axisLabel: { fontSize: 11, color: '#475569' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [{
      type: 'bar',
      data: sorted.map(i => i.value),
      barMaxWidth: 18,
      itemStyle: {
        color: props.color,
        borderRadius: [0, 3, 3, 0],
      },
      label: { show: true, position: 'right', fontSize: 10, color: '#64748b' },
    }],
  }
})
</script>

<template>
  <t-card :bordered="true" class="bar-card">
    <VChart :option="option" :style="{ height: `${height}px` }" autoresize />
  </t-card>
</template>

<style scoped>
.bar-card { padding: 0; }
:deep(.t-card__body) { padding: 0; }
</style>
