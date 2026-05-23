<script setup lang="ts">
defineProps<{
  title: string
  value: number | string
  /** 副指标行，如 ["今日 +12", "7日 +88"] */
  subs?: { label: string, value: number | string, theme?: 'default' | 'success' | 'warning' | 'danger' }[]
  /** 占比条数据，最多 3 段 */
  bars?: { label: string, value: number, color: string }[]
  /** 主数字颜色（用于 OPEN 反馈红色高亮） */
  accent?: string
}>()
</script>

<template>
  <t-card :bordered="true" hover-shadow class="kpi-card">
    <div class="kpi-title">{{ title }}</div>
    <div class="kpi-value" :style="accent ? { color: accent } : undefined">
      {{ value }}
    </div>
    <div v-if="subs && subs.length" class="kpi-subs">
      <div v-for="(s, i) in subs" :key="i" class="kpi-sub">
        <span class="kpi-sub-label">{{ s.label }}</span>
        <span class="kpi-sub-value" :class="s.theme ? `kpi-sub-theme-${s.theme}` : ''">{{ s.value }}</span>
      </div>
    </div>
    <div v-if="bars && bars.length" class="kpi-bars">
      <div class="kpi-bars-track">
        <div
          v-for="(b, i) in bars"
          :key="i"
          class="kpi-bars-seg"
          :style="{
            width: `${barWidth(b, bars)}%`,
            backgroundColor: b.color,
          }"
          :title="`${b.label} ${b.value}`"
        />
      </div>
      <div class="kpi-bars-legend">
        <span v-for="(b, i) in bars" :key="i" class="kpi-bars-item">
          <span class="kpi-bars-dot" :style="{ backgroundColor: b.color }" />
          {{ b.label }} {{ b.value }}
        </span>
      </div>
    </div>
  </t-card>
</template>

<script lang="ts">
function barWidth(b: { value: number }, all: { value: number }[]): number {
  const total = all.reduce((s, x) => s + (x.value || 0), 0)
  if (total <= 0) return 0
  return (b.value / total) * 100
}
</script>

<style scoped>
.kpi-card { min-height: 130px; }
.kpi-title { font-size: 13px; color: #64748b; font-weight: 500; }
.kpi-value {
  font-size: 28px; font-weight: 700; color: #0f172a;
  margin-top: 6px; line-height: 1.1;
  letter-spacing: -0.5px;
}
.kpi-subs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
.kpi-sub { font-size: 12px; color: #64748b; }
.kpi-sub-label { margin-right: 4px; color: #94a3b8; }
.kpi-sub-value { font-weight: 600; color: #334155; }
.kpi-sub-theme-success { color: #16a34a; }
.kpi-sub-theme-warning { color: #d97706; }
.kpi-sub-theme-danger { color: #dc2626; }

.kpi-bars { margin-top: 12px; }
.kpi-bars-track {
  display: flex; height: 6px; border-radius: 3px; overflow: hidden;
  background: #f1f5f9;
}
.kpi-bars-seg { height: 100%; transition: width 0.3s; }
.kpi-bars-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 11px; color: #64748b; }
.kpi-bars-item { display: inline-flex; align-items: center; gap: 4px; }
.kpi-bars-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
</style>
