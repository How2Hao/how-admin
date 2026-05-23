<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import UserPicker from '@/components/push/UserPicker.vue'

interface TagRow {
  id: number
  code: string
  name: string
  description: string | null
  userCount: number
  createdAt: number
}
interface TagUser {
  bindingId: number
  userId: number
  username: string | null
  uid6: string | null
  phone: string | null
}

const tags = ref<TagRow[]>([])
const loadingTags = ref(false)
const selectedId = ref<number | null>(null)
const selectedTag = computed(() => tags.value.find(t => t.id === selectedId.value) ?? null)

const users = ref<TagUser[]>([])
const loadingUsers = ref(false)

// 新建标签 dialog
const createOpen = ref(false)
const newTagForm = ref({ code: '', name: '', description: '' })
const creating = ref(false)

// 导入 dialog
const importOpen = ref(false)
const importMode = ref<'append' | 'replace'>('append')
const importText = ref('')
const importing = ref(false)

// 用 UserPicker 添加
const addUserOpen = ref(false)
const userIdsToAdd = ref<number[]>([])
const addingUsers = ref(false)

async function fetchTags() {
  loadingTags.value = true
  try {
    const r = await requestJson<{ list: TagRow[] }>('/api/admin/push/tags')
    tags.value = r.list
    if (!selectedId.value && r.list.length > 0) selectedId.value = r.list[0].id
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载标签失败')
  }
  finally {
    loadingTags.value = false
  }
}

async function fetchUsers() {
  if (!selectedId.value) {
    users.value = []
    return
  }
  loadingUsers.value = true
  try {
    const r = await requestJson<{ list: TagUser[] }>(`/api/admin/push/tags/${selectedId.value}/users`)
    users.value = r.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载用户失败')
  }
  finally {
    loadingUsers.value = false
  }
}

watch(selectedId, fetchUsers)

async function handleCreate() {
  if (!newTagForm.value.code.trim() || !newTagForm.value.name.trim()) {
    MessagePlugin.warning('code 和名称都必填')
    return
  }
  creating.value = true
  try {
    const r = await requestJson<{ id: number }>('/api/admin/push/tags', {
      method: 'POST',
      body: {
        code: newTagForm.value.code.trim().toUpperCase(),
        name: newTagForm.value.name.trim(),
        description: newTagForm.value.description.trim() || null,
      },
    })
    MessagePlugin.success('已创建')
    createOpen.value = false
    newTagForm.value = { code: '', name: '', description: '' }
    await fetchTags()
    selectedId.value = r.id
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '创建失败')
  }
  finally {
    creating.value = false
  }
}

function handleDelete(tag: TagRow) {
  const dialog = DialogPlugin.confirm({
    header: '删除标签',
    body: `确定删除 "${tag.name}"？该标签和它的成员关联都会被永久删除。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await requestJson(`/api/admin/push/tags/${tag.id}`, { method: 'DELETE' })
        MessagePlugin.success('已删除')
        if (selectedId.value === tag.id) selectedId.value = null
        await fetchTags()
        dialog.destroy()
      }
      catch (e: any) {
        MessagePlugin.error(e?.message ?? '删除失败')
      }
    },
  })
}

/** 解析粘贴文本：每行一个或逗号 / 空白分隔 */
function parseUserIdsText(text: string): number[] {
  const tokens = text.split(/[,\s\n\r\t;]+/).map(s => s.trim()).filter(Boolean)
  const ids: number[] = []
  for (const tok of tokens) {
    const n = Number(tok)
    if (Number.isInteger(n) && n > 0) ids.push(n)
  }
  return Array.from(new Set(ids))
}

async function handleImport() {
  if (!selectedId.value) return
  const ids = parseUserIdsText(importText.value)
  if (ids.length === 0) {
    MessagePlugin.warning('未解析到有效的 user_id')
    return
  }
  importing.value = true
  try {
    const r = await requestJson<{ requested: number, valid: number, inserted: number, skipped: number, userCount: number }>(
      `/api/admin/push/tags/${selectedId.value}/import`,
      {
        method: 'POST',
        body: { mode: importMode.value, userIds: ids },
      },
    )
    MessagePlugin.success(
      `导入完成：${importMode.value === 'replace' ? '覆盖' : '追加'} · 提交 ${r.requested} · 有效 ${r.valid} · 实际新增 ${r.inserted} · 当前共 ${r.userCount}`,
    )
    importOpen.value = false
    importText.value = ''
    await Promise.all([fetchTags(), fetchUsers()])
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '导入失败')
  }
  finally {
    importing.value = false
  }
}

async function handleClear() {
  if (!selectedId.value) return
  const dialog = DialogPlugin.confirm({
    header: '清空成员',
    body: `确定清空 "${selectedTag.value?.name}" 标签下的所有用户？`,
    confirmBtn: { content: '清空', theme: 'danger' },
    onConfirm: async () => {
      try {
        await requestJson(`/api/admin/push/tags/${selectedId.value}/import`, {
          method: 'POST',
          body: { mode: 'replace', userIds: [-1] }, // -1 是不存在的 uid，等价于"清空全部"
        }).catch(() => {})
        // -1 是无效 uid，会被过滤。换个更直接的：通过 users.delete + 全部 id
        // 改走删除接口
        const allIds = users.value.map(u => u.userId)
        if (allIds.length > 0) {
          await requestJson(`/api/admin/push/tags/${selectedId.value}/users`, {
            method: 'DELETE',
            body: { userIds: allIds },
          })
        }
        MessagePlugin.success('已清空')
        await Promise.all([fetchTags(), fetchUsers()])
        dialog.destroy()
      }
      catch (e: any) {
        MessagePlugin.error(e?.message ?? '清空失败')
      }
    },
  })
}

async function handleAddUsers() {
  if (!selectedId.value || userIdsToAdd.value.length === 0) {
    MessagePlugin.warning('请选择用户')
    return
  }
  addingUsers.value = true
  try {
    await requestJson(`/api/admin/push/tags/${selectedId.value}/users`, {
      method: 'POST',
      body: { userIds: userIdsToAdd.value },
    })
    MessagePlugin.success(`已添加 ${userIdsToAdd.value.length} 个用户`)
    addUserOpen.value = false
    userIdsToAdd.value = []
    await Promise.all([fetchTags(), fetchUsers()])
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '添加失败')
  }
  finally {
    addingUsers.value = false
  }
}

async function handleRemoveUser(u: TagUser) {
  if (!selectedId.value) return
  try {
    await requestJson(`/api/admin/push/tags/${selectedId.value}/users`, {
      method: 'DELETE',
      body: { userIds: [u.userId] },
    })
    MessagePlugin.success('已移除')
    await Promise.all([fetchTags(), fetchUsers()])
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '移除失败')
  }
}

onMounted(fetchTags)
</script>

<template>
  <div class="page-tags">
    <t-card title="用户标签（离线 user_id 名单）">
      <template #actions>
        <t-button theme="primary" size="small" @click="createOpen = true">
          <template #icon><div i-carbon:add /></template>
          新建标签
        </t-button>
      </template>

      <div class="layout">
        <!-- 左侧：标签列表 -->
        <aside class="sidebar">
          <t-loading v-if="loadingTags && tags.length === 0" size="small" />
          <t-empty v-else-if="tags.length === 0" description="还没有标签" size="small" />
          <div v-else class="tag-list">
            <div
              v-for="t in tags"
              :key="t.id"
              class="tag-item"
              :class="{ active: selectedId === t.id }"
              @click="selectedId = t.id"
            >
              <div class="tag-item-main">
                <div class="tag-name">{{ t.name }}</div>
                <div class="tag-code">{{ t.code }}</div>
              </div>
              <div class="tag-count">{{ t.userCount }}</div>
            </div>
          </div>
        </aside>

        <!-- 右侧：详情 + 用户列表 -->
        <main class="detail">
          <t-empty v-if="!selectedTag" description="左侧选择一个标签" size="medium" />
          <template v-else>
            <div class="detail-head">
              <div>
                <div class="d-title">{{ selectedTag.name }}</div>
                <div class="d-meta">code: <code>{{ selectedTag.code }}</code></div>
                <div v-if="selectedTag.description" class="d-desc">{{ selectedTag.description }}</div>
              </div>
              <div class="detail-actions">
                <t-button size="small" theme="primary" @click="importOpen = true; importText = ''; importMode = 'append'">
                  <template #icon><div i-carbon:upload /></template>
                  批量导入
                </t-button>
                <t-button size="small" theme="default" @click="addUserOpen = true; userIdsToAdd = []">
                  <template #icon><div i-carbon:user-follow /></template>
                  挑用户
                </t-button>
                <t-button size="small" theme="default" variant="outline" :disabled="users.length === 0" @click="handleClear">
                  清空
                </t-button>
                <t-button size="small" theme="danger" variant="outline" @click="handleDelete(selectedTag)">
                  删除
                </t-button>
              </div>
            </div>

            <div class="users-section">
              <div class="section-title">
                标签下用户 ({{ selectedTag.userCount }}，下方最多显示 1000)
              </div>
              <t-loading v-if="loadingUsers" size="small" />
              <t-empty v-else-if="users.length === 0" description="标签下还没有用户" size="small" />
              <t-table
                v-else
                row-key="bindingId"
                :data="users"
                :columns="[
                  { colKey: 'user', title: '用户', width: 220 },
                  { colKey: 'phone', title: '手机号', width: 140 },
                  { colKey: 'op', title: '操作', width: 100 },
                ]"
                size="small"
                bordered
                stripe
              >
                <template #user="{ row }">
                  <div>
                    <div class="text-sm">{{ row.username || '未知' }}</div>
                    <div class="text-xs text-gray-400">#{{ row.uid6 || row.userId }}</div>
                  </div>
                </template>
                <template #phone="{ row }">
                  <span class="text-xs">{{ row.phone || '—' }}</span>
                </template>
                <template #op="{ row }">
                  <t-button size="small" variant="text" theme="danger" @click="handleRemoveUser(row)">
                    移除
                  </t-button>
                </template>
              </t-table>
            </div>
          </template>
        </main>
      </div>
    </t-card>

    <!-- 新建标签 -->
    <t-dialog
      :visible="createOpen"
      header="新建标签"
      width="520px"
      :confirm-btn="{ content: '创建', loading: creating }"
      @update:visible="(v) => createOpen = v"
      @confirm="handleCreate"
    >
      <t-form label-width="80px">
        <t-form-item label="code" required>
          <t-input v-model="newTagForm.code" placeholder="大写字母 / 数字 / 下划线，如 VIP" />
        </t-form-item>
        <t-form-item label="名称" required>
          <t-input v-model="newTagForm.name" placeholder="给运营看的中文名" />
        </t-form-item>
        <t-form-item label="描述">
          <t-input v-model="newTagForm.description" placeholder="可选" />
        </t-form-item>
      </t-form>
      <div class="hint-block">
        标签创建后用「批量导入」粘贴 user_id 列表来填充成员。
        可以自己跑 SQL 拿到 user_id 集合，比如：
        <code>SELECT user_id FROM user_settings
          WHERE JSON_EXTRACT(settings_json,'$.notification.typeActivity')=true</code>
      </div>
    </t-dialog>

    <!-- 导入 user_id -->
    <t-dialog
      :visible="importOpen"
      header="批量导入用户"
      width="600px"
      :confirm-btn="{ content: '导入', loading: importing }"
      @update:visible="(v) => importOpen = v"
      @confirm="handleImport"
    >
      <t-form label-width="100px">
        <t-form-item label="导入策略">
          <t-radio-group v-model="importMode">
            <t-radio value="append">追加（保留现有成员）</t-radio>
            <t-radio value="replace">覆盖（先清空再插入）</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="user_id 列表">
          <t-textarea
            v-model="importText"
            placeholder="每行一个 user_id，或逗号 / 空白分隔。最多 10 万。"
            :autosize="{ minRows: 8, maxRows: 16 }"
          />
        </t-form-item>
      </t-form>
      <div class="hint-block">
        系统会自动跳过不存在的 user_id，对重复的 (user_id, tag) 也会用 INSERT IGNORE 跳过。
      </div>
    </t-dialog>

    <!-- 用 UserPicker 添加 -->
    <t-dialog
      :visible="addUserOpen"
      header="挑选用户加入此标签"
      width="560px"
      :confirm-btn="{ content: '添加', loading: addingUsers }"
      @update:visible="(v) => addUserOpen = v"
      @confirm="handleAddUsers"
    >
      <UserPicker v-model="userIdsToAdd" />
    </t-dialog>
  </div>
</template>

<style scoped>
.page-tags { padding: 16px 24px; }
.layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; min-height: 500px; }
.sidebar { border-right: 1px solid #e5e7eb; padding-right: 12px; }
.tag-list { display: flex; flex-direction: column; gap: 4px; }
.tag-item {
  display: flex; align-items: center; padding: 10px 12px;
  border-radius: 6px; cursor: pointer; gap: 10px;
}
.tag-item:hover { background: #f8fafc; }
.tag-item.active { background: #eff6ff; }
.tag-item-main { flex: 1; min-width: 0; }
.tag-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.tag-code { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.tag-count {
  padding: 2px 8px; background: #f1f5f9; border-radius: 999px;
  font-size: 11px; color: #475569;
}
.tag-item.active .tag-count { background: #dbeafe; color: #1e40af; }

.detail { display: flex; flex-direction: column; gap: 16px; }
.detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.d-title { font-size: 16px; font-weight: 700; color: #0f172a; }
.d-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
.d-meta code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; }
.d-desc { font-size: 12px; color: #475569; margin-top: 4px; }
.detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.users-section { background: white; padding-top: 8px; }
.section-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #475569; }

.hint-block {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-left: 3px solid #94a3b8;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}
.hint-block code {
  display: block;
  margin-top: 4px;
  padding: 4px 6px;
  background: #e2e8f0;
  border-radius: 3px;
  font-size: 11px;
  color: #0f172a;
  white-space: pre-wrap;
}
</style>
