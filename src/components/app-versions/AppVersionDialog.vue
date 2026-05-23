<!-- src/components/app-versions/AppVersionDialog.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { requestJson } from '@/composables/useJsonRequest'

interface Row {
  id: number
  version: string
  changelog: string
  androidUrl: string | null
  iosUrl: string | null
  isMandatory: number
  publishedAt: number
  article: string | null
  articleTitle: string | null
}

const props = defineProps<{ visible: boolean, row: Row | null, target: 'draft' | 'published' }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

const form = ref({
  version: '',
  changelog: '',
  androidUrl: '' as string | undefined,
  iosUrl: '' as string | undefined,
  isMandatory: 0,
  publishedAt: undefined as number | undefined,
  articleTitle: '',
  article: '',
})

const saving = ref(false)
const isEdit = computed(() => props.row != null)
const header = computed(() => {
  if (props.target === 'published') return isEdit.value ? '编辑已发布版本' : '新增已发布版本'
  return isEdit.value ? '编辑草稿' : '新增版本（存草稿）'
})
const confirmText = computed(() => (props.target === 'published' ? '保存' : '保存草稿'))

function reset() {
  if (props.row) {
    form.value = {
      version: props.row.version,
      changelog: props.row.changelog,
      androidUrl: props.row.androidUrl ?? undefined,
      iosUrl: props.row.iosUrl ?? undefined,
      isMandatory: props.row.isMandatory,
      publishedAt: props.row.publishedAt ?? undefined,
      articleTitle: props.row.articleTitle ?? '',
      article: props.row.article ?? '',
    }
  }
  else {
    form.value = { version: '', changelog: '', androidUrl: '', iosUrl: '', isMandatory: 0, publishedAt: Date.now(), articleTitle: '', article: '' }
  }
}

watch(() => props.visible, (v) => { if (v) reset() })

// md-editor-v3 图片上传：File → base64 → 上传端点 → 回填 OSS URL（统一文件夹 app_version_article/）
async function onUploadImg(files: File[], callback: (urls: string[]) => void) {
  try {
    const urls = await Promise.all(files.map(file => uploadOne(file)))
    callback(urls.filter(Boolean) as string[])
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '图片上传失败')
    callback([])
  }
}

function uploadOne(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('请选择图片文件')); return }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const r = await requestJson<{ url: string }>('/api/admin/upload/article-image', {
          method: 'POST',
          body: { imageBase64: String(reader.result || '') },
        })
        resolve(r.url)
      }
      catch (e) { reject(e) }
    }
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

async function handleSubmit() {
  if (!form.value.version.trim()) { MessagePlugin.warning('请填写版本号'); return }
  if (!form.value.changelog.trim()) { MessagePlugin.warning('请填写更新摘要 changelog'); return }
  saving.value = true
  const payload = {
    version: form.value.version.trim(),
    changelog: form.value.changelog.trim(),
    androidUrl: form.value.androidUrl || null,
    iosUrl: form.value.iosUrl || null,
    isMandatory: form.value.isMandatory ? 1 : 0,
    publishedAt: form.value.publishedAt ?? Date.now(),
    article: form.value.article.trim() || null,
    articleTitle: form.value.articleTitle.trim() || null,
  }
  // 草稿走 appVersionDrafts；已发布走 appVersions
  const base = props.target === 'published' ? '/api/appVersions' : '/api/appVersionDrafts'
  try {
    if (isEdit.value)
      await requestJson(`${base}/${props.row!.id}`, { method: 'PUT', body: payload })
    else
      await requestJson(base, { method: 'POST', body: payload })
    MessagePlugin.success('保存成功')
    emit('saved')
    emit('update:visible', false)
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '保存失败')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <t-dialog
    :visible="visible"
    :header="header"
    width="860px"
    :confirm-btn="{ content: confirmText, loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleSubmit"
    @close="emit('update:visible', false)"
  >
    <t-form label-width="100px" class="pt-2">
      <t-form-item label="版本号" required-mark>
        <t-input v-model="form.version" placeholder="如 1.0.0 或 1.0.0.1" />
      </t-form-item>
      <t-form-item label="更新摘要" required-mark help="列表 / 更新弹窗展示的简短 changelog（markdown）">
        <t-textarea v-model="form.changelog" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="### 本次更新&#10;- xxx" />
      </t-form-item>
      <t-form-item label="Android 链接">
        <t-input v-model="form.androidUrl" placeholder="APK / 落地页 URL（可选）" />
      </t-form-item>
      <t-form-item label="iOS 链接">
        <t-input v-model="form.iosUrl" placeholder="App Store / 落地页 URL（可选）" />
      </t-form-item>
      <t-form-item label="发布时间">
        <t-date-picker
          v-model="form.publishedAt"
          enable-time-picker
          mode="date"
          value-type="time-stamp"
          clearable
          placeholder="请选择"
        />
      </t-form-item>
      <t-form-item label="强制更新">
        <t-switch v-model="form.isMandatory" :custom-value="[1, 0]" />
      </t-form-item>
      <t-form-item label="文章标题">
        <t-input v-model="form.articleTitle" :maxlength="100" placeholder="文章详情页标题（可选，空则用「v版本号 更新详情」）" />
      </t-form-item>
      <t-form-item label="文章正文">
        <MdEditor
          v-model="form.article"
          :on-upload-img="onUploadImg"
          style="height: 460px; width: 100%;"
          placeholder="支持 markdown + 图片上传；ha 端按 markdown 渲染"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>
