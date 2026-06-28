# job_template 后台建模 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 how-admin 新增独立的 `job_template`（任务模板）表及其后台增删改查，用于沉淀可复用的周期性前置/通用任务。

**Architecture:** 仅改动 how-admin。新增 drizzle 表 + 手写 SQL 迁移；纯映射/校验逻辑抽到 `server/utils/jobTemplate.ts` 用 vitest 单测（对齐现有测试风格）；Nitro 文件路由 API 镜像 `taskTemplates` 既有模式；前端新增列表页 + 编辑弹层 + 菜单入口。不碰 how-api / ha，不删活动模板任何字段。

**Tech Stack:** Drizzle ORM (mysql-core) · Nitro (defineHandler/h3) · zod · Vue 3 + TDesign · vitest

> **环境提示（来自项目约定）:** vitest / vue-tsc 需 Node22；所有 `git commit` 用 `--no-verify`（pre-commit 钩子在 Node20 会崩）。`components.d.ts` 若被自动改写可丢弃。

设计依据：`docs/superpowers/specs/2026-06-01-job-template-admin-design.md`

---

## File Structure

**新建：**
- `drizzle/manual/0011_job_template.sql` — 建表迁移
- `server/utils/jobTemplate.ts` — 纯函数：zod schema、tiers 规范化、mutation 映射、id 解析
- `test/job-template.test.ts` — 上述纯函数单测
- `server/api/jobTemplates/index.get.ts` — 列表
- `server/api/jobTemplates/index.post.ts` — 新建
- `server/api/jobTemplates/[id].get.ts` — 详情
- `server/api/jobTemplates/[id].put.ts` — 编辑
- `server/api/jobTemplates/[id].delete.ts` — 删除
- `server/api/jobTemplates/[id]/visibility.put.ts` — 切换可见性
- `src/types/jobTemplates.ts` — 前端类型
- `src/components/job-templates/JobTemplateDialog.vue` — 新建/编辑弹层
- `src/pages/job-templates/index.vue` — 列表页

**修改：**
- `drizzle/schema.ts` — 追加 `jobTemplate` 表定义
- `src/App.vue` — 菜单加 `/job-templates` 入口

---

## Task 1: drizzle schema + 迁移 SQL

**Files:**
- Modify: `drizzle/schema.ts`（文件末尾追加）
- Create: `drizzle/manual/0011_job_template.sql`

- [ ] **Step 1: 在 `drizzle/schema.ts` 末尾追加 `jobTemplate` 表定义**

```ts
export const jobTemplate = mysqlTable('job_template', {
  id: int().autoincrement().notNull(),
  title: varchar({ length: 200 }).notNull(),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  /** 档位数组（主存储），至少 1 个元素。length > 1 = 多档。logic 控制金额/笔数的且或关系 */
  tiers: json('tiers').$type<{
    minAmount: number | null
    minCount: number | null
    logic: 'AND' | 'OR'
    description: string | null
  }[]>().notNull(),
  // 三个维度逻辑外键，均可空、可同时填多个
  taskTemplateId: int('task_template_id'),
  bankId: int('bank_id'),
  bankCardTemplateId: int('bank_card_template_id'),
  adminUserId: int('admin_user_id').default(1).notNull(),
  isVisible: tinyint('is_visible').default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_job_template_admin_user').on(table.adminUserId),
  index('idx_job_template_task_template').on(table.taskTemplateId),
  index('idx_job_template_bank').on(table.bankId),
  index('idx_job_template_card').on(table.bankCardTemplateId),
  primaryKey({ columns: [table.id], name: 'job_template_id' }),
])
```

- [ ] **Step 2: 创建迁移 `drizzle/manual/0011_job_template.sql`**

```sql
-- job_template：独立的"真正的任务模板"（周期性前置/通用任务，无提醒时刻）
-- 三个维度逻辑外键(task_template_id/bank_id/bank_card_template_id)均可空、可多填；不加物理外键约束，对齐现有表风格
CREATE TABLE `job_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `repeat_type` enum('ONE_TIME','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONE_TIME',
  `start_date` bigint NULL COMMENT '模板整体有效期起(epoch ms)',
  `end_date` bigint NULL COMMENT '模板整体有效期止(epoch ms)',
  `tiers` json NOT NULL COMMENT '档位数组,>=1;每档{minAmount,minCount,logic,description}',
  `task_template_id` int NULL COMMENT '维度①关联活动(task_template.id)',
  `bank_id` int NULL COMMENT '维度②关联银行(bank.id)',
  `bank_card_template_id` int NULL COMMENT '维度③关联模板银行卡(bank_card_template.id)',
  `admin_user_id` int NOT NULL DEFAULT 1 COMMENT '创建/维护者 admin_user.id',
  `is_visible` tinyint NOT NULL DEFAULT 0,
  `created_at` bigint NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_template_admin_user` (`admin_user_id`),
  KEY `idx_job_template_task_template` (`task_template_id`),
  KEY `idx_job_template_bank` (`bank_id`),
  KEY `idx_job_template_card` (`bank_card_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 3: 类型检查 schema 改动无误**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "schema.ts" || echo "schema OK"`
Expected: 输出 `schema OK`（schema.ts 无新增类型错误）

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/manual/0011_job_template.sql
git commit --no-verify -m "feat(job_template): 新增任务模板表 schema 与迁移"
```

---

## Task 2: 纯函数（zod 校验 + mutation 映射）— TDD

**Files:**
- Create: `server/utils/jobTemplate.ts`
- Test: `test/job-template.test.ts`

- [ ] **Step 1: 写失败测试 `test/job-template.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { getJobTemplateSchema, parseJobTemplateId, toJobTemplateMutation } from '../server/utils/jobTemplate'

describe('getJobTemplateSchema', () => {
  const base = {
    title: '本月刷满5笔',
    repeatType: 'MONTHLY',
    tiers: [{ minAmount: null, minCount: 5, logic: 'OR', description: '达标即可' }],
  }

  it('accepts a minimal valid payload and defaults optional fields', () => {
    const r = getJobTemplateSchema().safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.startDate).toBeNull()
      expect(r.data.endDate).toBeNull()
      expect(r.data.taskTemplateId).toBeNull()
      expect(r.data.tiers[0].logic).toBe('OR')
    }
  })

  it('defaults tier.logic to AND when omitted', () => {
    const r = getJobTemplateSchema().safeParse({ ...base, tiers: [{ minAmount: 100, minCount: null, description: null }] })
    expect(r.success).toBe(true)
    if (r.success)
      expect(r.data.tiers[0].logic).toBe('AND')
  })

  it('rejects empty title', () => {
    expect(getJobTemplateSchema().safeParse({ ...base, title: '' }).success).toBe(false)
  })

  it('rejects empty tiers array', () => {
    expect(getJobTemplateSchema().safeParse({ ...base, tiers: [] }).success).toBe(false)
  })

  it('rejects unknown repeatType', () => {
    expect(getJobTemplateSchema().safeParse({ ...base, repeatType: 'HOURLY' }).success).toBe(false)
  })
})

describe('toJobTemplateMutation', () => {
  const parsed = getJobTemplateSchema().parse({
    title: '本月刷满5笔',
    repeatType: 'MONTHLY',
    startDate: 1000,
    endDate: 2000,
    tiers: [{ minAmount: 100, minCount: 5, logic: 'AND', description: 'x' }],
    bankId: 7,
  })

  it('maps validated input to db column values', () => {
    const v = toJobTemplateMutation(parsed)
    expect(v.title).toBe('本月刷满5笔')
    expect(v.repeatType).toBe('MONTHLY')
    expect(v.startDate).toBe(1000)
    expect(v.bankId).toBe(7)
    expect(v.taskTemplateId).toBeNull()
    expect(v.bankCardTemplateId).toBeNull()
    expect(v.isVisible).toBe(0)
    expect(v.tiers).toHaveLength(1)
  })

  it('coerces isVisible truthy to 1', () => {
    const v = toJobTemplateMutation(getJobTemplateSchema().parse({ ...parsed, isVisible: true }))
    expect(v.isVisible).toBe(1)
  })
})

describe('parseJobTemplateId', () => {
  it('parses a positive integer string', () => {
    expect(parseJobTemplateId('42')).toBe(42)
  })

  it('throws on non-positive / non-integer', () => {
    expect(() => parseJobTemplateId('0')).toThrow()
    expect(() => parseJobTemplateId('abc')).toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run test/job-template.test.ts`
Expected: FAIL，报 `Cannot find module '../server/utils/jobTemplate'`（Node22）

- [ ] **Step 3: 实现 `server/utils/jobTemplate.ts`**

```ts
import { createError } from 'h3'
import { z } from 'zod'

export const JOB_TEMPLATE_REPEAT_TYPES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const

const nullableNumber = z.number().nullish().transform(v => v ?? null)

const tierSchema = z.object({
  minAmount: nullableNumber,
  minCount: nullableNumber,
  logic: z.enum(['AND', 'OR']).default('AND'),
  description: z.string().nullish().transform(v => v ?? null),
})

export function getJobTemplateSchema() {
  return z.object({
    title: z.string().trim().min(1, '标题不能为空').max(200),
    repeatType: z.enum(JOB_TEMPLATE_REPEAT_TYPES),
    startDate: nullableNumber,
    endDate: nullableNumber,
    tiers: z.array(tierSchema).min(1, '至少需要一个档位'),
    taskTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    bankId: z.number().int().positive().nullish().transform(v => v ?? null),
    bankCardTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    isVisible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
}

export type JobTemplateInput = z.infer<ReturnType<typeof getJobTemplateSchema>>

/** 把已校验的表单映射为 job_template 可写列（不含 id/adminUserId/createdAt/updatedAt，由 handler 补） */
export function toJobTemplateMutation(input: JobTemplateInput) {
  return {
    title: input.title,
    repeatType: input.repeatType,
    startDate: input.startDate,
    endDate: input.endDate,
    tiers: input.tiers,
    taskTemplateId: input.taskTemplateId,
    bankId: input.bankId,
    bankCardTemplateId: input.bankCardTemplateId,
    isVisible: input.isVisible ? 1 : 0,
  }
}

export function parseJobTemplateId(rawId: string | undefined) {
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '无效的任务模板 ID' })
  }
  return id
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run test/job-template.test.ts`
Expected: PASS（全部用例通过）

- [ ] **Step 5: Commit**

```bash
git add server/utils/jobTemplate.ts test/job-template.test.ts
git commit --no-verify -m "feat(job_template): 表单校验与 mutation 映射纯函数 + 单测"
```

---

## Task 3: 列表与详情 GET API

**Files:**
- Create: `server/api/jobTemplates/index.get.ts`
- Create: `server/api/jobTemplates/[id].get.ts`

- [ ] **Step 1: 实现 `server/api/jobTemplates/index.get.ts`**

```ts
import { and, desc, eq, like, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '10') || 10, 1), 50)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const numParam = (k: string) => {
    const v = url.searchParams.get(k)
    return v ? (Number(v) || null) : null
  }
  const bankIdFilter = numParam('bankId')
  const taskTemplateIdFilter = numParam('taskTemplateId')
  const bankCardTemplateIdFilter = numParam('bankCardTemplateId')

  const whereClause = and(
    keyword ? like(jobTemplate.title, `%${keyword}%`) : undefined,
    bankIdFilter ? eq(jobTemplate.bankId, bankIdFilter) : undefined,
    taskTemplateIdFilter ? eq(jobTemplate.taskTemplateId, taskTemplateIdFilter) : undefined,
    bankCardTemplateIdFilter ? eq(jobTemplate.bankCardTemplateId, bankCardTemplateIdFilter) : undefined,
  )

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(jobTemplate)
    .where(whereClause)

  const rows = await db
    .select({
      id: jobTemplate.id,
      title: jobTemplate.title,
      repeatType: jobTemplate.repeatType,
      startDate: jobTemplate.startDate,
      endDate: jobTemplate.endDate,
      tiers: jobTemplate.tiers,
      taskTemplateId: jobTemplate.taskTemplateId,
      bankId: jobTemplate.bankId,
      bankName: bank.name,
      bankCardTemplateId: jobTemplate.bankCardTemplateId,
      isVisible: jobTemplate.isVisible,
      updatedAt: jobTemplate.updatedAt,
    })
    .from(jobTemplate)
    .leftJoin(bank, eq(jobTemplate.bankId, bank.id))
    .where(whereClause)
    .orderBy(desc(jobTemplate.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows.map(row => ({
      ...row,
      bankName: row.bankName ?? null,
      tiers: Array.isArray(row.tiers) ? row.tiers : [],
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt.slice(0, 16) : row.updatedAt,
    })),
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
  }
})
```

- [ ] **Step 2: 实现 `server/api/jobTemplates/[id].get.ts`**

```ts
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseJobTemplateId } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseJobTemplateId(event.context.params?.id)
  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })
  }
  return row
})
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "jobTemplates" || echo "api OK"`
Expected: 输出 `api OK`

- [ ] **Step 4: Commit**

```bash
git add server/api/jobTemplates/index.get.ts "server/api/jobTemplates/[id].get.ts"
git commit --no-verify -m "feat(job_template): 列表与详情 GET 接口"
```

---

## Task 4: 写接口（新建/编辑/删除/可见性）

**Files:**
- Create: `server/api/jobTemplates/index.post.ts`
- Create: `server/api/jobTemplates/[id].put.ts`
- Create: `server/api/jobTemplates/[id].delete.ts`
- Create: `server/api/jobTemplates/[id]/visibility.put.ts`

- [ ] **Step 1: 实现 `server/api/jobTemplates/index.post.ts`**

```ts
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { getJobTemplateSchema, toJobTemplateMutation } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  // 经过 admin-auth middleware 后 event.context.adminUser 必有值；fallback 1 兜底
  const adminUserId = event.context.adminUser?.id ?? 1
  const body = await event.req.json()
  const parsed = getJobTemplateSchema().safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [created] = await db.insert(jobTemplate).values({
    ...toJobTemplateMutation(parsed.data),
    adminUserId,
    createdAt: Date.now(),
  }).$returningId()
  const id = Number((created as { id: number }).id)

  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  return row
})
```

- [ ] **Step 2: 实现 `server/api/jobTemplates/[id].put.ts`**

```ts
import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { getJobTemplateSchema, parseJobTemplateId, toJobTemplateMutation } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseJobTemplateId(event.context.params?.id)
  const body = await event.req.json()
  const parsed = getJobTemplateSchema().safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? '表单校验失败',
      data: parsed.error.flatten(),
    })
  }

  const [existing] = await db.select({ id: jobTemplate.id })
    .from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })
  }

  await db.update(jobTemplate).set({
    ...toJobTemplateMutation(parsed.data),
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(jobTemplate.id, id))

  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  return row
})
```

- [ ] **Step 3: 实现 `server/api/jobTemplates/[id].delete.ts`**

```ts
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseJobTemplateId } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseJobTemplateId(event.context.params?.id)
  const [row] = await db.select({ id: jobTemplate.id })
    .from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })
  }
  await db.delete(jobTemplate).where(eq(jobTemplate.id, id))
  return { id, success: true }
})
```

- [ ] **Step 4: 实现 `server/api/jobTemplates/[id]/visibility.put.ts`**

```ts
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { jobTemplate } from '../../../../drizzle/schema'

interface Payload {
  isVisible: boolean | 0 | 1
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '任务模板 ID 不合法' })

  const body = await readBody<Payload>(event)
  if (!body || body.isVisible === undefined)
    throw createError({ statusCode: 400, statusMessage: '缺少 isVisible 字段' })

  const [existing] = await db.select({ id: jobTemplate.id })
    .from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })

  const value = body.isVisible ? 1 : 0
  await db.update(jobTemplate).set({ isVisible: value }).where(eq(jobTemplate.id, id))
  return { id, isVisible: value }
})
```

- [ ] **Step 5: 类型检查**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "jobTemplates" || echo "api OK"`
Expected: 输出 `api OK`

- [ ] **Step 6: Commit**

```bash
git add server/api/jobTemplates
git commit --no-verify -m "feat(job_template): 新建/编辑/删除/可见性写接口"
```

---

## Task 5: 前端类型 + 弹层 + 列表页 + 菜单

**Files:**
- Create: `src/types/jobTemplates.ts`
- Create: `src/components/job-templates/JobTemplateDialog.vue`
- Create: `src/pages/job-templates/index.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: 实现 `src/types/jobTemplates.ts`**

```ts
export const REPEAT_TYPE_OPTIONS = [
  { label: '一次性', value: 'ONE_TIME' },
  { label: '每日', value: 'DAILY' },
  { label: '每周', value: 'WEEKLY' },
  { label: '每月', value: 'MONTHLY' },
  { label: '每年', value: 'YEARLY' },
] as const

export type RepeatType = (typeof REPEAT_TYPE_OPTIONS)[number]['value']

export interface JobTemplateTier {
  minAmount: number | null
  minCount: number | null
  logic: 'AND' | 'OR'
  description: string | null
}

export interface JobTemplateRow {
  id: number
  title: string
  repeatType: RepeatType
  startDate: number | null
  endDate: number | null
  tiers: JobTemplateTier[]
  taskTemplateId: number | null
  bankId: number | null
  bankName: string | null
  bankCardTemplateId: number | null
  isVisible: number
  updatedAt: string | null
}
```

- [ ] **Step 2: 实现 `src/components/job-templates/JobTemplateDialog.vue`**

```vue
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { REPEAT_TYPE_OPTIONS, type JobTemplateRow, type JobTemplateTier } from '@/types/jobTemplates'

const props = defineProps<{ visible: boolean, jobId: number | null }>()
const emit = defineEmits<{ 'update:visible': [boolean], 'saved': [] }>()

function emptyTier(): JobTemplateTier {
  return { minAmount: null, minCount: null, logic: 'AND', description: null }
}

const form = reactive({
  title: '',
  repeatType: 'MONTHLY' as JobTemplateRow['repeatType'],
  startDate: null as number | null,
  endDate: null as number | null,
  tiers: [emptyTier()] as JobTemplateTier[],
  taskTemplateId: null as number | null,
  bankId: null as number | null,
  bankCardTemplateId: null as number | null,
  isVisible: false,
})
const saving = ref(false)

function reset() {
  form.title = ''
  form.repeatType = 'MONTHLY'
  form.startDate = null
  form.endDate = null
  form.tiers = [emptyTier()]
  form.taskTemplateId = null
  form.bankId = null
  form.bankCardTemplateId = null
  form.isVisible = false
}

async function loadDetail(id: number) {
  try {
    const row = await requestJson<JobTemplateRow>(`/api/jobTemplates/${id}`)
    form.title = row.title
    form.repeatType = row.repeatType
    form.startDate = row.startDate
    form.endDate = row.endDate
    form.tiers = row.tiers?.length ? row.tiers.map(t => ({ ...t })) : [emptyTier()]
    form.taskTemplateId = row.taskTemplateId
    form.bankId = row.bankId
    form.bankCardTemplateId = row.bankCardTemplateId
    form.isVisible = !!row.isVisible
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载详情失败')
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    reset()
    if (props.jobId)
      loadDetail(props.jobId)
  }
})

function addTier() {
  form.tiers.push(emptyTier())
}
function removeTier(i: number) {
  if (form.tiers.length > 1)
    form.tiers.splice(i, 1)
}

async function handleConfirm() {
  if (!form.title.trim()) {
    MessagePlugin.warning('请填写标题')
    return
  }
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      repeatType: form.repeatType,
      startDate: form.startDate,
      endDate: form.endDate,
      tiers: form.tiers,
      taskTemplateId: form.taskTemplateId,
      bankId: form.bankId,
      bankCardTemplateId: form.bankCardTemplateId,
      isVisible: form.isVisible,
    }
    if (props.jobId)
      await requestJson(`/api/jobTemplates/${props.jobId}`, { method: 'PUT', body })
    else
      await requestJson('/api/jobTemplates', { method: 'POST', body })
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
</script>

<template>
  <t-dialog
    :visible="visible"
    :header="jobId ? '编辑任务模板' : '新增任务模板'"
    width="640px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
  >
    <t-form label-width="90px">
      <t-form-item label="标题">
        <t-input v-model="form.title" placeholder="如：本月刷满5笔" />
      </t-form-item>
      <t-form-item label="周期">
        <t-select v-model="form.repeatType" :options="[...REPEAT_TYPE_OPTIONS]" />
      </t-form-item>
      <t-form-item label="有效期起">
        <t-date-picker v-model="form.startDate" value-type="time-stamp" clearable />
      </t-form-item>
      <t-form-item label="有效期止">
        <t-date-picker v-model="form.endDate" value-type="time-stamp" clearable />
      </t-form-item>
      <t-form-item label="关联活动ID">
        <t-input-number v-model="form.taskTemplateId" :min="1" theme="normal" placeholder="可空" />
      </t-form-item>
      <t-form-item label="关联银行ID">
        <t-input-number v-model="form.bankId" :min="1" theme="normal" placeholder="可空" />
      </t-form-item>
      <t-form-item label="关联模板卡ID">
        <t-input-number v-model="form.bankCardTemplateId" :min="1" theme="normal" placeholder="可空" />
      </t-form-item>
      <t-form-item label="可见">
        <t-switch v-model="form.isVisible" />
      </t-form-item>
      <t-form-item label="档位">
        <div class="w-full flex flex-col gap-2">
          <div v-for="(tier, i) in form.tiers" :key="i" class="flex items-center gap-2">
            <t-input-number v-model="tier.minAmount" placeholder="金额" theme="normal" style="width: 110px" />
            <t-input-number v-model="tier.minCount" placeholder="笔数" theme="normal" style="width: 100px" />
            <t-select v-model="tier.logic" :options="[{ label: '且', value: 'AND' }, { label: '或', value: 'OR' }]" style="width: 80px" />
            <t-input v-model="tier.description" placeholder="说明" />
            <t-button size="small" variant="text" theme="danger" :disabled="form.tiers.length <= 1" @click="removeTier(i)">
              删除
            </t-button>
          </div>
          <t-button size="small" variant="outline" @click="addTier">
            + 增加档位
          </t-button>
        </div>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>
```

- [ ] **Step 3: 实现 `src/pages/job-templates/index.vue`**

```vue
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import JobTemplateDialog from '@/components/job-templates/JobTemplateDialog.vue'
import type { JobTemplateRow } from '@/types/jobTemplates'

const list = ref<JobTemplateRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)

const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'title', title: '标题', minWidth: 180 },
  { colKey: 'repeatType', title: '周期', width: 90 },
  { colKey: 'tiers', title: '档位数', width: 80 },
  { colKey: 'bankName', title: '关联银行', width: 120 },
  { colKey: 'isVisible', title: '可见', width: 80 },
  { colKey: 'updatedAt', title: '更新时间', minWidth: 150 },
  { colKey: 'actions', title: '操作', width: 150, fixed: 'right' as const },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await requestJson<{ list: JobTemplateRow[], total: number }>(
      `/api/jobTemplates?page=${page.value}&pageSize=${pageSize.value}&keyword=${encodeURIComponent(keyword.value)}`,
    )
    list.value = res.list
    total.value = res.total
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
function openEdit(row: JobTemplateRow) {
  editingId.value = row.id
  dialogVisible.value = true
}
function handleSaved() {
  dialogVisible.value = false
  fetchList()
}
async function toggleVisible(row: JobTemplateRow) {
  try {
    await requestJson(`/api/jobTemplates/${row.id}/visibility`, { method: 'PUT', body: { isVisible: !row.isVisible } })
    fetchList()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '切换失败')
  }
}
async function remove(row: JobTemplateRow) {
  try {
    await requestJson(`/api/jobTemplates/${row.id}`, { method: 'DELETE' })
    MessagePlugin.success('已删除')
    fetchList()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '删除失败')
  }
}
function onPageChange(info: { current: number, pageSize: number }) {
  page.value = info.current
  pageSize.value = info.pageSize
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="p-6">
    <t-card title="任务模板管理">
      <template #actions>
        <div class="flex gap-2">
          <t-input v-model="keyword" placeholder="搜索标题" clearable style="width: 200px" @enter="fetchList" />
          <t-button @click="fetchList">
            搜索
          </t-button>
          <t-button theme="primary" @click="openAdd">
            新增任务模板
          </t-button>
        </div>
      </template>

      <t-table
        row-key="id"
        :data="list"
        :columns="columns"
        :loading="loading"
        :pagination="{ current: page, pageSize, total }"
        stripe
        bordered
        @page-change="onPageChange"
      >
        <template #tiers="{ row }">
          {{ row.tiers?.length ?? 0 }}
        </template>
        <template #isVisible="{ row }">
          <t-switch :value="!!row.isVisible" @change="toggleVisible(row)" />
        </template>
        <template #actions="{ row }">
          <t-button size="small" variant="text" @click="openEdit(row)">
            编辑
          </t-button>
          <t-popconfirm content="确认删除？" @confirm="remove(row)">
            <t-button size="small" variant="text" theme="danger">
              删除
            </t-button>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <JobTemplateDialog
      v-model:visible="dialogVisible"
      :job-id="editingId"
      @saved="handleSaved"
    />
  </div>
</template>
```

- [ ] **Step 4: 在 `src/App.vue` 菜单加入口**

在 `<t-menu-item value="/coupon-categories" ...>` 那组同级位置后面新增（参照现有 `t-menu-item` 写法，图标可省略或复用现有 icon 组件）：

```vue
<t-menu-item value="/job-templates" to="/job-templates">
  <template #icon>
    <t-icon name="task" />
  </template>
  任务模板
</t-menu-item>
```

- [ ] **Step 5: 启动 dev 验证**

Run: `pnpm dev`（Node22）
手动验证（浏览器打开 admin）：
1. 左侧菜单出现「任务模板」，点击进入列表页无报错。
2. 点「新增任务模板」→ 填标题、选周期=每月、加 2 个档位（一档金额 100、一档笔数 5 选「或」）、填关联银行ID=某真实 bank.id → 保存成功，列表出现该行、档位数=2、关联银行名正确显示。
3. 编辑该行，改标题并保存 → 列表标题更新、更新时间变化。
4. 切换「可见」开关 → 不报错；刷新后状态保持。
5. 删除该行 → 列表移除。

Expected: 上述 5 步全部通过，浏览器控制台与终端无报错。

- [ ] **Step 6: Commit**

```bash
git add src/types/jobTemplates.ts src/components/job-templates src/pages/job-templates src/App.vue
git commit --no-verify -m "feat(job_template): 后台列表/编辑弹层/菜单入口"
```

---

## Self-Review 记录

- **Spec 覆盖：** ① 表+四索引→Task1；② tiers(含 logic)→Task1 schema + Task2 zod；③ 三维度 FK→Task1/3/4；④ 迁移→Task1；⑤ CRUD+可见性 API→Task3/4；⑥ 前端页+菜单→Task5。无遗漏。
- **不做项守界：** 全程不引用 how-api / ha，不改 task_template 列。✅
- **类型一致：** `getJobTemplateSchema / toJobTemplateMutation / parseJobTemplateId`（Task2）在 Task3/4 handler 中同名引用；`JobTemplateRow / JobTemplateTier / RepeatType`（Task5 types）在弹层与列表页一致使用；`jobTemplate` 表标识符全程一致。✅
- **占位符：** 无 TBD/TODO；每个改码步骤均含完整代码。✅
