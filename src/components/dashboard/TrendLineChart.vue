<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent])

interface Props {
  title: string
  /** x 轴日期 'YYYY-MM-DD' 数组 */
  xAxis: string[]
  /** 多组系列：[{ name, data, color? }] */
  series: { name: string, data: number[], color?: string }[]
  height?: number
}
const props = withDefaults(defineProps<Props>(), { height: 260 })

const option = computed(() => ({
  title: { text: props.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600 } },
  tooltip: { trigger: 'axis' },
  legend: { top: 8, right: 12, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
  grid: { top: 50, left: 32, right: 16, bottom: 28 },
  xAxis: {
    type: 'category',
    data: props.xAxis,
    boundaryGap: false,
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#f1f5f9' } },
  },
  series: props.series.map(s => ({
    name: s.name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    data: s.data,
    ...(s.color ? { itemStyle: { color: s.color }, lineStyle: { color: s.color } } : {}),
  })),
}))
</script>

<template>
  <t-card :bordered="true" class="trend-card">
    <VChart :option="option" :style="{ height: `${height}px` }" autoresize />
  </t-card>
</template>

<style scoped>
.trend-card { padding: 0; }
:deep(.t-card__body) { padding: 0; }
</style>
