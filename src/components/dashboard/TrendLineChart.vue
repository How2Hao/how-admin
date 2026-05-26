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
  /** 可选：标题旁的文字汇总数字（如总数/今日新增）。传了就用 HTML 头部展示、图内标题隐藏 */
  summary?: { label: string, value: string | number, theme?: 'success' | 'warning' | 'danger' }[]
}
const props = withDefaults(defineProps<Props>(), { height: 260 })

const hasSummary = computed(() => !!props.summary && props.summary.length > 0)

const option = computed(() => ({
  title: hasSummary.value ? { show: false } : { text: props.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600 } },
  tooltip: { trigger: 'axis' },
  legend: { top: 8, right: 12, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
  grid: { top: hasSummary.value ? 32 : 50, left: 32, right: 16, bottom: 28 },
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
    <div v-if="hasSummary" class="trend-head">
      <span class="trend-title">{{ title }}</span>
      <span class="trend-summary">
        <span v-for="(s, i) in summary" :key="i" class="ts-item">
          <span class="ts-label">{{ s.label }}</span>
          <span class="ts-value" :class="s.theme ? `ts-${s.theme}` : ''">{{ s.value }}</span>
        </span>
      </span>
    </div>
    <VChart :option="option" :style="{ height: `${height}px` }" autoresize />
  </t-card>
</template>

<style scoped>
.trend-card { padding: 0; }
:deep(.t-card__body) { padding: 0; }
.trend-head {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 16px;
  padding: 10px 12px 0;
}
.trend-title { font-size: 14px; font-weight: 600; color: #0f172a; }
.trend-summary { display: flex; flex-wrap: wrap; gap: 12px; }
.ts-item { font-size: 12px; color: #64748b; }
.ts-label { color: #94a3b8; margin-right: 4px; }
.ts-value { font-weight: 600; color: #334155; }
.ts-success { color: #16a34a; }
.ts-warning { color: #d97706; }
.ts-danger { color: #dc2626; }
</style>
