# 活动分类管理页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 how-admin 新增活动分类（activity_category）CRUD 管理页面，支持两级树形展示，图片上传至 OSS `activity_category/{id}.png`，写操作后刷新 referenceData 缓存。

**Architecture:** 后端三个 Nitro handler（GET/POST/PUT），前端一个页面（树形表格）和一个弹窗组件（新增/编辑），侧边栏新增菜单项。前端从扁平列表自行组树传给 TDesign tree table 的 `tree.childrenKey`。

**Tech Stack:** Vue 3, TDesign Vue Next (`t-table` tree mode), Nitro (`defineHandler`), Drizzle ORM, Ali-OSS (`uploadFile`)

---

## 文件地图

| 动作 | 路径 | 职责 |
|------|------|------|
| 创建 | `server/api/activityCategories/index.get.ts` | GET 扁平列表 |
| 创建 | `server/api/activityCategories/index.post.ts` | POST 新增 + 图标上传 + 缓存失效 |
| 创建 | `server/api/activityCategories/[id].put.ts` | PUT 编辑 + 图标上传 + 缓存失效 |
| 创建 | `src/pages/activity-categories/index.vue` | 页面：树形表格 |
| 创建 | `src/components/activity-categories/ActivityCategoryDialog.vue` | 新增/编辑弹窗 |
| 修改 | `src/App.vue` | 侧栏加"活动分类"菜单项 |

---

### Task 1: GET /api/activityCategories

**Files:**
- Create: `server/api/activityCategories/index.get.ts`

- [ ] **Step 1: 创建文件**

```typescript
// server/api/activityCategories/index.get.ts
import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { activityCategory } from '../../../drizzle/schema'

export default defineHandler(async () => {
  const list = await db
    .select({
      id: activityCategory.id,
      code: activityCategory.code,
      name: activityCategory.name,
      parentId: activityCategory.parentId,
      icon: activityCategory.icon,
      sortOrder: activityCategory.sortOrder,
      createdAt: activityCategory.createdAt,
    })
    .from(activityCategory)
    .orderBy(asc(activityCategory.sortOrder), asc(activityCategory.id))
  return { list }
})
```

- [ ] **Step 2: 手动验证**

启动开发服务器后访问 `http://localhost:3000/api/activityCategories`，应返回 `{ list: [...] }`，按 sortOrder/id 排序。

- [ ] **Step 3: Commit**

```bash
git add server/api/activityCategories/index.get.ts
git commit -m "feat: add GET /api/activityCategories endpoint"
```

---

### Task 2: POST /api/activityCategories

**Files:**
- Create: `server/api/activityCategories/index.post.ts`

- [ ] **Step 1: 创建文件**

```typescript
// server/api/activityCategories/index.post.ts
import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { uploadFile } from '~~/utils/ossClient'
import { activityCategory } from '../../../drizzle/schema'

interface Payload {
  code?: string
  name?: string
  parentId?: number | null
  sortOrder?: number
  iconBase64?: string
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)

  if (!body?.code?.trim())
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (!body?.name?.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

  // Validate parentId: target must exist and be a top-level category
  if (body.parentId != null) {
    const [parent] = await db
      .select({ id: activityCategory.id, parentId: activityCategory.parentId })
      .from(activityCategory)
      .where(eq(activityCategory.id, body.parentId))
      .limit(1)
    if (!parent)
      throw createError({ statusCode: 400, statusMessage: '父分类不存在' })
    if (parent.parentId !== null)
      throw createError({ statusCode: 400, statusMessage: '父分类必须是顶级分类' })
  }

  let iconBuf: Buffer | null = null
  if (body.iconBase64?.trim()) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 不是合法 data URL' })
    iconBuf = Buffer.from(m[1], 'base64')
    if (iconBuf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 解析后内容为空' })
    if (iconBuf.byteLength > 5 * 1024 * 1024)
      throw createError({ statusCode: 413, statusMessage: '图标超过 5MB 限制' })
  }

  let id: number
  try {
    const result = await db.insert(activityCategory).values({
      code: body.code.trim(),
      name: body.name.trim(),
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder ?? 0,
    })
    id = Number((result as unknown as [{ insertId: number }])[0].insertId)
  }
  catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY')
      throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }

  if (iconBuf) {
    try {
      const url = await uploadFile(`activity_category/${id}.png`, iconBuf)
      await db.update(activityCategory)
        .set({ icon: url })
        .where(eq(activityCategory.id, id))
    }
    catch (e: any) {
      throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
    }
  }

  const [row] = await db
    .select()
    .from(activityCategory)
    .where(eq(activityCategory.id, id))
    .limit(1)

  referenceData.invalidate()
  return row
})
```

- [ ] **Step 2: 手动验证**

```bash
curl -X POST http://localhost:3000/api/activityCategories \
  -H 'Content-Type: application/json' \
  -d '{"code":"test","name":"测试分类","sortOrder":0}'
```

应返回新建的行（含 id）。再次调用应返回 409。

- [ ] **Step 3: Commit**

```bash
git add server/api/activityCategories/index.post.ts
git commit -m "feat: add POST /api/activityCategories endpoint"
```

---

### Task 3: PUT /api/activityCategories/:id

**Files:**
- Create: `server/api/activityCategories/[id].put.ts`

- [ ] **Step 1: 创建文件**

```typescript
// server/api/activityCategories/[id].put.ts
import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { db } from '~~/db'
import { uploadFile } from '~~/utils/ossClient'
import { activityCategory } from '../../../drizzle/schema'

interface Payload {
  code?: string
  name?: string
  parentId?: number | null
  sortOrder?: number
  iconBase64?: string
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '分类 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body)
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  if (body.code !== undefined && !body.code.trim())
    throw createError({ statusCode: 400, statusMessage: 'code 不能为空' })
  if (body.name !== undefined && !body.name.trim())
    throw createError({ statusCode: 400, statusMessage: 'name 不能为空' })

  const [existing] = await db
    .select({ id: activityCategory.id })
    .from(activityCategory)
    .where(eq(activityCategory.id, id))
    .limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '分类不存在' })

  // Validate parentId: cannot self-reference; target must be top-level
  if (body.parentId != null) {
    if (body.parentId === id)
      throw createError({ statusCode: 400, statusMessage: '父分类不能指向自身' })
    const [parent] = await db
      .select({ id: activityCategory.id, parentId: activityCategory.parentId })
      .from(activityCategory)
      .where(eq(activityCategory.id, body.parentId))
      .limit(1)
    if (!parent)
      throw createError({ statusCode: 400, statusMessage: '父分类不存在' })
    if (parent.parentId !== null)
      throw createError({ statusCode: 400, statusMessage: '父分类必须是顶级分类' })
  }

  let iconBuf: Buffer | null = null
  if (body.iconBase64?.trim()) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(body.iconBase64)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 不是合法 data URL' })
    const buf = Buffer.from(m[1], 'base64')
    if (buf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: 'iconBase64 解析后内容为空' })
    if (buf.byteLength > 5 * 1024 * 1024)
      throw createError({ statusCode: 413, statusMessage: '图标超过 5MB 限制' })
    iconBuf = buf
  }

  const update: Record<string, unknown> = {}
  if (body.code !== undefined)
    update.code = body.code.trim()
  if (body.name !== undefined)
    update.name = body.name.trim()
  if ('parentId' in body)
    update.parentId = body.parentId ?? null
  if (body.sortOrder !== undefined)
    update.sortOrder = body.sortOrder

  if (iconBuf) {
    try {
      update.icon = await uploadFile(`activity_category/${id}.png`, iconBuf)
    }
    catch (e: any) {
      throw createError({ statusCode: 500, statusMessage: `图标上传失败：${e?.message ?? e}` })
    }
  }

  if (Object.keys(update).length > 0) {
    try {
      await db.update(activityCategory).set(update).where(eq(activityCategory.id, id))
    }
    catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY')
        throw createError({ statusCode: 409, statusMessage: 'code 已存在' })
      throw createError({ statusCode: 500, statusMessage: `更新失败：${e?.message ?? e}` })
    }
  }

  const [row] = await db
    .select()
    .from(activityCategory)
    .where(eq(activityCategory.id, id))
    .limit(1)

  referenceData.invalidate()
  return row
})
```

- [ ] **Step 2: 手动验证**

用 Task 2 新建的记录 ID（假设为 99）：

```bash
curl -X PUT http://localhost:3000/api/activityCategories/99 \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试分类-改名"}'
```

应返回更新后的行，name 已变更。

- [ ] **Step 3: Commit**

```bash
git add "server/api/activityCategories/[id].put.ts"
git commit -m "feat: add PUT /api/activityCategories/:id endpoint"
```

---

### Task 4: 弹窗组件 ActivityCategoryDialog.vue

**Files:**
- Create: `src/components/activity-categories/ActivityCategoryDialog.vue`

- [ ] **Step 1: 创建组件**

```vue
<!-- src/components/activity-categories/ActivityCategoryDialog.vue -->
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'

interface Row {
  id: number
  code: string
  name: string
  parentId: number | null
  icon: string | null
  sortOrder: number
  createdAt: number | null
}

const props = defineProps<{
  visible: boolean
  editingRow: Row | null
  parentOptions: { label: string, value: number }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

interface Form {
  code: string
  name: string
  parentId: number | null
  sortOrder: number
}

const form = ref<Form>({ code: '', name: '', parentId: null, sortOrder: 0 })
const saving = ref(false)
const iconPreview = ref('')
const iconBase64 = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const isEdit = computed(() => props.editingRow !== null)

function reset() {
  form.value = { code: '', name: '', parentId: null, sortOrder: 0 }
  iconPreview.value = ''
  iconBase64.value = ''
}

watch(() => props.visible, (v) => {
  if (!v) {
    reset()
    return
  }
  if (!props.editingRow) {
    reset()
    return
  }
  form.value = {
    code: props.editingRow.code,
    name: props.editingRow.name,
    parentId: props.editingRow.parentId,
    sortOrder: props.editingRow.sortOrder,
  }
  iconPreview.value = props.editingRow.icon ?? ''
  iconBase64.value = ''
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
      parentId: form.value.parentId,
      sortOrder: form.value.sortOrder,
    }
    if (iconBase64.value)
      body.iconBase64 = iconBase64.value

    if (isEdit.value) {
      await requestJson(`/api/activityCategories/${props.editingRow!.id}`, { method: 'PUT', body })
    }
    else {
      await requestJson('/api/activityCategories', { method: 'POST', body })
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
    :header="isEdit ? '编辑活动分类' : '新增活动分类'"
    width="480px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="save"
    @close="cancel"
  >
    <t-form label-width="80px" class="pt-2">
      <t-form-item label="Code">
        <t-input v-model="form.code" placeholder="如 dining" :maxlength="32" />
      </t-form-item>
      <t-form-item label="名称">
        <t-input v-model="form.name" placeholder="如 餐饮" :maxlength="50" />
      </t-form-item>
      <t-form-item label="父分类">
        <t-select
          v-model="form.parentId"
          :options="parentOptions"
          placeholder="留空表示顶级分类"
          clearable
          style="width: 240px"
        />
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
  </t-dialog>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activity-categories/ActivityCategoryDialog.vue
git commit -m "feat: add ActivityCategoryDialog component"
```

---

### Task 5: 页面 activity-categories/index.vue

**Files:**
- Create: `src/pages/activity-categories/index.vue`

- [ ] **Step 1: 创建页面**

```vue
<!-- src/pages/activity-categories/index.vue -->
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import ActivityCategoryDialog from '@/components/activity-categories/ActivityCategoryDialog.vue'

interface Row {
  id: number
  code: string
  name: string
  parentId: number | null
  icon: string | null
  sortOrder: number
  createdAt: number | null
  children?: Row[]
}

const list = ref<Row[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingRow = ref<Row | null>(null)

// Top-level rows only, for parent dropdown in dialog
const parentOptions = computed(() =>
  list.value
    .filter(r => r.parentId === null)
    .map(r => ({ label: r.name, value: r.id })),
)

// Build two-level tree from flat list
function buildTree(flat: Row[]): Row[] {
  const parents = flat.filter(r => r.parentId === null)
  const childMap = new Map<number, Row[]>()
  flat.filter(r => r.parentId !== null).forEach((r) => {
    const arr = childMap.get(r.parentId!) ?? []
    arr.push(r)
    childMap.set(r.parentId!, arr)
  })
  return parents.map(p => ({ ...p, children: childMap.get(p.id) ?? [] }))
}

const treeData = computed(() => buildTree(list.value))

const columns = [
  { colKey: 'icon', title: '图标', width: 72 },
  { colKey: 'name', title: '名称', minWidth: 140 },
  { colKey: 'code', title: 'Code', width: 160 },
  { colKey: 'sortOrder', title: '排序', width: 80 },
  { colKey: 'createdAt', title: '创建时间', width: 160 },
  { colKey: 'actions', title: '操作', width: 80, fixed: 'right' as const },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: Row[] }>('/api/activityCategories')
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
  editingRow.value = null
  dialogVisible.value = true
}

function openEdit(row: Row) {
  // Pass the flat row (not the tree node with children)
  editingRow.value = { ...row, children: undefined }
  dialogVisible.value = true
}

function handleSaved() {
  dialogVisible.value = false
  fetchList()
}

function formatTime(createdAt: number | null) {
  if (!createdAt)
    return '-'
  return new Date(createdAt).toISOString().slice(0, 16).replace('T', ' ')
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="活动分类管理">
      <template #actions>
        <t-button theme="primary" @click="openAdd">
          新增分类
        </t-button>
      </template>

      <t-table
        row-key="id"
        :data="treeData"
        :columns="columns"
        :loading="loading"
        :tree="{ childrenKey: 'children', defaultExpandAll: true }"
        stripe
        bordered
      >
        <template #icon="{ row }">
          <img v-if="row.icon" :src="row.icon" class="w-8 h-8 object-contain rounded">
          <span v-else class="text-gray-400">-</span>
        </template>
        <template #createdAt="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="outline" @click="openEdit(row)">
            编辑
          </t-button>
        </template>
      </t-table>
    </t-card>

    <ActivityCategoryDialog
      v-model:visible="dialogVisible"
      :editing-row="editingRow"
      :parent-options="parentOptions"
      @saved="handleSaved"
    />
  </div>
</template>
```

- [ ] **Step 2: 手动验证**

打开浏览器访问 `/activity-categories`，确认：
- 表格正确展示两级树（父节点可展开/折叠）
- "新增分类"弹窗可打开，父分类下拉只显示顶级分类
- 新增顶级分类后刷新，父节点出现在列表
- 新增子分类后，子分类出现在对应父节点下方
- 编辑分类后数据更新

- [ ] **Step 3: Commit**

```bash
git add src/pages/activity-categories/index.vue
git commit -m "feat: add activity categories page with tree table"
```

---

### Task 6: 侧栏导航

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 在"使用平台"菜单项之后插入新菜单项**

在 `src/App.vue` 找到：

```html
          <t-menu-item value="/usage-platforms" to="/usage-platforms">
            <template #icon>
              <div i-carbon:application mr-3 />
            </template>
            使用平台
          </t-menu-item>
```

在其后插入：

```html
          <t-menu-item value="/activity-categories" to="/activity-categories">
            <template #icon>
              <div i-carbon:category mr-3 />
            </template>
            活动分类
          </t-menu-item>
```

- [ ] **Step 2: 手动验证**

刷新浏览器，侧栏"使用平台"下方出现"活动分类"，点击可跳转到 `/activity-categories` 页面，当前高亮正确。

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat: add activity categories navigation item"
```

---

## 自检

- **GET**: 返回扁平列表 ✓  
- **POST**: code/name 校验 + parentId 合法性 + 图标上传 + cache invalidate ✓  
- **PUT**: 同上 + 自引用检查 + 404 检查 ✓  
- **前端组树**: parentId===null 为父节点，其余挂到 children ✓  
- **弹窗父分类下拉**: 只列出 parentId===null 的行（与后端校验一致）✓  
- **缓存失效**: POST/PUT 均调用 `referenceData.invalidate()` ✓  
- **OSS 路径**: `activity_category/{id}.png` ✓  
- **导航高亮**: 使用 `route.path` 作为 active value ✓  
