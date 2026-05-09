<script setup lang="ts">
import CardItem, { type CardItemData } from './CardItem.vue'

defineProps<{
  bankName: string
  total: number
  cards: CardItemData[]
  loading: boolean
  keyword: string
}>()

const emit = defineEmits<{
  (e: 'update:keyword', v: string): void
  (e: 'toggle', id: number, next: 0 | 1): void
  (e: 'edit', id: number): void
}>()
</script>

<template>
  <section class="card-grid">
    <header class="toolbar">
      <span class="bank-name">{{ bankName || '— 请选择银行 —' }}</span>
      <span class="count">{{ total }} 张</span>
      <div class="search">
        <t-input
          :model-value="keyword"
          placeholder="搜索卡名"
          clearable
          size="small"
          style="width: 200px"
          @update:model-value="(v: string) => emit('update:keyword', v)"
        />
      </div>
    </header>
    <div class="body">
      <t-loading v-if="loading" size="small" />
      <t-empty v-else-if="!cards.length" description="该银行下暂无信用卡模板" />
      <div v-else class="grid">
        <CardItem
          v-for="card in cards"
          :key="card.id"
          :card="card"
          @toggle="(id, next) => emit('toggle', id, next)"
          @edit="(id) => emit('edit', id)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.card-grid { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fafafa; }
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.bank-name { font-size: 15px; font-weight: 600; }
.count { font-size: 12px; color: #888; }
.search { margin-left: auto; }
.body { flex: 1; overflow: auto; padding: 16px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 380px);
  gap: 14px;
  align-content: start;
  justify-content: start;
}
</style>
