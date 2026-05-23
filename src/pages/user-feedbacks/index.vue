<script setup lang="ts">
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX'
type ResolutionType = 'NONE' | 'NO_UPDATE' | 'NEEDS_UPDATE'

interface FeedbackContext {
  appVersion?: string | null
  os?: string | null
  osVersion?: string | null
  brand?: string | null
  modelName?: string | null
  netType?: string | null
  locale?: string | null
  timezone?: string | null
  screenWidth?: number
  screenHeight?: number
  pixelRatio?: number
  submittedAt?: number
  [k: string]: unknown
}

interface FeedbackRow {
  id: number
  userId: number
  type: string
  content: string
  images: string[] | null
  context: FeedbackContext | null
  status: FeedbackStatus
  resolutionType: ResolutionType
  minAppVersion: string | null
  resolutionNote: string | null
  resolvedAt: number | null
  createdAt: string
  username: string | null
  uid6: string | null
  avatar: string | null
  phone: string | null
  lastLoginAt: number | null
}

function summarizeContext(ctx: FeedbackContext | null): string {
  if (!ctx) return ''
  const parts: string[] = []
  if (ctx.appVersion) parts.push(`v${ctx.appVersion}`)
  if (ctx.os) parts.push(`${ctx.os}${ctx.osVersion ? ` ${ctx.osVersion}` : ''}`)
  const device = [ctx.brand, ctx.modelName].filter(Boolean).join(' ')
  if (device) parts.push(device)
  if (ctx.netType) parts.push(ctx.netType)
  return parts.join(' · ')
}

interface ListResponse {
  list: FeedbackRow[]
  total: number
  page: number
  pageSize: number
  keyword: string
  type: string
}

interface TypesResponse {
  list: { type: string; count: number }[]
}

interface AppReleaseRow {
  id: number
  version: string
  androidUrl: string | null
  iosUrl: string | null
  isMandatory: number
  publishedAt: number
}

interface AppReleaseListResponse {
  list: AppReleaseRow[]
}

const list = ref<FeedbackRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const typeFilter = ref<string>('')
const loading = ref(false)
const typeOptions = ref<{ label: string, value: string }[]>([{ label: '全部类型', value: '' }])
const appReleaseOptions = ref<{ label: string, value: string }[]>([])

const previewImage = ref<string | null>(null)

const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'user', title: '用户', width: 260 },
  { colKey: 'type', title: '类型', width: 100 },
  { colKey: 'content', title: '反馈内容', minWidth: 240 },
  { colKey: 'images', title: '附图', width: 180 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'createdAt', title: '提交时间', width: 170 },
  { colKey: 'op', title: '操作', width: 130, fixed: 'right' as const },
]

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已修复',
  WONT_FIX: '不予修复',
}

const STATUS_THEME: Record<FeedbackStatus, 'default' | 'primary' | 'warning' | 'danger' | 'success'> = {
  OPEN: 'default',
  IN_PROGRESS: 'primary',
  RESOLVED: 'success',
  WONT_FIX: 'danger',
}

const STATUS_OPTIONS: { label: string, value: FeedbackStatus }[] = [
  { label: '待处理', value: 'OPEN' },
  { label: '处理中', value: 'IN_PROGRESS' },
  { label: '已修复', value: 'RESOLVED' },
  { label: '不予修复', value: 'WONT_FIX' },
]

const RESOLUTION_OPTIONS: { label: string, value: ResolutionType }[] = [
  { label: '未设置', value: 'NONE' },
  { label: '无需更新（服务端/数据修复）', value: 'NO_UPDATE' },
  { label: '需更新版本', value: 'NEEDS_UPDATE' },
]

const editing = ref<FeedbackRow | null>(null)
const editForm = ref<{
  status: FeedbackStatus
  resolutionType: ResolutionType
  minAppVersion: string
  resolutionNote: string
}>({
  status: 'OPEN',
  resolutionType: 'NONE',
  minAppVersion: '',
  resolutionNote: '',
})
const editSubmitting = ref(false)

const TYPE_LABEL: Record<string, string> = {
  bug: '问题反馈',
  suggestion: '建议',
  feature: '功能请求',
  card_face: '卡面反馈',
  other: '其他',
}

function typeLabel(type: string) {
  return TYPE_LABEL[type.toLowerCase()] ?? type
}

function typeTheme(type: string): 'default' | 'primary' | 'warning' | 'danger' | 'success' {
  switch (type.toLowerCase()) {
    case 'bug': return 'danger'
    case 'suggestion': return 'primary'
    case 'feature': return 'success'
    case 'card_face': return 'warning'
    default: return 'default'
  }
}

function formatDateTime(value: string | null) {
  if (!value)
    return '-'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime()))
    return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** unix ms 时间戳格式化为 yyyy-MM-dd HH:mm */
function formatTsShort(ts: number | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 距今天数；为负或未登录返回 null */
function daysSince(ts: number | null): number | null {
  if (!ts || ts <= 0) return null
  const diff = Date.now() - ts
  if (diff < 0) return null
  return Math.floor(diff / 86_400_000)
}

const STALE_DAYS = 7

async function fetchTypes() {
  try {
    const res = await requestJson<TypesResponse>('/api/userFeedbacks/types')
    typeOptions.value = [
      { label: '全部类型', value: '' },
      ...res.list.map(item => ({
        label: `${typeLabel(item.type)}（${item.count}）`,
        value: item.type,
      })),
    ]
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载反馈类型失败')
  }
}

async function fetchAppReleases() {
  try {
    const res = await requestJson<AppReleaseListResponse>('/api/app-release/list')
    appReleaseOptions.value = res.list.map(item => ({
      label: `v${item.version}`,
      value: item.version,
    }))
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载版本列表失败')
  }
}

async function fetchList() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
    })
    if (keyword.value.trim())
      params.set('keyword', keyword.value.trim())
    if (typeFilter.value)
      params.set('type', typeFilter.value)

    const res = await requestJson<ListResponse>(`/api/userFeedbacks?${params.toString()}`)
    list.value = res.list
    total.value = res.total
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载反馈列表失败')
  }
  finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchList()
}

function handlePageChange(info: { current: number, pageSize: number }) {
  page.value = info.current
  pageSize.value = info.pageSize
  fetchList()
}

function handleDelete(row: FeedbackRow) {
  const dialog = DialogPlugin.confirm({
    header: '删除反馈',
    body: `确定要删除 ID 为 ${row.id} 的反馈吗？该操作不可恢复。`,
    theme: 'warning',
    onConfirm: async () => {
      try {
        await requestJson<{ success: boolean }>(`/api/userFeedbacks/${row.id}`, {
          method: 'DELETE',
        })
        MessagePlugin.success('已删除')
        if (list.value.length === 1 && page.value > 1)
          page.value -= 1
        await fetchList()
        await fetchTypes()
      }
      catch (error) {
        MessagePlugin.error(error instanceof Error ? error.message : '删除失败')
      }
      finally {
        dialog.destroy()
      }
    },
    onClose: () => dialog.destroy(),
  })
}

function openImage(url: string) {
  previewImage.value = url
}

function openEdit(row: FeedbackRow) {
  editing.value = row
  editForm.value = {
    status: row.status ?? 'OPEN',
    resolutionType: row.resolutionType ?? 'NONE',
    minAppVersion: row.minAppVersion ?? '',
    resolutionNote: row.resolutionNote ?? '',
  }
}

function closeEdit() {
  editing.value = null
}

async function submitEdit() {
  if (!editing.value) return
  if (editForm.value.resolutionType === 'NEEDS_UPDATE' && !editForm.value.minAppVersion.trim()) {
    MessagePlugin.warning('「需更新版本」必须填写最低版本号')
    return
  }
  editSubmitting.value = true
  try {
    await requestJson<{ success: boolean }>(`/api/userFeedbacks/${editing.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: editForm.value.status,
        resolutionType: editForm.value.resolutionType,
        minAppVersion: editForm.value.minAppVersion.trim() || null,
        resolutionNote: editForm.value.resolutionNote.trim() || null,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    MessagePlugin.success('已更新')
    closeEdit()
    await fetchList()
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '更新失败')
  }
  finally {
    editSubmitting.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchTypes()
  fetchAppReleases()
})

// 状态切走「已修复」时清掉修复类型/版本，避免运营在 OPEN/IN_PROGRESS 误填后保存
watch(() => editForm.value.status, (next) => {
  if (next !== 'RESOLVED') {
    editForm.value.resolutionType = 'NONE'
    editForm.value.minAppVersion = ''
  }
})
</script>

<template>
  <div class="p-6 space-y-4">
    <t-card title="用户反馈">
      <div class="flex flex-wrap gap-3 items-center mb-4">
        <t-input
          v-model="keyword"
          placeholder="按内容搜索"
          clearable
          style="width: 280px"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="typeFilter"
          :options="typeOptions"
          style="width: 200px"
          @change="handleSearch"
        />
        <t-button theme="primary" @click="handleSearch">
          搜索
        </t-button>
        <div class="text-sm text-gray-500 ml-auto">
          共 {{ total }} 条
        </div>
      </div>

      <t-table
        row-key="id"
        :data="list"
        :columns="columns"
        :loading="loading"
        :pagination="{
          current: page,
          pageSize,
          total,
          showJumper: true,
          pageSizeOptions: [10, 20, 50, 100],
        }"
        size="medium"
        stripe
        bordered
        @page-change="handlePageChange"
      >
        <template #user="{ row }">
          <div class="flex gap-2 items-start text-left">
            <t-avatar v-if="row.avatar" :image="row.avatar" size="small" />
            <t-avatar v-else size="small">{{ (row.username || '?').slice(0, 1) }}</t-avatar>
            <div class="min-w-0 flex-1">
              <div class="text-sm truncate">{{ row.username || '未知' }}</div>
              <div class="text-xs text-gray-500">
                <span v-if="row.uid6">#{{ row.uid6 }} · </span>ID:{{ row.userId }}{{ row.phone ? ` · ${row.phone}` : '' }}
              </div>
              <div class="text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                <span class="text-gray-400">最近登录</span>
                <span class="text-gray-600">{{ formatTsShort(row.lastLoginAt) }}</span>
                <t-tag
                  v-if="daysSince(row.lastLoginAt) !== null && daysSince(row.lastLoginAt)! >= STALE_DAYS"
                  theme="warning"
                  variant="light"
                  size="small"
                >
                  {{ daysSince(row.lastLoginAt) }} 天未登录
                </t-tag>
                <t-tag
                  v-else-if="!row.lastLoginAt"
                  theme="default"
                  variant="light"
                  size="small"
                >
                  从未登录
                </t-tag>
              </div>
            </div>
          </div>
        </template>

        <template #type="{ row }">
          <t-tag :theme="typeTheme(row.type)" variant="light">
            {{ typeLabel(row.type) }}
          </t-tag>
        </template>

        <template #content="{ row }">
          <div class="text-left">
            <div class="whitespace-pre-wrap break-words">{{ row.content }}</div>
            <div v-if="row.context" class="text-xs text-gray-400 mt-1" :title="JSON.stringify(row.context, null, 2)">
              {{ summarizeContext(row.context) }}
            </div>
          </div>
        </template>

        <template #images="{ row }">
          <div v-if="row.images && row.images.length" class="flex flex-wrap gap-1">
            <img
              v-for="(img, idx) in row.images"
              :key="idx"
              :src="img"
              class="rounded h-12 w-12 cursor-pointer object-cover"
              @click="openImage(img)"
            >
          </div>
          <span v-else class="text-xs text-gray-400">-</span>
        </template>

        <template #createdAt="{ row }">
          <span class="text-xs text-gray-600">{{ formatDateTime(row.createdAt) }}</span>
        </template>

        <template #status="{ row }">
          <div class="flex flex-col gap-1 items-start">
            <t-tag :theme="STATUS_THEME[row.status as FeedbackStatus] || 'default'" variant="light" size="small">
              {{ STATUS_LABEL[row.status as FeedbackStatus] || row.status }}
            </t-tag>
            <span v-if="row.resolutionType === 'NEEDS_UPDATE' && row.minAppVersion" class="text-xs text-gray-500">
              v{{ row.minAppVersion }}+
            </span>
            <span v-else-if="row.resolutionType === 'NO_UPDATE'" class="text-xs text-gray-500">
              无需更新
            </span>
          </div>
        </template>

        <template #op="{ row }">
          <div class="flex gap-1">
            <t-button theme="primary" variant="text" size="small" @click="openEdit(row)">
              处理
            </t-button>
            <t-button theme="danger" variant="text" size="small" @click="handleDelete(row)">
              删除
            </t-button>
          </div>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      :visible="!!editing"
      header="处理反馈"
      :confirm-btn="{ content: '保存', loading: editSubmitting }"
      :cancel-btn="{ content: '取消' }"
      width="540"
      @close="closeEdit"
      @cancel="closeEdit"
      @confirm="submitEdit"
    >
      <div v-if="editing" class="text-sm text-gray-600 mb-3 p-2 rounded bg-gray-50 max-h-32 overflow-auto whitespace-pre-wrap break-words">
        {{ editing.content }}
      </div>
      <t-form-item label="状态">
        <t-select v-model="editForm.status" :options="STATUS_OPTIONS" />
      </t-form-item>
      <t-form-item v-if="editForm.status === 'RESOLVED'" label="修复类型">
        <t-radio-group v-model="editForm.resolutionType">
          <t-radio v-for="opt in RESOLUTION_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </t-radio>
        </t-radio-group>
      </t-form-item>
      <t-form-item
        v-if="editForm.status === 'RESOLVED' && editForm.resolutionType === 'NEEDS_UPDATE'"
        label="最低版本号"
      >
        <t-select
          v-model="editForm.minAppVersion"
          :options="appReleaseOptions"
          filterable
          placeholder="选择已发布的版本"
        />
      </t-form-item>
      <t-form-item label="回复说明">
        <t-textarea
          v-model="editForm.resolutionNote"
          placeholder="给用户的回复（可选，500 字以内）"
          :maxlength="500"
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </t-form-item>
    </t-dialog>

    <t-dialog
      :visible="!!previewImage"
      :footer="false"
      width="auto"
      header="附图预览"
      @close="previewImage = null"
    >
      <img v-if="previewImage" :src="previewImage" class="max-h-[70vh] max-w-[80vw]">
    </t-dialog>
  </div>
</template>
