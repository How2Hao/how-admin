# 使用平台管理页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `benefit_usage_platform` 的后台管理页面，支持新增、编辑平台记录及 OSS 图标上传。

**Architecture:** 复用已有数据库表，后端 3 个 Nitro handler（GET list / POST create / PUT update），前端列表页 + 弹窗组件，图标以 base64 随表单一起提交，后端上传至 OSS `usage_platform/{id}.png`。同步重构 `ossClient.ts`，提取公共 `uploadFile` 消除重复逻辑。

**Tech Stack:** Nuxt 3 / Nitro server handlers, Drizzle ORM (mysql2), Vue 3 Composition API, TDesign Vue Next (`tdesign-vue-next`), Aliyun OSS (`ali-oss`)

---

## File Map

| 操作 | 路径 |
|------|------|
| 修改 | `server/utils/ossClient.ts` |
| 新建 | `server/api/usagePlatforms/index.get.ts` |
| 新建 | `server/api/usagePlatforms/index.post.ts` |
| 新建 | `server/api/usagePlatforms/[id].put.ts` |
| 新建 | `src/components/usage-platforms/UsagePlatformDialog.vue` |
| 新建 | `src/pages/usage-platforms/index.vue` |
| 修改 | `src/app.vue` |

---

### Task 1: 重构 ossClient.ts — 提取公共 uploadFile

**Files:**
- Modify: `server/utils/ossClient.ts`

- [ ] **Step 1: 读取当前文件，确认内容**

  Read `server/utils/ossClient.ts` and verify it contains `uploadCardCover` and `uploadPasteImage`.

- [ ] **Step 2: 替换文件内容**

  将整个文件替换为以下内容（新增 `uploadFile`，现有函数内部改为调用它）：

  ```ts
  import type { Buffer } from 'node:buffer'
  import process from 'node:process'
  import OSS from 'ali-oss'

  let cached: OSS | null = null

  function envOrThrow(name: string): string {
    const v = process.env[name]
    if (!v)
      throw new Error(`缺少环境变量 ${name}`)
    return v
  }

  export function getOssClient(): OSS {
    if (cached)
      return cached
    cached = new OSS({
      region: envOrThrow('OSS_REGION'),
      bucket: envOrThrow('OSS_BUCKET'),
      accessKeyId: envOrThrow('OSS_ACCESS_KEY_ID'),
      accessKeySecret: envOrThrow('OSS_ACCESS_KEY_SECRET'),
      secure: true,
    })
    return cached
  }

  export async function uploadFile(key: string, buf: Buffer, contentType = 'image/png'): Promise<string> {
    if (!buf || buf.byteLength === 0)
      throw new Error('uploadFile: 内容为空')
    await getOssClient().put(key, buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=2592000',
      },
    })
    const base = envOrThrow('OSS_PUBLIC_BASE_URL').replace(/\/+$/, '')
    return `${base}/${key}`
  }

  export async function uploadCardCover(bankId: string, id: number, buf: Buffer): Promise<string> {
    if (!bankId || !Number.isInteger(id))
      throw new Error('uploadCardCover: bankId 或 id 不合法')
    return uploadFile(`card_template_cover/${bankId}/${id}.png`, buf)
  }

  export async function uploadPasteImage(buf: Buffer, ext = 'png'): Promise<string> {
    if (!buf || buf.byteLength === 0)
      throw new Error('uploadPasteImage: 内容为空')
    const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'png'
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
    const random = Math.random().toString(36).slice(2, 10)
    const key = `paste_uploads/${yyyymm}/${Date.now()}-${random}.${safeExt}`
    return uploadFile(key, buf, `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`)
  }
  ```

- [ ] **Step 3: 确认现有调用方不需要改动**

  Run:
  ```bash
  grep -rn "uploadCardCover\|uploadPasteImage\|getOssClient" server --include="*.ts"
  ```
  预期：仍然只有 `server/api/cardTemplates/[id]/upload-cover.post.ts` 和 `server/api/bankCardActivities/web/uploadParseImage.post.ts` 引用，签名未变，无需修改调用方。

- [ ] **Step 4: Commit**

  ```bash
  git add server/utils/ossClient.ts
  git commit -m "refactor(oss): extract uploadFile to eliminate duplicated upload logic"
  ```

---

### Task 2: GET /api/usagePlatforms — 列表接口

**Files:**
- Create: `server/api/usagePlatforms/index.get.ts`

- [ ] **Step 1: 创建文件**

  ```ts
  import { asc } from 'drizzle-orm'
  import { defineHandler } from 'nitro'
  import { db } from '~~/db'
  import { benefitUsagePlatform } from '../../../drizzle/schema'

  export default defineHandler(async () => {
    const list = await db
      .select({
        id: benefitUsagePlatform.id,
        code: benefitUsagePlatform.code,
        name: benefitUsagePlatform.name,
        icon: benefitUsagePlatform.icon,
        sortOrder: benefitUsagePlatform.sortOrder,
        createdAt: benefitUsagePlatform.createdAt,
      })
      .from(benefitUsagePlatform)
      .orderBy(asc(benefitUsagePlatform.sortOrder), asc(benefitUsagePlatform.id))
    return { list }
  })
  ```

- [ ] **Step 2: 确认文件已创建**

  Run:
  ```bash
  cat server/api/usagePlatforms/index.get.ts
  ```
  预期：输出完整文件内容，无报错。

- [ ] **Step 3: Commit**

  ```bash
  git add server/api/usagePlatforms/index.get.ts
  git commit -m "feat(usage-platforms): GET /api/usagePlatforms list handler"
  ```

---

### Task 3: POST /api/usagePlatforms — 新增接口

**Files:**
- Create: `server/api/usagePlatforms/index.post.ts`

- [ ] **Step 1: 创建文件**

  ```ts
  import { Buffer } from 'node:buffer'
  import { eq } from 'drizzle-orm'
  import { createError, readBody } from 'h3'
  import { defineHandler } from 'nitro'
  import { db } from '~~/db'
  import { uploadFile } from '~~/utils/ossClient'
  import { benefitUsagePlatform } from '../../../drizzle/schema'

  interface Payload {
    code?: string
    name?: string
    sortOrder?: number
    iconBase64?: string
  }

  export default defineHandler(async (event) => {
    const body = await readBody<Payload>(event)

    if (!body?.code?.trim())
      throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
    if (!body?.name?.trim())
      throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

    let id: number
    try {
      const result = await db.insert(benefitUsagePlatform).values({
        code: body.code.trim(),
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
      })
      id = Number((result as unknown as [{ insertId: number }])[0].insertId)
    }
    catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY')
        throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
      throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
    }

    if (body.iconBase64?.trim()) {
      const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
      if (m) {
        const buf = Buffer.from(m[1], 'base64')
        if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
          try {
            const url = await uploadFile(`usage_platform/${id}.png`, buf)
            await db.update(benefitUsagePlatform)
              .set({ icon: url })
              .where(eq(benefitUsagePlatform.id, id))
          }
          catch (e: any) {
            throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
          }
        }
      }
    }

    const [row] = await db
      .select()
      .from(benefitUsagePlatform)
      .where(eq(benefitUsagePlatform.id, id))
      .limit(1)

    return row
  })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/api/usagePlatforms/index.post.ts
  git commit -m "feat(usage-platforms): POST /api/usagePlatforms create handler"
  ```

---

### Task 4: PUT /api/usagePlatforms/[id] — 编辑接口

**Files:**
- Create: `server/api/usagePlatforms/[id].put.ts`

- [ ] **Step 1: 创建文件**

  ```ts
  import { Buffer } from 'node:buffer'
  import { eq } from 'drizzle-orm'
  import { createError, readBody } from 'h3'
  import { defineHandler } from 'nitro'
  import { db } from '~~/db'
  import { uploadFile } from '~~/utils/ossClient'
  import { benefitUsagePlatform } from '../../../drizzle/schema'

  interface Payload {
    code?: string
    name?: string
    sortOrder?: number
    iconBase64?: string
  }

  export default defineHandler(async (event) => {
    const id = Number(event.context.params?.id)
    if (!Number.isInteger(id) || id <= 0)
      throw createError({ statusCode: 400, statusMessage: '平台 ID 不合法' })

    const body = await readBody<Payload>(event)
    if (!body)
      throw createError({ statusCode: 400, statusMessage: '请求体为空' })

    if (body.code !== undefined && !body.code.trim())
      throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
    if (body.name !== undefined && !body.name.trim())
      throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

    const [existing] = await db
      .select({ id: benefitUsagePlatform.id })
      .from(benefitUsagePlatform)
      .where(eq(benefitUsagePlatform.id, id))
      .limit(1)
    if (!existing)
      throw createError({ statusCode: 404, statusMessage: '平台不存在' })

    const update: Record<string, unknown> = {}
    if (body.code !== undefined)
      update.code = body.code.trim()
    if (body.name !== undefined)
      update.name = body.name.trim()
    if (body.sortOrder !== undefined)
      update.sortOrder = body.sortOrder

    if (body.iconBase64?.trim()) {
      const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
      if (m) {
        const buf = Buffer.from(m[1], 'base64')
        if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
          try {
            update.icon = await uploadFile(`usage_platform/${id}.png`, buf)
          }
          catch (e: any) {
            throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
          }
        }
      }
    }

    if (Object.keys(update).length > 0) {
      try {
        await db.update(benefitUsagePlatform).set(update).where(eq(benefitUsagePlatform.id, id))
      }
      catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY')
          throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
        throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
      }
    }

    const [row] = await db
      .select()
      .from(benefitUsagePlatform)
      .where(eq(benefitUsagePlatform.id, id))
      .limit(1)

    return row
  })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add "server/api/usagePlatforms/[id].put.ts"
  git commit -m "feat(usage-platforms): PUT /api/usagePlatforms/:id update handler"
  ```

---

### Task 5: UsagePlatformDialog 弹窗组件

**Files:**
- Create: `src/components/usage-platforms/UsagePlatformDialog.vue`

- [ ] **Step 1: 创建文件**

  ```vue
  <script setup lang="ts">
  import { MessagePlugin } from 'tdesign-vue-next'
  import { requestJson } from '@/composables/useJsonRequest'

  interface Row {
    id: number
    code: string
    name: string
    icon: string | null
    sortOrder: number | null
    createdAt: string | null
  }

  const props = defineProps<{
    visible: boolean
    platformId: number | null
  }>()

  const emit = defineEmits<{
    (e: 'update:visible', v: boolean): void
    (e: 'saved'): void
  }>()

  interface Form {
    code: string
    name: string
    sortOrder: number
  }

  const form = ref<Form>({ code: '', name: '', sortOrder: 0 })
  const saving = ref(false)
  const loading = ref(false)
  const iconPreview = ref<string>('')
  const iconBase64 = ref<string>('')
  const fileInputRef = ref<HTMLInputElement | null>(null)

  const isEdit = computed(() => props.platformId !== null)

  function reset() {
    form.value = { code: '', name: '', sortOrder: 0 }
    iconPreview.value = ''
    iconBase64.value = ''
  }

  watch(() => props.visible, async (v) => {
    if (!v) {
      reset()
      return
    }
    if (!props.platformId) {
      reset()
      return
    }
    loading.value = true
    try {
      const res = await requestJson<{ list: Row[] }>('/api/usagePlatforms')
      const row = res.list.find(r => r.id === props.platformId)
      if (row) {
        form.value = {
          code: row.code,
          name: row.name,
          sortOrder: row.sortOrder ?? 0,
        }
        iconPreview.value = row.icon ?? ''
      }
    }
    catch (e: any) {
      MessagePlugin.error(e?.message ?? '加载失败')
    }
    finally {
      loading.value = false
    }
  })

  function triggerFileInput() {
    fileInputRef.value?.click()
  }

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return
    if (file.size > 5 * 1024 * 1024) {
      MessagePlugin.error('图片不能超过 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      iconBase64.value = result
      iconPreview.value = result
    }
    reader.readAsDataURL(file)
    if (fileInputRef.value)
      fileInputRef.value.value = ''
  }

  async function save() {
    if (!form.value.code.trim()) {
      MessagePlugin.error('code 不能为空')
      return
    }
    if (!form.value.name.trim()) {
      MessagePlugin.error('name 不能为空')
      return
    }
    saving.value = true
    try {
      const body: Record<string, unknown> = {
        code: form.value.code.trim(),
        name: form.value.name.trim(),
        sortOrder: form.value.sortOrder,
      }
      if (iconBase64.value)
        body.iconBase64 = iconBase64.value

      if (isEdit.value) {
        await requestJson(`/api/usagePlatforms/${props.platformId}`, { method: 'PUT', body })
      }
      else {
        await requestJson('/api/usagePlatforms', { method: 'POST', body })
      }
      MessagePlugin.success('保存成功')
      emit('saved')
    }
    catch (e: any) {
      MessagePlugin.error(e?.message ?? '保存失败')
    }
    finally {
      saving.value = false
    }
  }

  function cancel() {
    emit('update:visible', false)
  }
  </script>

  <template>
    <t-dialog
      :visible="visible"
      :header="isEdit ? '编辑使用平台' : '新增使用平台'"
      width="480px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @update:visible="emit('update:visible', $event)"
      @confirm="save"
      @close="cancel"
    >
      <t-loading :loading="loading">
        <t-form label-width="80px" class="pt-2">
          <t-form-item label="Code">
            <t-input v-model="form.code" placeholder="如 alipay" :maxlength="50" />
          </t-form-item>
          <t-form-item label="名称">
            <t-input v-model="form.name" placeholder="如 支付宝" :maxlength="50" />
          </t-form-item>
          <t-form-item label="排序">
            <t-input-number v-model="form.sortOrder" :min="0" style="width: 120px" />
          </t-form-item>
          <t-form-item label="图标">
            <div
              class="relative w-16 h-16 border-2 border-dashed rounded cursor-pointer flex items-center justify-center overflow-hidden"
              :class="iconPreview ? 'border-gray-200' : 'border-gray-300'"
              @click="triggerFileInput"
            >
              <img v-if="iconPreview" :src="iconPreview" class="w-full h-full object-contain">
              <span v-else class="text-xs text-gray-400 text-center leading-tight px-1">点击上传</span>
              <div
                v-if="iconPreview"
                class="absolute inset-0 bg-black bg-opacity-40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <span class="text-white text-xs">更换</span>
              </div>
              <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileChange">
            </div>
            <span class="ml-3 text-xs text-gray-400 self-end">PNG / JPG，≤ 5MB</span>
          </t-form-item>
        </t-form>
      </t-loading>
    </t-dialog>
  </template>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/usage-platforms/UsagePlatformDialog.vue
  git commit -m "feat(usage-platforms): UsagePlatformDialog add/edit component"
  ```

---

### Task 6: 使用平台列表页

**Files:**
- Create: `src/pages/usage-platforms/index.vue`

- [ ] **Step 1: 创建文件**

  ```vue
  <script setup lang="ts">
  import { MessagePlugin } from 'tdesign-vue-next'
  import { requestJson } from '@/composables/useJsonRequest'
  import UsagePlatformDialog from '@/components/usage-platforms/UsagePlatformDialog.vue'

  interface Row {
    id: number
    code: string
    name: string
    icon: string | null
    sortOrder: number | null
    createdAt: string | null
  }

  const list = ref<Row[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const editingId = ref<number | null>(null)

  const columns = [
    { colKey: 'icon', title: '图标', width: 72 },
    { colKey: 'name', title: '名称', width: 150 },
    { colKey: 'code', title: 'Code', width: 160 },
    { colKey: 'sortOrder', title: '排序', width: 80 },
    { colKey: 'createdAt', title: '创建时间', minWidth: 160 },
    { colKey: 'actions', title: '操作', width: 80, fixed: 'right' as const },
  ]

  async function fetchList() {
    loading.value = true
    try {
      const res = await requestJson<{ list: Row[] }>('/api/usagePlatforms')
      list.value = res.list
    }
    catch (e: any) {
      MessagePlugin.error(e?.message ?? '加载失败')
    }
    finally {
      loading.value = false
    }
  }

  function openAdd() {
    editingId.value = null
    dialogVisible.value = true
  }

  function openEdit(row: Row) {
    editingId.value = row.id
    dialogVisible.value = true
  }

  function handleSaved() {
    dialogVisible.value = false
    fetchList()
  }

  onMounted(fetchList)
  </script>

  <template>
    <div class="p-6">
      <t-card title="使用平台管理">
        <template #actions>
          <t-button theme="primary" @click="openAdd">
            新增平台
          </t-button>
        </template>

        <t-table
          row-key="id"
          :data="list"
          :columns="columns"
          :loading="loading"
          stripe
          bordered
        >
          <template #icon="{ row }">
            <img v-if="row.icon" :src="row.icon" class="w-8 h-8 object-contain rounded">
            <span v-else class="text-gray-400">-</span>
          </template>
          <template #actions="{ row }">
            <t-button size="small" variant="outline" @click="openEdit(row)">
              编辑
            </t-button>
          </template>
        </t-table>
      </t-card>

      <UsagePlatformDialog
        v-model:visible="dialogVisible"
        :platform-id="editingId"
        @saved="handleSaved"
      />
    </div>
  </template>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/pages/usage-platforms/index.vue
  git commit -m "feat(usage-platforms): list page with add/edit"
  ```

---

### Task 7: 导航菜单

**Files:**
- Modify: `src/app.vue`

- [ ] **Step 1: 在"卡片模板"菜单项之后插入新菜单项**

  找到 `src/app.vue` 中的：
  ```html
          <t-menu-item value="/card-templates" to="/card-templates">
            <template #icon>
              <div i-carbon:credit-card mr-3 />
            </template>
            卡片模板
          </t-menu-item>
  ```

  在其后插入：
  ```html
          <t-menu-item value="/usage-platforms" to="/usage-platforms">
            <template #icon>
              <div i-carbon:application mr-3 />
            </template>
            使用平台
          </t-menu-item>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app.vue
  git commit -m "feat(usage-platforms): add nav menu item"
  ```

---

### Task 8: 端到端验证

- [ ] **Step 1: 启动开发服务器**

  ```bash
  pnpm dev
  ```

- [ ] **Step 2: 验证新增流程**

  1. 打开 `http://localhost:3000/usage-platforms`
  2. 点"新增平台"，填写 code=`test`，name=`测试平台`，排序=0，上传一张图片
  3. 点保存，确认列表刷新并显示新记录（含图标）

- [ ] **Step 3: 验证编辑流程**

  1. 点已有记录的"编辑"按钮
  2. 确认弹窗加载了现有数据和图标预览
  3. 修改名称，更换图片，保存
  4. 确认列表刷新，修改生效

- [ ] **Step 4: 验证 code 重复校验**

  新增一条与已有 code 相同的记录，确认提示"code 已存在"

- [ ] **Step 5: 确认 OSS 图标路径**

  新增记录后，查看列表中图标 URL，应为 `https://{OSS_PUBLIC_BASE_URL}/usage_platform/{id}.png`
