<script setup lang="ts">
import { computed, ref } from 'vue'
import BankItem from './BankItem.vue'

interface SourceCounts { flyert: number, '51credit': number, self: number }
interface BankGroup {
  bankId: string
  bankName: string
  bankLogo: string | null
  total: number
  sourceCounts: SourceCounts
}

const props = defineProps<{
  groups: BankGroup[]
  selectedBankId: string
}>()
const emit = defineEmits<{ (e: 'update:selectedBankId', v: string): void }>()

const keyword = ref('')
const filtered = computed(() => {
  const k = keyword.value.trim()
  if (!k) return props.groups
  return props.groups.filter(g => g.bankName.includes(k))
})

function handlePick(id: string) {
  emit('update:selectedBankId', id)
}
</script>

<template>
  <aside class="bank-sidebar">
    <div class="search-row">
      <t-input v-model="keyword" placeholder="搜索银行" clearable size="small" />
    </div>
    <div class="bank-list">
      <BankItem
        v-for="g in filtered"
        :key="g.bankId"
        :bank-id="g.bankId"
        :bank-name="g.bankName"
        :bank-logo="g.bankLogo"
        :total="g.total"
        :source-counts="g.sourceCounts"
        :selected="g.bankId === selectedBankId"
        @click="handlePick(g.bankId)"
      />
      <t-empty v-if="!filtered.length" size="small" description="无匹配银行" />
    </div>
  </aside>
</template>

<style scoped>
.bank-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.search-row { padding: 12px; border-bottom: 1px solid #e5e7eb; }
.bank-list { flex: 1; overflow-y: auto; }
</style>
