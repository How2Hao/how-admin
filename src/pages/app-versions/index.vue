<!-- src/pages/app-versions/index.vue -->
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import AppVersionDialog from '@/components/app-versions/AppVersionDialog.vue'

interface BaseRow {
  id: number
  version: string
  changelog: string
  androidUrl: string | null
  iosUrl: string | null
  isMandatory: number
  publishedAt: number
  article: string | null
  articleTitle: string | null
  createdAt: number
}
type DraftRow = BaseRow & { updatedAt: number }

const drafts = ref<DraftRow[]>([])
const published = ref<BaseRow[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const editingRow = ref<BaseRow | null>(null)
const dialogTarget = ref<'draft' | 'published'>('draft')

async function fetchAll() {
  loading.value = true
  try {
    const [d, p] = await Promise.all([
      requestJson<{ list: DraftRow[] }>('/api/appVersionDrafts'),
      requestJson<{ list: BaseRow[] }>('/api/appVersions'),
    ])
    drafts.value = d.list
    published.value = p.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载失败')
  }
  finally {
    loading.value = false
  }
}

function openAddDraft() {
  editingRow.value = null
  dialogTarget.value = 'draft'
  dialogVisible.value = true
}

function openEdit(row: BaseRow, target: 'draft' | 'published') {
  editingRow.value = { ...row }
  dialogTarget.value = target
  dialogVisible.value = true
}

async function publishDraft(row: DraftRow) {
  if (!confirm(`确定发布版本「v${row.version}」？发布后 ha 将能拉取到，草稿会被移除。`)) return
  try {
    await requestJson(`/api/appVersionDrafts/${row.id}/publish`, { method: 'POST' })
    MessagePlugin.success('已发布')
    fetchAll()
  }
  catch (e: any) { MessagePlugin.error(e?.message ?? '发布失败') }
}

async function deleteDraft(row: DraftRow) {
  if (!confirm(`确定删除草稿「v${row.version}」？`)) return
  try {
    await requestJson(`/api/appVersionDrafts/${row.id}`, { method: 'DELETE' })
    MessagePlugin.success('已删除')
    fetchAll()
  }
  catch (e: any) { MessagePlugin.error(e?.message ?? '删除失败') }
}

async function deletePublished(row: BaseRow) {
  if (!confirm(`确定删除已发布版本「v${row.version}」？ha 将不再能拉取到。`)) return
  try {
    await requestJson(`/api/appVersions/${row.id}`, { method: 'DELETE' })
    MessagePlugin.success('已删除')
    fetchAll()
  }
  catch (e: any) { MessagePlugin.error(e?.message ?? '删除失败') }
}

function formatTime(ts: number | null) {
  if (!ts) return '-'
  return new Date(ts + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
}

const draftColumns = [
  { colKey: 'version', title: '版本号', width: 110 },
  { colKey: 'article', title: '文章', width: 70 },
  { colKey: 'isMandatory', title: '强更', width: 70 },
  { colKey: 'updatedAt', title: '最后编辑', width: 150 },
  { colKey: 'actions', title: '操作', width: 220, fixed: 'right' as const },
]
const publishedColumns = [
  { colKey: 'version', title: '版本号', width: 110 },
  { colKey: 'article', title: '文章', width: 70 },
  { colKey: 'isMandatory', title: '强更', width: 70 },
  { colKey: 'publishedAt', title: '发布时间', width: 150 },
  { colKey: 'actions', title: '操作', width: 160, fixed: 'right' as const },
]

onMounted(fetchAll)
</script>

<template>
  <div class="p-6 space-y-4">
    <t-card title="草稿箱">
      <template #subtitle>
        <span class="text-gray-400 text-sm">新版本先存草稿编辑/预览，确认后再发布；草稿对 ha 不可见</span>
      </template>
      <template #actions>
        <t-button theme="primary" @click="openAddDraft">
          新增版本（存草稿）
        </t-button>
      </template>
      <t-table row-key="id" :data="drafts" :loading="loading" :columns="draftColumns" stripe bordered>
        <template #article="{ row }">
          <t-tag v-if="row.article" theme="primary" variant="light" size="small">有</t-tag>
          <span v-else class="text-gray-300">—</span>
        </template>
        <template #isMandatory="{ row }">
          <t-tag v-if="row.isMandatory" theme="danger" variant="light" size="small">强更</t-tag>
          <span v-else class="text-gray-300">—</span>
        </template>
        <template #updatedAt="{ row }">
          {{ formatTime(row.updatedAt) }}
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="text" @click="openEdit(row, 'draft')">编辑</t-button>
          <t-button size="small" variant="text" theme="success" @click="publishDraft(row)">发布</t-button>
          <t-button size="small" variant="text" theme="danger" @click="deleteDraft(row)">删除</t-button>
        </template>
      </t-table>
    </t-card>

    <t-card title="已发布">
      <template #subtitle>
        <span class="text-gray-400 text-sm">ha「版本记录」/「我的消息」拉取的是这里的版本</span>
      </template>
      <t-table row-key="id" :data="published" :loading="loading" :columns="publishedColumns" stripe bordered>
        <template #article="{ row }">
          <t-tag v-if="row.article" theme="primary" variant="light" size="small">有</t-tag>
          <span v-else class="text-gray-300">—</span>
        </template>
        <template #isMandatory="{ row }">
          <t-tag v-if="row.isMandatory" theme="danger" variant="light" size="small">强更</t-tag>
          <span v-else class="text-gray-300">—</span>
        </template>
        <template #publishedAt="{ row }">
          {{ formatTime(row.publishedAt) }}
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="text" @click="openEdit(row, 'published')">编辑</t-button>
          <t-button size="small" variant="text" theme="danger" @click="deletePublished(row)">删除</t-button>
        </template>
      </t-table>
    </t-card>

    <AppVersionDialog
      v-model:visible="dialogVisible"
      :row="editingRow"
      :target="dialogTarget"
      @saved="fetchAll"
    />
  </div>
</template>
