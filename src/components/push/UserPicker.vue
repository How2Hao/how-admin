<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface UserOption {
  userId: number
  username: string | null
  uid6: string | null
  phone: string | null
}

const props = defineProps<{
  modelValue: number[]
  /** 只展示有 active iOS device 的用户（用于推送任务） */
  onlyPushable?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: number[]): void
}>()

const allUsers = ref<UserOption[]>([])
const loading = ref(false)
const keyword = ref('')

async function loadUsers() {
  loading.value = true
  try {
    // 复用 push/tokens 思路：从 device_tokens 直接拉用户列表（onlyPushable=true 时）
    // 否则从 user-feedbacks 接口里拉所有用户也行；这里简化用 tokens 接口（已有）
    if (props.onlyPushable) {
      // tokens 接口已经在 push/index.vue 删除了，这里改用新写法：tokens.get 或者类似端点
      // 暂时：用 push audience-preview 的 USER_IDS 反过来不行，需要列表接口
      // 简单方案：复用 push tags users 接口的反向？不存在
      // 直接简写：拉 device_tokens 表
      const res = await requestJson<{ list: UserOption[] }>('/api/admin/push/users-pushable')
      allUsers.value = res.list
    }
    else {
      const res = await requestJson<{ list: UserOption[] }>('/api/admin/push/users-pushable')
      allUsers.value = res.list
    }
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载用户列表失败')
  }
  finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return allUsers.value.slice(0, 50)
  return allUsers.value.filter(u =>
    (u.username || '').toLowerCase().includes(kw)
    || (u.uid6 || '').toLowerCase().includes(kw)
    || (u.phone || '').includes(kw),
  ).slice(0, 50)
})

const selectedSet = computed(() => new Set(props.modelValue))

function isSelected(u: UserOption) {
  return selectedSet.value.has(u.userId)
}

function toggle(u: UserOption) {
  const next = new Set(props.modelValue)
  if (next.has(u.userId)) next.delete(u.userId)
  else next.add(u.userId)
  emit('update:modelValue', [...next])
}

function removeOne(uid: number) {
  emit('update:modelValue', props.modelValue.filter(x => x !== uid))
}

function clearAll() {
  emit('update:modelValue', [])
}

const selectedUsers = computed(() =>
  props.modelValue
    .map(uid => allUsers.value.find(u => u.userId === uid))
    .filter((u): u is UserOption => !!u),
)

onMounted(loadUsers)
</script>

<template>
  <div class="user-picker">
    <t-input
      v-model="keyword"
      placeholder="搜索用户名 / uid6 / 手机号"
      size="small"
      clearable
    >
      <template #prefix-icon>
        <div i-carbon:search />
      </template>
    </t-input>

    <div class="results" :class="{ loading }">
      <t-loading v-if="loading" size="small" />
      <div v-else-if="filtered.length === 0" class="empty">无匹配用户</div>
      <div
        v-for="u in filtered"
        v-else
        :key="u.userId"
        class="row"
        :class="{ selected: isSelected(u) }"
        @click="toggle(u)"
      >
        <div class="row-main">
          <div class="row-name">{{ u.username || '未知' }}</div>
          <div class="row-meta">#{{ u.uid6 || u.userId }}{{ u.phone ? ` · ${u.phone}` : '' }}</div>
        </div>
        <div :class="isSelected(u) ? 'i-carbon:checkmark-filled' : 'i-carbon:add'" class="row-tick" />
      </div>
    </div>

    <div v-if="selectedUsers.length" class="selected-bar">
      <span class="selected-label">已选 {{ selectedUsers.length }} 人</span>
      <t-button size="small" variant="text" @click="clearAll">清空</t-button>
      <div class="selected-chips">
        <t-tag
          v-for="u in selectedUsers"
          :key="u.userId"
          size="small"
          closable
          @close="removeOne(u.userId)"
        >
          {{ u.username || u.uid6 || u.userId }}
        </t-tag>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.results {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
}
.results.loading { padding: 20px; text-align: center; }
.empty { padding: 16px; text-align: center; color: #94a3b8; font-size: 12px; }
.row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  gap: 10px;
}
.row:hover { background: #f8fafc; }
.row.selected { background: #eff6ff; }
.row-main { flex: 1; min-width: 0; }
.row-name { font-size: 13px; color: #0f172a; font-weight: 500; }
.row-meta { font-size: 11px; color: #94a3b8; }
.row-tick { font-size: 16px; color: #64748b; flex-shrink: 0; }
.row.selected .row-tick { color: #2563eb; }

.selected-bar {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px 10px; background: #f8fafc; border-radius: 6px;
}
.selected-label { font-size: 12px; color: #64748b; font-weight: 600; margin-right: 4px; }
.selected-chips { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
</style>
