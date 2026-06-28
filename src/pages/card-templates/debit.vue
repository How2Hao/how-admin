<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import CardEditDialog from './components/CardEditDialog.vue'

// ── 类型 ────────────────────────────────────────────────────────────────────
interface DebitBankGroup {
  bankId: string
  bankName: string
  bankLogo: string | null
  bankColor: string | null
  total: number
  defaultId: number
  hasCover: boolean
  totalRelated: number
}

interface DebitTemplate {
  id: number
  bankId: string
  cardName: string
  cover: string | null
  isVisible: number
  relatedCount: number
  syncedCount: number
  updatedAt: number | null
  isDefault: boolean
}

interface OptionsResp {
  banks: { label: string, value: number }[]
  cardOrganizations: { label: string, value: number }[]
  cardLevels: { label: string, value: number }[]
}

// ── state ────────────────────────────────────────────────────────────────────
const groups = ref<DebitBankGroup[]>([])
const selectedBankId = ref<string>('')
const templates = ref<DebitTemplate[]>([])
const loadingGroups = ref(false)
const loadingTemplates = ref(false)
const optionsRef = ref<OptionsResp>({ banks: [], cardOrganizations: [], cardLevels: [] })
const sidebarKeyword = ref('')

const editingOpen = ref(false)
const editingId = ref<number | null>(null)

const selectedBank = computed(() =>
  groups.value.find(g => g.bankId === selectedBankId.value),
)
const filteredGroups = computed(() => {
  const k = sidebarKeyword.value.trim()
  if (!k) return groups.value
  return groups.value.filter(g => g.bankName.includes(k))
})
const defaultTemplate = computed(() =>
  templates.value.find(t => t.isDefault) ?? null,
)
const otherTemplates = computed(() =>
  templates.value.filter(t => !t.isDefault),
)

// ── 封面上传 state ─────────────────────────────────────────────────────────
type EnhanceStep = 'idle' | 'enhancing' | 'previewing' | 'uploading' | 'direct-uploading' | 'uploaded'
const step = ref<EnhanceStep>('idle')
const coverUrl = ref('')
const originalPreview = ref('')
const enhancedPreview = ref('')
const uploadedUrl = ref('')
const enhanceMeta = ref<{ originalKb: number; enhancedKb: number; width: number; height: number } | null>(null)
const localPicked = ref(false)
const localOriginalKb = ref(0)
const directUploaded = ref(false)

const isExternalCover = computed(() => {
  if (!coverUrl.value) return false
  return !coverUrl.value.includes('aliyuncs.com') && !coverUrl.value.includes('how2hao-static')
})

// ── loaders ──────────────────────────────────────────────────────────────────
async function loadGroups() {
  loadingGroups.value = true
  try {
    const res = await requestJson<{ list: DebitBankGroup[] }>('/api/debitCardTemplates/bank-groups')
    groups.value = res.list
    if (!selectedBankId.value && res.list.length)
      selectedBankId.value = res.list[0].bankId
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载银行列表失败')
  }
  finally {
    loadingGroups.value = false
  }
}

async function loadOptions() {
  try {
    optionsRef.value = await requestJson<OptionsResp>('/api/cardTemplates/options')
  }
  catch {}
}

async function loadTemplates() {
  if (!selectedBankId.value) return
  loadingTemplates.value = true
  templates.value = []
  try {
    const res = await requestJson<DebitTemplate[]>(
      `/api/debitCardTemplates?bankId=${selectedBankId.value}`,
    )
    templates.value = res
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载模板列表失败')
  }
  finally {
    loadingTemplates.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadGroups(), loadOptions()])
  await loadTemplates()
})

// ── 切换银行 ─────────────────────────────────────────────────────────────────
watch(selectedBankId, async () => {
  resetEnhance()
  await loadTemplates()
  coverUrl.value = defaultTemplate.value?.cover ?? ''
})

watch(defaultTemplate, (tpl) => {
  if (!tpl) return
  if (step.value === 'idle') coverUrl.value = tpl.cover ?? ''
})

// ── 封面上传逻辑 ─────────────────────────────────────────────────────────────
function resetEnhance() {
  step.value = 'idle'
  originalPreview.value = ''
  enhancedPreview.value = ''
  uploadedUrl.value = ''
  enhanceMeta.value = null
  localPicked.value = false
  localOriginalKb.value = 0
  directUploaded.value = false
}

function onPickFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { MessagePlugin.error('请选择图片文件'); return }
  if (file.size > 20 * 1024 * 1024) { MessagePlugin.error('图片不能超过 20MB'); return }
  const reader = new FileReader()
  reader.onload = () => {
    originalPreview.value = String(reader.result || '')
    localOriginalKb.value = Math.round(file.size / 1024)
    enhancedPreview.value = ''
    enhanceMeta.value = null
    directUploaded.value = false
    localPicked.value = true
    step.value = 'previewing'
  }
  reader.onerror = () => MessagePlugin.error('读取文件失败')
  reader.readAsDataURL(file)
  input.value = ''
}

async function handleEnhance() {
  const usingLocal = localPicked.value && !!originalPreview.value
  if (!usingLocal && !coverUrl.value) { MessagePlugin.error('请先填写封面 URL'); return }
  const prev = step.value
  step.value = 'enhancing'
  try {
    const res = await requestJson<{
      originalBase64: string; enhancedBase64: string
      originalKb: number; enhancedKb: number; width: number; height: number
    }>('/api/cardTemplates/enhance-cover', {
      method: 'POST',
      body: usingLocal ? { sourceBase64: originalPreview.value } : { sourceUrl: coverUrl.value },
    })
    if (!usingLocal) originalPreview.value = res.originalBase64
    enhancedPreview.value = res.enhancedBase64
    enhanceMeta.value = { originalKb: usingLocal ? localOriginalKb.value : res.originalKb, enhancedKb: res.enhancedKb, width: res.width, height: res.height }
    step.value = 'previewing'
  }
  catch (e: any) {
    step.value = usingLocal ? 'previewing' : prev
    MessagePlugin.error(e?.message ?? '高清化失败')
  }
}

async function handleDirectUpload() {
  if (!defaultTemplate.value || !coverUrl.value) { MessagePlugin.error('请先填写封面 URL'); return }
  step.value = 'direct-uploading'
  try {
    const res = await requestJson<{ url: string; syncedCount: number }>(
      `/api/debitCardTemplates/${defaultTemplate.value.id}/upload-cover`,
      { method: 'POST', body: { sourceUrl: coverUrl.value } },
    )
    uploadedUrl.value = res.url
    directUploaded.value = true
    step.value = 'uploaded'
    applyUploaded(defaultTemplate.value.id, res.url, res.syncedCount)
  }
  catch (e: any) {
    step.value = 'idle'
    MessagePlugin.error(e?.message ?? '上传失败')
  }
}

async function handleUpload() {
  if (!defaultTemplate.value) return
  const buf = enhancedPreview.value || originalPreview.value
  if (!buf) return
  const usingOriginalOnly = !enhancedPreview.value
  step.value = 'uploading'
  try {
    const res = await requestJson<{ url: string; syncedCount: number }>(
      `/api/debitCardTemplates/${defaultTemplate.value.id}/upload-cover`,
      { method: 'POST', body: { enhancedBase64: buf } },
    )
    uploadedUrl.value = res.url
    if (usingOriginalOnly) directUploaded.value = true
    step.value = 'uploaded'
    applyUploaded(defaultTemplate.value.id, res.url, res.syncedCount)
  }
  catch (e: any) {
    step.value = 'previewing'
    MessagePlugin.error(e?.message ?? '上传失败')
  }
}

function applyUploaded(templateId: number, url: string, syncedCount: number) {
  const tpl = templates.value.find(t => t.id === templateId)
  if (tpl) { tpl.cover = url; tpl.syncedCount += syncedCount }
  coverUrl.value = url
  const grp = groups.value.find(g => g.bankId === selectedBankId.value)
  if (grp) grp.hasCover = true
  MessagePlugin.success(
    syncedCount > 0 ? `封面已上传并同步到 ${syncedCount} 张用户卡` : '封面已上传（无需同步的用户卡）',
  )
}

// ── 其他模板编辑 ────────────────────────────────────────────────────────────
function handleEditOther(id: number) {
  editingId.value = id
  editingOpen.value = true
}

async function handleSaved() {
  editingOpen.value = false
  await loadTemplates()
}
</script>

<template>
  <div class="page-debit">
    <!-- ── 左侧银行列表 ─────────────────────────────────── -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <t-input v-model="sidebarKeyword" placeholder="搜索银行" clearable size="small" />
      </div>
      <t-loading v-if="loadingGroups" class="sidebar-loading" size="small" />
      <div v-else class="bank-list">
        <div
          v-for="grp in filteredGroups"
          :key="grp.bankId"
          class="bank-item"
          :class="{ selected: grp.bankId === selectedBankId }"
          @click="selectedBankId = grp.bankId"
        >
          <img v-if="grp.bankLogo" :src="grp.bankLogo" class="bank-logo" :alt="grp.bankName">
          <div v-else class="bank-logo placeholder" />
          <div class="bank-info">
            <div class="bank-name">{{ grp.bankName }}</div>
            <div class="bank-meta">
              <span class="count">{{ grp.total }} 个模板</span>
              <span class="cover-badge" :class="grp.hasCover ? 'has' : 'none'">
                {{ grp.hasCover ? '已设封面' : '未设封面' }}
              </span>
            </div>
          </div>
        </div>
        <t-empty v-if="!filteredGroups.length" size="small" description="无匹配银行" />
      </div>
    </aside>

    <!-- ── 右侧内容区 ──────────────────────────────────── -->
    <main v-if="selectedBank" class="detail">
      <t-loading v-if="loadingTemplates" class="detail-loading" />

      <template v-else-if="defaultTemplate">
        <!-- ① 默认模板：封面管理 -->
        <section class="section-default">
          <div class="section-title">
            <span class="bank-heading">{{ selectedBank.bankName }}</span>
            <span class="default-tag">默认模板</span>
            <span class="template-id">#{{ defaultTemplate.id }}</span>
            <span class="dot">·</span>
            <span class="stat">关联 {{ defaultTemplate.relatedCount }} 张</span>
            <span class="dot">·</span>
            <span class="stat">已同步 {{ defaultTemplate.syncedCount }} 张</span>
          </div>

          <div class="cover-row">
            <!-- 封面预览 -->
            <div class="cover-wrap">
              <img v-if="defaultTemplate.cover" :src="defaultTemplate.cover" class="cover-img">
              <div v-else class="cover-placeholder"><span>暂无封面</span></div>
            </div>

            <!-- 上传操作区 -->
            <div class="upload-area">
              <div class="url-row">
                <t-input v-model="coverUrl" placeholder="封面图 URL" @change="resetEnhance" />
              </div>
              <div v-if="step === 'idle'" class="file-row">
                <input type="file" accept="image/*" @change="onPickFile">
                <span class="file-hint">选本地图片</span>
              </div>

              <div v-if="coverUrl && step === 'idle'" class="action-row">
                <img :src="coverUrl" class="url-thumb">
                <div class="action-btns">
                  <template v-if="isExternalCover">
                    <t-button theme="primary" size="small" @click="handleEnhance">下载并高清化</t-button>
                    <t-button variant="outline" size="small" @click="handleDirectUpload">直接上传</t-button>
                  </template>
                  <span v-else class="oss-hint">已是 OSS 图片</span>
                </div>
              </div>

              <div v-if="step === 'enhancing'" class="status-row">
                <t-loading size="small" /><span>正在高清化…</span>
              </div>
              <div v-if="step === 'direct-uploading'" class="status-row">
                <t-loading size="small" /><span>上传中…</span>
              </div>

              <div v-if="['previewing','uploading','uploaded'].includes(step) && !directUploaded" class="preview-box">
                <div class="preview-grid" :class="enhancedPreview ? 'two-col' : 'one-col'">
                  <div class="preview-col">
                    <div class="preview-label">
                      {{ enhancedPreview
                        ? `原图 (${enhanceMeta?.originalKb ?? localOriginalKb} KB)`
                        : `${localPicked ? '本地预览' : '原图'} (${localOriginalKb || enhanceMeta?.originalKb} KB)` }}
                    </div>
                    <img :src="originalPreview" class="preview-img">
                  </div>
                  <div v-if="enhancedPreview" class="preview-col">
                    <div class="preview-label">高清 ({{ enhanceMeta?.width }}×{{ enhanceMeta?.height }} · {{ enhanceMeta?.enhancedKb }} KB)</div>
                    <img :src="enhancedPreview" class="preview-img">
                  </div>
                </div>
                <div class="preview-actions">
                  <template v-if="step === 'previewing'">
                    <t-button variant="outline" size="small" @click="resetEnhance">取消</t-button>
                    <t-button v-if="!enhancedPreview" variant="outline" size="small" @click="handleEnhance">高清化</t-button>
                    <t-button theme="primary" size="small" @click="handleUpload">上传并同步</t-button>
                  </template>
                  <t-button v-else-if="step === 'uploading'" theme="primary" size="small" loading>上传中…</t-button>
                  <template v-else-if="step === 'uploaded'">
                    <span class="uploaded-url" :title="uploadedUrl">{{ uploadedUrl }}</span>
                    <t-button variant="outline" size="small" @click="resetEnhance">关闭</t-button>
                  </template>
                </div>
              </div>

              <div v-if="step === 'uploaded' && directUploaded" class="preview-box">
                <img :src="uploadedUrl" class="direct-thumb">
                <div class="preview-actions">
                  <span class="uploaded-url" :title="uploadedUrl">{{ uploadedUrl }}</span>
                  <t-button variant="outline" size="small" @click="resetEnhance">关闭</t-button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <t-divider />

        <!-- ② 其他模板 -->
        <section class="section-others">
          <div class="others-header">
            <span class="others-title">其他{{ selectedBank.bankName }}借记卡模板</span>
            <span v-if="otherTemplates.length" class="others-count">{{ otherTemplates.length }} 个</span>
          </div>
          <t-empty v-if="!otherTemplates.length" size="small" description="暂无其他借记卡模板" />
          <div v-else class="others-grid">
            <div
              v-for="tpl in otherTemplates"
              :key="tpl.id"
              class="other-card"
              :class="{ hidden: tpl.isVisible === 0 }"
              @click="handleEditOther(tpl.id)"
            >
              <div class="other-cover">
                <img v-if="tpl.cover" :src="tpl.cover" class="other-cover-img">
                <div v-else class="other-cover-placeholder" />
              </div>
              <div class="other-info">
                <div class="other-name" :title="tpl.cardName">{{ tpl.cardName }}</div>
                <div class="other-id">#{{ tpl.id }} · {{ tpl.relatedCount }} 张</div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>

    <main v-else class="detail detail--empty">
      <t-empty description="从左侧选择一家银行" />
    </main>

    <CardEditDialog
      :visible="editingOpen"
      :template-id="editingId"
      :options="optionsRef"
      @update:visible="(v) => editingOpen = v"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.page-debit {
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;
}

/* ── sidebar ── */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-header { padding: 12px; border-bottom: 1px solid #e5e7eb; }
.sidebar-loading { padding: 24px; }
.bank-list { flex: 1; overflow-y: auto; }

.bank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background .12s;
}
.bank-item:hover { background: #f9fafb; }
.bank-item.selected { background: #eff6ff; }
.bank-logo { width: 28px; height: 28px; border-radius: 6px; object-fit: contain; flex-shrink: 0; background: #f1f5f9; }
.bank-logo.placeholder { background: #e5e7eb; }
.bank-info { min-width: 0; }
.bank-name { font-size: 13px; font-weight: 600; color: #1f2937; }
.bank-meta { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.count { font-size: 11px; color: #9ca3af; }
.cover-badge { font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; }
.cover-badge.has { background: #dcfce7; color: #166534; }
.cover-badge.none { background: #fee2e2; color: #991b1b; }

/* ── detail ── */
.detail {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}
.detail--empty { align-items: center; justify-content: center; }
.detail-loading { margin: auto; }

.section-default { flex-shrink: 0; }
.section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.bank-heading { font-size: 17px; font-weight: 700; color: #111827; }
.default-tag { font-size: 11px; font-weight: 700; background: #dbeafe; color: #1d4ed8; padding: 2px 7px; border-radius: 4px; }
.template-id { font-size: 12px; color: #9ca3af; font-family: ui-monospace, monospace; }
.dot { color: #d1d5db; font-size: 12px; }
.stat { font-size: 12px; color: #9ca3af; }

.cover-row { display: flex; gap: 24px; align-items: flex-start; }
.cover-wrap { width: 240px; height: 152px; flex-shrink: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; background: #0d1124; }
.cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e5e7eb; color: #9ca3af; font-size: 13px; }

.upload-area { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.url-row { display: flex; }
.file-row { display: flex; align-items: center; gap: 8px; }
.file-hint { font-size: 12px; color: #9ca3af; }
.action-row { display: flex; gap: 12px; align-items: flex-start; }
.url-thumb { width: 96px; height: 60px; object-fit: cover; border-radius: 5px; border: 1px solid #e5e7eb; flex-shrink: 0; }
.action-btns { display: flex; flex-direction: column; gap: 6px; }
.oss-hint { font-size: 12px; color: #9ca3af; }
.status-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; }

.preview-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
.preview-grid { display: grid; gap: 10px; }
.two-col { grid-template-columns: 1fr 1fr; }
.one-col { grid-template-columns: 1fr; }
.preview-col { display: flex; flex-direction: column; gap: 4px; }
.preview-label { font-size: 11px; color: #9ca3af; text-align: center; }
.preview-img { width: 100%; max-height: 160px; object-fit: contain; background: #fff; border-radius: 4px; border: 1px solid #e5e7eb; }
.direct-thumb { display: block; max-height: 140px; margin: 0 auto 8px; object-fit: contain; border-radius: 4px; }
.preview-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 10px; }
.uploaded-url { font-size: 11px; color: #9ca3af; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* others section */
.section-others { flex: 1; min-height: 0; padding-top: 4px; }
.others-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.others-title { font-size: 14px; font-weight: 600; color: #374151; }
.others-count { font-size: 12px; color: #9ca3af; }
.others-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 340px);
  gap: 12px;
  align-content: start;
}
.other-card {
  width: 340px; height: 108px;
  display: flex;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
}
.other-card:hover { transform: translateY(-1px); border-color: #cbd5e1; }
.other-card.hidden { opacity: .5; }
.other-cover { width: 170px; height: 108px; flex-shrink: 0; background: #0d1124; }
.other-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.other-cover-placeholder { width: 100%; height: 100%; background: #e5e7eb; }
.other-info { flex: 1; min-width: 0; padding: 14px; display: flex; flex-direction: column; justify-content: center; }
.other-name { font-size: 13px; font-weight: 600; color: #1f2937; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.other-id { font-size: 11px; color: #bbb; margin-top: 6px; font-family: ui-monospace, monospace; }
</style>
