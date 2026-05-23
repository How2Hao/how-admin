<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface TagOption {
  id: number
  code: string
  name: string
  color: string | null
  source: string
  userCount: number
}

const props = defineProps<{
  modelValue: number[]
  op: 'AND' | 'OR'
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: number[]): void
  (e: 'update:op', v: 'AND' | 'OR'): void
}>()

const tags = ref<TagOption[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await requestJson<{ list: TagOption[] }>('/api/admin/push/tags')
    tags.value = res.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载标签失败')
  }
  finally {
    loading.value = false
  }
}

const selectedSet = computed(() => new Set(props.modelValue))

function toggle(tag: TagOption) {
  const next = new Set(props.modelValue)
  if (next.has(tag.id)) next.delete(tag.id)
  else next.add(tag.id)
  emit('update:modelValue', [...next])
}

function remove(id: number) {
  emit('update:modelValue', props.modelValue.filter(x => x !== id))
}

const selectedTags = computed(() =>
  props.modelValue
    .map(id => tags.value.find(t => t.id === id))
    .filter((t): t is TagOption => !!t),
)

onMounted(load)
</script>

<template>
  <div class="tag-picker">
    <div class="op-bar">
      <span class="op-label">标签关系：</span>
      <t-radio-group
        :value="op"
        size="small"
        variant="default-filled"
        @change="(v) => emit('update:op', v as 'AND' | 'OR')"
      >
        <t-radio-button value="AND">AND（必须命中所有）</t-radio-button>
        <t-radio-button value="OR">OR（命中任一即可）</t-radio-button>
      </t-radio-group>
    </div>

    <div class="all-tags">
      <t-loading v-if="loading" size="small" />
      <div v-else-if="tags.length === 0" class="empty">还没有任何标签，先去"用户标签"页创建</div>
      <t-tag
        v-for="tag in tags"
        v-else
        :key="tag.id"
        :variant="selectedSet.has(tag.id) ? 'dark' : 'outline'"
        :theme="selectedSet.has(tag.id) ? 'primary' : 'default'"
        size="medium"
        class="tag-chip"
        @click="toggle(tag)"
      >
        {{ tag.name }} ({{ tag.userCount }})
      </t-tag>
    </div>

    <div v-if="selectedTags.length" class="selected">
      已选:
      <t-tag
        v-for="t in selectedTags"
        :key="t.id"
        size="small"
        closable
        @close="remove(t.id)"
      >
        {{ t.name }}
      </t-tag>
    </div>
  </div>
</template>

<style scoped>
.tag-picker { display: flex; flex-direction: column; gap: 10px; }
.op-bar { display: flex; align-items: center; gap: 8px; }
.op-label { font-size: 12px; color: #475569; }
.all-tags {
  display: flex; flex-wrap: wrap; gap: 6px;
  min-height: 32px; padding: 8px; background: #f8fafc; border-radius: 6px;
}
.tag-chip { cursor: pointer; }
.empty { font-size: 12px; color: #94a3b8; padding: 4px; }
.selected { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; color: #64748b; }
</style>
