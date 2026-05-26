<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = withDefaults(defineProps<{
  title: string
  /** 主数字（如今日 DAU） */
  value: number | string
  /** 副指标行 */
  subs?: { label: string, value: number | string, theme?: 'default' | 'success' | 'warning' | 'danger' }[]
  /** sparkline x 轴（已截断的 MM-DD 串） */
  xAxis: string[]
  /** sparkline 数据 */
  data: number[]
  /** tooltip 里数值的名称 */
  seriesName?: string
  color?: string
}>(), { color: '#2563eb', seriesName: '活跃' })

const option = computed(() => ({
  tooltip: {
    trigger: 'axis',
    confine: true,
    axisPointer: { type: 'line', lineStyle: { color: '#cbd5e1' } },
    formatter: (p: any[]) => `${p[0]?.axisValue}<br/>${props.seriesName} ${p[0]?.data ?? 0}`,
  },
  grid: { top: 6, left: 2, right: 2, bottom: 2 },
  xAxis: { type: 'category', data: props.xAxis, show: false, boundaryGap: false },
  yAxis: { type: 'value', show: false, min: 0 },
  series: [{
    type: 'line',
    data: props.data,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2, color: props.color },
    areaStyle: { color: `${props.color}1f` },
  }],
}))
</script>

<template>
  <t-card :bordered="true" hover-shadow class="kpi-card">
    <div class="kpi-title">{{ title }}</div>
    <div class="kpi-value">{{ value }}</div>
    <div v-if="subs && subs.length" class="kpi-subs">
      <div v-for="(s, i) in subs" :key="i" class="kpi-sub">
        <span class="kpi-sub-label">{{ s.label }}</span>
        <span class="kpi-sub-value" :class="s.theme ? `kpi-sub-theme-${s.theme}` : ''">{{ s.value }}</span>
      </div>
    </div>
    <VChart class="spark" :option="option" autoresize />
  </t-card>
</template>

<style scoped>
.kpi-card { min-height: 130px; }
.kpi-title { font-size: 13px; color: #64748b; font-weight: 500; }
.kpi-value {
  font-size: 28px; font-weight: 700; color: #0f172a;
  margin-top: 6px; line-height: 1.1; letter-spacing: -0.5px;
}
.kpi-subs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.kpi-sub { font-size: 12px; color: #64748b; }
.kpi-sub-label { margin-right: 4px; color: #94a3b8; }
.kpi-sub-value { font-weight: 600; color: #334155; }
.kpi-sub-theme-success { color: #16a34a; }
.kpi-sub-theme-warning { color: #d97706; }
.kpi-sub-theme-danger { color: #dc2626; }
.spark { height: 56px; margin-top: 10px; width: 100%; }
</style>
