<script setup lang="ts">
import { ref } from 'vue'

export interface CardItemData {
  id: number
  cardName: string
  cardLevelName: string | null
  cardOrganizationName: string | null
  cover: string | null
  isVisible: number   // 0 | 1
  dataSource: string  // 'flyert' | '51credit' | 'self'
}

defineProps<{ card: CardItemData }>()

const emit = defineEmits<{
  (e: 'toggle', id: number, next: 0 | 1): void
  (e: 'edit', id: number): void
}>()

const imgError = ref(false)

function onCardClick() {
  emit('edit', /* injected via template */ 0)
}
function onSwitchClick(card: CardItemData, e: MouseEvent) {
  e.stopPropagation()
  emit('toggle', card.id, card.isVisible === 1 ? 0 : 1)
}
</script>

<template>
  <div
    class="card-item"
    :class="{ hidden: card.isVisible === 0 }"
    @click="emit('edit', card.id)"
  >
    <img
      v-if="card.cover && !imgError"
      :src="card.cover"
      class="cover"
      :alt="card.cardName"
      @error="imgError = true"
    >
    <div v-else class="cover placeholder" />

    <div class="info">
      <div class="name" :title="card.cardName">{{ card.cardName }}</div>
      <div class="meta">
        {{ [card.cardLevelName, card.cardOrganizationName].filter(Boolean).join(' · ') || '—' }}
      </div>
    </div>

    <div
      class="switch"
      :class="{ on: card.isVisible === 1, off: card.isVisible === 0 }"
      :title="card.isVisible === 1 ? '点击隐藏（is_visible=0）' : '点击展示（is_visible=1）'"
      @click="onSwitchClick(card, $event)"
    >
      <div class="dot" />
    </div>
  </div>
</template>

<style scoped>
.card-item {
  position: relative;
  width: 380px;
  height: 120px;
  display: flex;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: opacity .15s, transform .15s;
}
.card-item:hover { transform: translateY(-1px); border-color: #cbd5e1; }
.card-item.hidden { opacity: .55; }
.cover {
  width: 190px;
  height: 120px;
  object-fit: cover;
  flex-shrink: 0;
  background: #0d1124;
}
.cover.placeholder { background: #e5e7eb; }
.info {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.name {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  color: #888;
  font-size: 12px;
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.switch {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
  cursor: pointer;
  transition: background .15s;
}
.switch.on { background: #16a34a; }
.switch.off { background: #cbd5e1; }
.switch .dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: margin .15s;
}
.switch.on .dot { margin-left: auto; }
.switch.off .dot { margin-left: 0; }
</style>
