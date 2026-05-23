<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import {
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'

use([CanvasRenderer, PieChart, LegendComponent, TitleComponent, TooltipComponent])

interface Props {
  title: string
  /** 单层饼图 */
  items?: { label: string, value: number }[]
  /** 嵌套环：内圈 + 外圈两组数据 */
  inner?: { label: string, value: number }[]
  outer?: { label: string, value: number }[]
  height?: number
}
const props = withDefaults(defineProps<Props>(), { height: 280 })

const option = computed(() => {
  const isNested = (props.inner && props.outer && props.inner.length && props.outer.length)
  if (isNested) {
    return {
      title: { text: props.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { top: 30, right: 12, orient: 'vertical', textStyle: { fontSize: 11 } },
      series: [
        {
          name: '内圈',
          type: 'pie',
          radius: [0, '38%'],
          center: ['40%', '55%'],
          label: { position: 'inner', fontSize: 10, color: '#fff', formatter: '{b}\n{d}%' },
          data: props.inner!.map(i => ({ name: i.label, value: i.value })),
        },
        {
          name: '外圈',
          type: 'pie',
          radius: ['50%', '70%'],
          center: ['40%', '55%'],
          label: { fontSize: 10 },
          data: props.outer!.map(i => ({ name: i.label, value: i.value })),
        },
      ],
    }
  }
  return {
    title: { text: props.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { top: 30, right: 12, orient: 'vertical', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['38%', '55%'],
      avoidLabelOverlap: true,
      label: { fontSize: 11 },
      data: (props.items ?? []).map(i => ({ name: i.label, value: i.value })),
    }],
  }
})
</script>

<template>
  <t-card :bordered="true" class="pie-card">
    <VChart :option="option" :style="{ height: `${height}px` }" autoresize />
  </t-card>
</template>

<style scoped>
.pie-card { padding: 0; }
:deep(.t-card__body) { padding: 0; }
</style>
