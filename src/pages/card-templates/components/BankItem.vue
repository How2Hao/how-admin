<script setup lang="ts">
interface SourceCounts {
  flyert: number
  '51credit': number
  self: number
}
defineProps<{
  bankId: string
  bankName: string
  bankLogo: string | null
  total: number
  sourceCounts: SourceCounts
  selected: boolean
}>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <div class="bank-item" :class="{ selected }" @click="$emit('click')">
    <div class="row">
      <img v-if="bankLogo" :src="bankLogo" class="logo" :alt="bankName">
      <div v-else class="logo placeholder" />
      <div class="name">{{ bankName }}</div>
      <div class="total">{{ total }} 张</div>
    </div>
    <div class="chips">
      <span class="chip flyert" :class="{ zero: sourceCounts.flyert === 0 }">飞客 {{ sourceCounts.flyert }}</span>
      <span class="chip credit51" :class="{ zero: sourceCounts['51credit'] === 0 }">51 {{ sourceCounts['51credit'] }}</span>
      <span class="chip self" :class="{ zero: sourceCounts.self === 0 }">自建 {{ sourceCounts.self }}</span>
    </div>
  </div>
</template>

<style scoped>
.bank-item {
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background .15s;
}
.bank-item:hover { background: #fafbfd; }
.bank-item.selected { background: #eef4ff; border-left-color: #2563eb; }
.row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.logo { width: 36px; height: 36px; border-radius: 6px; object-fit: contain; background: #fff; flex-shrink: 0; }
.logo.placeholder { background: #e5e7eb; }
.name { font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bank-item.selected .name { font-weight: 600; }
.total { font-size: 11px; color: #888; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; }
.chip { padding: 2px 8px; border-radius: 10px; }
.chip.flyert { background: #dbeafe; color: #1e40af; }
.chip.credit51 { background: #fef3c7; color: #92400e; }
.chip.self { background: #dcfce7; color: #166534; }
.chip.zero { background: #f3f4f6; color: #888; }
</style>
