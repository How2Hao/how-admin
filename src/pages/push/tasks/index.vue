<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { useRouter } from 'vue-router'
import UserPicker from '@/components/push/UserPicker.vue'
import TagPicker from '@/components/push/TagPicker.vue'
import { DEEPLINK_TARGETS, buildRoutePayload } from '../deeplink-targets'

const router = useRouter()

type AudienceType = 'ALL' | 'USER_IDS' | 'TAGS'
type LandingType = 'NONE' | 'DEEPLINK' | 'WEB'

type PushType = 'ACTIVITY' | 'ANNOUNCEMENT' | 'FEEDBACK_REPLY' | 'SYSTEM'

interface PushTaskRow {
  id: number
  name: string
  status: string
  triggerSource: string
  type: PushType
  deliveryMode: 'APNS' | 'INBOX'
  audienceType: AudienceType
  audienceUserIds: number[] | null
  audienceTagIds: number[] | null
  audienceTagOp: string | null
  audienceSnapshotCount: number | null
  title: string
  body: string
  imageUrl: string | null
  landingType: LandingType
  landingPayload: any
  statsTotal: number
  statsInboxWritten: number
  statsSent: number
  statsFailed: number
  statsOpened: number
  statsFilteredByType: number
  statsFilteredByMaster: number
  createdAt: number
}

// ───── 表单状态 ─────
interface Form {
  name: string
  type: PushType
  deliveryMode: 'APNS' | 'INBOX'
  audienceType: AudienceType
  audienceUserIds: number[]
  audienceTagIds: number[]
  audienceTagOp: 'AND' | 'OR'
  confirmAll: boolean
  title: string
  body: string
  imageUrl: string | null
  landingType: LandingType
  landingPayload: { type: 'route', route: string, params?: Record<string, string> } | { type: 'url', url: string } | null
}
function emptyForm(): Form {
  return {
    name: '',
    type: 'ACTIVITY',
    deliveryMode: 'APNS',
    audienceType: 'TAGS',
    audienceUserIds: [],
    audienceTagIds: [],
    audienceTagOp: 'AND',
    confirmAll: false,
    title: '',
    body: '',
    imageUrl: null,
    landingType: 'NONE',
    landingPayload: null,
  }
}

const TYPE_OPTIONS: { value: PushType, label: string, desc: string }[] = [
  { value: 'ACTIVITY', label: '🎁 活动推送', desc: '运营活动 / 优惠 / 营销 — 受用户"活动推送"开关控制' },
  { value: 'ANNOUNCEMENT', label: '📢 系统公告', desc: '版本更新 / 维护通知 — 受"系统公告"开关控制' },
  { value: 'FEEDBACK_REPLY', label: '💬 反馈回复', desc: '反馈处理结果 — 一般由系统自动触发，admin 慎用' },
  { value: 'SYSTEM', label: '⚠️ 系统消息', desc: '安全提醒 / 强制更新 — 强制下发，用户开关无效' },
]
const form = ref<Form>(emptyForm())
const deeplinkTargetKey = ref('')
const deeplinkParamCode = ref('')
const plazaTabs = ref<{ code: string, name: string }[]>([])
const selectedTarget = computed(() => DEEPLINK_TARGETS.find(t => t.key === deeplinkTargetKey.value) ?? null)

async function loadPlazaTabs() {
  try {
    const r = await requestJson<{ list: { code: string, name: string, isVisible: number }[] }>('/api/plazaCustomTabs')
    plazaTabs.value = (r.list ?? []).filter(t => t.isVisible === 1).map(t => ({ code: t.code, name: t.name }))
  }
  catch {
    plazaTabs.value = []
  }
}

function rebuildDeeplinkPayload() {
  if (form.value.landingType !== 'DEEPLINK')
    return
  const target = selectedTarget.value
  form.value.landingPayload = target ? buildRoutePayload(target, deeplinkParamCode.value) : null
}

watch(deeplinkTargetKey, () => {
  deeplinkParamCode.value = ''
  rebuildDeeplinkPayload()
})
watch(deeplinkParamCode, rebuildDeeplinkPayload)
watch(() => form.value.landingType, (t) => {
  if (t !== 'DEEPLINK') {
    deeplinkTargetKey.value = ''
    deeplinkParamCode.value = ''
  }
  if (t === 'NONE')
    form.value.landingPayload = null
  if (t === 'DEEPLINK')
    rebuildDeeplinkPayload()
})

const formCollapsed = ref(false)
const submitting = ref(false)

// ───── 受众预览 ─────
const audiencePreview = ref<{ userCount: number, deviceCount: number } | null>(null)
const previewing = ref(false)
let previewTimer: ReturnType<typeof setTimeout> | null = null

async function refreshAudiencePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    previewing.value = true
    try {
      const r = await requestJson<{ userCount: number, deviceCount: number }>('/api/admin/push/audience-preview', {
        method: 'POST',
        body: {
          audienceType: form.value.audienceType,
          audienceUserIds: form.value.audienceUserIds,
          audienceTagIds: form.value.audienceTagIds,
          audienceTagOp: form.value.audienceTagOp,
        },
      })
      audiencePreview.value = r
    }
    catch {
      audiencePreview.value = null
    }
    finally {
      previewing.value = false
    }
  }, 300)
}

watch(() => [form.value.audienceType, form.value.audienceUserIds, form.value.audienceTagIds, form.value.audienceTagOp], refreshAudiencePreview, { deep: true })

// ───── 图片上传 ─────
const imageUploading = ref(false)
function onPickImage(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    MessagePlugin.error('请选择图片文件')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    MessagePlugin.error('图片不能超过 5MB')
    return
  }
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = String(reader.result || '')
    imageUploading.value = true
    try {
      const r = await requestJson<{ url: string }>('/api/admin/upload/inbox-image', {
        method: 'POST',
        body: { imageBase64: base64 },
      })
      form.value.imageUrl = r.url
      MessagePlugin.success('图片上传完成')
    }
    catch (e: any) {
      MessagePlugin.error(e?.message ?? '图片上传失败')
    }
    finally {
      imageUploading.value = false
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

// ───── 列表 ─────
const tasks = ref<PushTaskRow[]>([])
const loadingTasks = ref(false)

async function fetchTasks() {
  loadingTasks.value = true
  try {
    const r = await requestJson<{ list: PushTaskRow[] }>('/api/admin/push/tasks')
    tasks.value = r.list
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载任务列表失败')
  }
  finally {
    loadingTasks.value = false
  }
}

// ───── 提交 ─────
async function submit(action: 'send' | 'draft') {
  if (!form.value.name.trim()) {
    MessagePlugin.warning('请填写任务名称')
    return
  }
  if (!form.value.title.trim() || !form.value.body.trim()) {
    MessagePlugin.warning('请填写标题和正文')
    return
  }
  if (form.value.audienceType === 'USER_IDS' && form.value.audienceUserIds.length === 0) {
    MessagePlugin.warning('请选择目标用户')
    return
  }
  if (form.value.audienceType === 'TAGS' && form.value.audienceTagIds.length === 0) {
    MessagePlugin.warning('请选择目标标签')
    return
  }
  if (form.value.landingType === 'DEEPLINK' && (!form.value.landingPayload || !(form.value.landingPayload as any).route)) {
    MessagePlugin.warning('请填写 APP 内跳转路由')
    return
  }
  if (form.value.landingType === 'WEB' && (!form.value.landingPayload || !(form.value.landingPayload as any).url)) {
    MessagePlugin.warning('请填写外链 URL')
    return
  }

  if (form.value.audienceType === 'ALL' && !form.value.confirmAll) {
    MessagePlugin.warning('全员推送请勾选下方"我已确认"复选框')
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      type: form.value.type,
      deliveryMode: form.value.deliveryMode,
      audienceType: form.value.audienceType,
      audienceUserIds: form.value.audienceType === 'USER_IDS' ? form.value.audienceUserIds : undefined,
      audienceTagIds: form.value.audienceType === 'TAGS' ? form.value.audienceTagIds : undefined,
      audienceTagOp: form.value.audienceType === 'TAGS' ? form.value.audienceTagOp : undefined,
      confirmAll: form.value.audienceType === 'ALL' ? true : undefined,
      title: form.value.title.trim(),
      body: form.value.body.trim(),
      imageUrl: form.value.imageUrl,
      landingType: form.value.landingType,
      landingPayload: form.value.landingPayload,
      action: action === 'draft' ? 'draft' : 'send',
    }
    const created = await requestJson<{ id: number }>('/api/admin/push/tasks', {
      method: 'POST',
      body: payload,
    })

    if (action === 'send') {
      const result = await requestJson<{ total: number, inboxWritten: number, sent: number, failed: number, filteredByType: number, filteredByMaster: number }>(
        `/api/admin/push/tasks/${created.id}/send`,
        { method: 'POST' },
      )
      if (result.total === 0) {
        MessagePlugin.warning('没有用户符合受众条件')
      }
      else {
        MessagePlugin.success(
          `发送完成 · 受众 ${result.total} · 消息中心 ${result.inboxWritten} · 横幅 ${result.sent} 成功 / ${result.failed} 失败`
          + (result.filteredByType > 0 ? ` · 被类型开关过滤 ${result.filteredByType}` : '')
          + (result.filteredByMaster > 0 ? ` · 总开关关闭 ${result.filteredByMaster}` : ''),
        )
      }
    }
    else {
      MessagePlugin.success('草稿已保存')
    }

    form.value = emptyForm()
    deeplinkTargetKey.value = ''
    deeplinkParamCode.value = ''
    audiencePreview.value = null
    await fetchTasks()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '提交失败')
  }
  finally {
    submitting.value = false
  }
}

// ───── 列表 helper ─────
const STATUS_LABEL: Record<string, { label: string, theme: any }> = {
  DRAFT: { label: '草稿', theme: 'default' },
  SCHEDULED: { label: '已定时', theme: 'primary' },
  SENDING: { label: '发送中', theme: 'warning' },
  DONE: { label: '已完成', theme: 'success' },
  FAILED: { label: '失败', theme: 'danger' },
  CANCELED: { label: '已取消', theme: 'default' },
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function audienceText(t: PushTaskRow) {
  if (t.audienceType === 'ALL') return '全员'
  if (t.audienceType === 'USER_IDS') return `指定用户 ${t.audienceUserIds?.length ?? 0} 人`
  return `标签 ${t.audienceTagIds?.length ?? 0} 个 (${t.audienceTagOp || 'AND'})`
}

function landingText(t: PushTaskRow) {
  if (t.landingType === 'NONE') return null
  if (t.landingType === 'DEEPLINK') {
    const p = t.landingPayload || {}
    const route = p.route || p?.payload?.route
    const label = DEEPLINK_TARGETS.find(d => d.route === route)?.label || route || '?'
    const code = p.params?.code
    return `跳转 → ${label}${code ? `（${code}）` : ''}`
  }
  return `外链 → ${(t.landingPayload || {}).url || '?'}`
}

onMounted(() => {
  fetchTasks()
  loadPlazaTabs()
})
</script>

<template>
  <div class="page-tasks">
    <!-- 顶部：表单 -->
    <t-card class="form-card">
      <template #header>
        <div class="form-header">
          <span class="title">创建推送任务</span>
          <t-button
            size="small"
            variant="text"
            @click="formCollapsed = !formCollapsed"
          >
            {{ formCollapsed ? '展开 ▾' : '收起 ▴' }}
          </t-button>
        </div>
      </template>
      <div v-show="!formCollapsed" class="form-body">
        <div class="form-grid">
          <!-- 左栏：内容 -->
          <div class="form-left">
            <t-form-item label="任务名称" required>
              <t-input v-model="form.name" placeholder="运营内部识别，例：5月家电节首推" />
            </t-form-item>

            <t-form-item label="通知分类" required>
              <t-radio-group v-model="form.type">
                <t-radio v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </t-radio>
              </t-radio-group>
              <div class="type-desc">
                {{ TYPE_OPTIONS.find(o => o.value === form.type)?.desc }}
              </div>
            </t-form-item>

            <t-form-item label="下发方式">
              <t-radio-group v-model="form.deliveryMode">
                <t-radio value="APNS">横幅 + 消息中心</t-radio>
                <t-radio value="INBOX">仅消息中心</t-radio>
              </t-radio-group>
              <div style="margin-top: 4px; font-size: 12px; color: #94a3b8;">
                {{ form.deliveryMode === 'INBOX'
                  ? '所有人都只进消息中心，不弹横幅 / 声音（安静通知）'
                  : '能收横幅的用户弹横幅，其余仅进消息中心' }}
              </div>
            </t-form-item>

            <t-form-item label="落地形式" required>
              <t-radio-group v-model="form.landingType">
                <t-radio value="NONE">纯文字</t-radio>
                <t-radio value="DEEPLINK">带跳转（APP 内）</t-radio>
                <t-radio value="WEB">带跳转（外链）</t-radio>
              </t-radio-group>
            </t-form-item>

            <t-form-item label="标题" required>
              <t-input v-model="form.title" placeholder="≤ 50 字（建议）" :maxlength="200" />
            </t-form-item>

            <t-form-item label="正文" required>
              <t-textarea v-model="form.body" placeholder="≤ 500 字（建议）" :maxlength="2000" :autosize="{ minRows: 2, maxRows: 5 }" />
            </t-form-item>

            <t-form-item label="配图">
              <div class="image-uploader">
                <input
                  type="file"
                  accept="image/*"
                  class="text-sm"
                  @change="onPickImage"
                >
                <span v-if="imageUploading" class="text-xs text-gray-500">上传中...</span>
                <div v-if="form.imageUrl" class="image-preview">
                  <img :src="form.imageUrl" class="preview-img">
                  <t-button size="small" variant="text" theme="danger" @click="form.imageUrl = null">移除</t-button>
                </div>
              </div>
            </t-form-item>

            <t-form-item v-if="form.landingType === 'DEEPLINK'" label="跳转页面">
              <t-select
                v-model="deeplinkTargetKey"
                placeholder="选择 APP 内页面"
                :options="DEEPLINK_TARGETS.map(t => ({ label: t.label, value: t.key }))"
              />
            </t-form-item>
            <t-form-item
              v-if="form.landingType === 'DEEPLINK' && selectedTarget?.param?.source === 'plazaCustomTab'"
              :label="selectedTarget?.param?.label"
            >
              <t-select
                v-model="deeplinkParamCode"
                clearable
                placeholder="选择活动（选填，不选进默认 Tab）"
                :options="plazaTabs.map(t => ({ label: t.name, value: t.code }))"
              />
            </t-form-item>
            <t-form-item v-if="form.landingType === 'WEB'" label="外链 URL">
              <t-input
                :value="(form.landingPayload as any)?.url ?? ''"
                placeholder="https://..."
                @update:model-value="(v) => form.landingPayload = { type: 'url', url: String(v) }"
              />
            </t-form-item>
          </div>

          <!-- 右栏：人群 + 操作 -->
          <div class="form-right">
            <div class="section-title">选择人群</div>
            <t-radio-group v-model="form.audienceType">
              <t-radio value="TAGS">按标签</t-radio>
              <t-radio value="USER_IDS">指定用户</t-radio>
              <t-radio value="ALL">全员</t-radio>
            </t-radio-group>

            <div v-if="form.audienceType === 'TAGS'" class="audience-area">
              <TagPicker
                v-model="form.audienceTagIds"
                v-model:op="form.audienceTagOp"
              />
            </div>

            <div v-if="form.audienceType === 'USER_IDS'" class="audience-area">
              <UserPicker v-model="form.audienceUserIds" />
            </div>

            <div v-if="form.audienceType === 'ALL'" class="all-warning">
              <div class="all-warning-title">⚠️ 全员推送</div>
              <div class="all-warning-text">
                将向所有注册用户推送（包含从未开过 push 的用户—— 这些会落到 inbox）。
                可能严重打扰用户，请慎用。
              </div>
              <t-checkbox v-model="form.confirmAll">
                我已确认全员推送的影响，需要执行
              </t-checkbox>
            </div>

            <div class="preview-box">
              <div class="preview-label">预计触达</div>
              <div class="preview-stats">
                <span class="preview-num">{{ audiencePreview?.userCount ?? '—' }}</span>
                <span class="preview-unit">人进消息中心</span>
                <template v-if="form.deliveryMode === 'APNS'">
                  <span class="preview-sep">·</span>
                  <span class="preview-num">{{ audiencePreview?.deviceCount ?? '—' }}</span>
                  <span class="preview-unit">人可收横幅</span>
                </template>
                <span v-else class="preview-unit">（仅消息中心，不发横幅）</span>
                <t-loading v-if="previewing" size="small" style="margin-left: 6px" />
              </div>
            </div>

            <div class="form-actions">
              <t-button variant="outline" :loading="submitting" @click="submit('draft')">保存草稿</t-button>
              <t-button theme="primary" :loading="submitting" @click="submit('send')">立即发送</t-button>
            </div>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 下方：列表 -->
    <div class="list-header">
      <span class="title">历史任务</span>
      <span class="count">{{ tasks.length }} 条</span>
      <t-button size="small" variant="text" @click="fetchTasks">
        <template #icon><div i-carbon:rotate /></template>
        刷新
      </t-button>
    </div>

    <t-loading :loading="loadingTasks && tasks.length === 0">
      <t-empty v-if="!loadingTasks && tasks.length === 0" description="还没有发过推送" />
      <div v-else class="tasks-list">
        <div v-for="t in tasks" :key="t.id" class="task-card" @click="router.push(`/push/tasks/${t.id}`)">
          <div class="task-main">
            <div class="task-head">
              <span class="task-name">{{ t.name }}</span>
              <t-tag :theme="STATUS_LABEL[t.status]?.theme ?? 'default'" size="small">
                {{ STATUS_LABEL[t.status]?.label ?? t.status }}
              </t-tag>
              <t-tag v-if="t.landingType !== 'NONE'" theme="primary" variant="light" size="small">带跳转</t-tag>
              <t-tag v-if="t.imageUrl" theme="success" variant="light" size="small">含图</t-tag>
              <t-tag v-if="t.triggerSource === 'SYSTEM'" theme="default" variant="light" size="small">系统</t-tag>
              <t-tag v-if="t.deliveryMode === 'INBOX'" theme="warning" variant="light" size="small">仅消息中心</t-tag>
              <span class="task-time">{{ fmtTime(t.createdAt) }}</span>
            </div>
            <div class="task-row">📋 {{ t.title }}</div>
            <div class="task-row task-body">📝 {{ t.body.slice(0, 120) }}{{ t.body.length > 120 ? '...' : '' }}</div>
            <div class="task-row">👥 {{ audienceText(t) }} · {{ t.audienceSnapshotCount ?? '?' }} 用户</div>
            <div v-if="landingText(t)" class="task-row">🔗 {{ landingText(t) }}</div>
          </div>
          <div class="task-stats">
            <div class="stat-item">
              <div class="stat-num">{{ t.statsInboxWritten }}</div>
              <div class="stat-label">消息中心</div>
            </div>
            <div class="stat-item">
              <div class="stat-num">{{ t.statsSent }}</div>
              <div class="stat-label">横幅送达</div>
            </div>
            <div class="stat-item">
              <div class="stat-num failed">{{ t.statsFailed }}</div>
              <div class="stat-label">失败</div>
            </div>
            <div class="stat-item">
              <div class="stat-num success">{{ t.statsOpened }}</div>
              <div class="stat-label">打开</div>
            </div>
            <div class="stat-item">
              <div class="stat-num">{{ t.statsInboxWritten > 0 ? `${(t.statsOpened / t.statsInboxWritten * 100).toFixed(1)}%` : '—' }}</div>
              <div class="stat-label">打开率</div>
            </div>
          </div>
        </div>
      </div>
    </t-loading>
  </div>
</template>

<style scoped>
.page-tasks {
  padding: 16px 24px;
  display: flex; flex-direction: column; gap: 16px;
}
.form-card { background: white; }
.form-header { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 15px; font-weight: 600; }
.form-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }
.form-left, .form-right { display: flex; flex-direction: column; gap: 8px; }
.section-title { font-size: 13px; color: #475569; font-weight: 600; margin-bottom: 4px; }

.image-uploader { display: flex; flex-direction: column; gap: 6px; }
.image-preview { display: flex; align-items: center; gap: 8px; }
.preview-img { width: 100px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb; }

.audience-area {
  margin-top: 8px;
  padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e5e7eb;
}

.preview-box {
  margin-top: 12px; padding: 10px 12px;
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;
}
.preview-label { font-size: 11px; color: #1e40af; }
.preview-stats { display: flex; align-items: baseline; gap: 4px; margin-top: 4px; }
.preview-num { font-size: 20px; font-weight: 700; color: #1e3a8a; }
.preview-unit { font-size: 12px; color: #1e40af; }
.preview-sep { color: #94a3b8; margin: 0 4px; }

.type-desc {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.all-warning {
  margin-top: 8px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
}
.all-warning-title { font-size: 12px; font-weight: 700; color: #991b1b; }
.all-warning-text { font-size: 12px; color: #7f1d1d; margin: 4px 0 8px; line-height: 1.5; }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }

.list-header { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.count { font-size: 12px; color: #94a3b8; }

.tasks-list { display: flex; flex-direction: column; gap: 12px; }
.task-card {
  display: flex; gap: 16px; background: white;
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.task-card:hover { border-color: #93c5fd; background: #f8fafc; }
.task-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.task-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-name { font-size: 14px; font-weight: 700; color: #0f172a; }
.task-time { font-size: 11px; color: #94a3b8; margin-left: auto; }
.task-row { font-size: 12px; color: #475569; }
.task-body { color: #64748b; }
.task-stats {
  display: flex; gap: 12px;
  border-left: 1px solid #f1f5f9; padding-left: 16px;
}
.stat-item { text-align: center; min-width: 60px; }
.stat-num { font-size: 18px; font-weight: 700; color: #0f172a; }
.stat-num.failed { color: #dc2626; }
.stat-num.success { color: #16a34a; }
.stat-label { font-size: 11px; color: #94a3b8; margin-top: 2px; }
</style>
