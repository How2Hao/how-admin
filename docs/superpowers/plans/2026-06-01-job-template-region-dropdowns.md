# job_template 地区匹配 + 下拉选择器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `job_template` 新增 `regionCode`/`regionMatchStrategy` 两列（对齐 task_template 地区匹配设计），并将编辑弹层中银行/模板卡/活动三个维度的数字输入框改为可搜索下拉选择器，同时加入地区选择器。

**Architecture:** 三层改动串联：① DB 加列 + drizzle schema；② 纯工具函数更新（zod schema + mutation 映射）+ 活动搜索 Nitro 接口；③ 前端类型 + 对话框组件（复用现有 `/api/bankCardActivities/web/search*` 接口，活动用新建的 `/api/jobTemplates/searchActivities`）。列表 GET 同步增加 `regionCode` 字段（不影响其他接口）。

**Tech Stack:** Drizzle ORM (mysql-core) · Nitro (defineHandler/h3) · zod v4 (classic) · Vue 3 `<script setup>` + TDesign (`t-select filterable`) · vitest (Node 22)

> **环境约定：** 所有 `git commit` 用 `--no-verify`；vitest/vue-tsc 需要 Node 22（`export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`）。

---

## File Structure

**新建：**
- `drizzle/manual/0012_job_template_region.sql` — 加列迁移
- `server/api/jobTemplates/searchActivities.get.ts` — 活动（task_template）搜索，返回下拉 options

**修改：**
- `drizzle/schema.ts` — jobTemplate 追加 regionCode / regionMatchStrategy 两列
- `server/utils/jobTemplate.ts` — zod schema + toJobTemplateMutation 加两字段
- `test/job-template.test.ts` — 新增对 regionCode/regionMatchStrategy 的单测
- `server/api/jobTemplates/index.get.ts` — 列表响应加 regionCode
- `src/types/jobTemplates.ts` — JobTemplateRow 加 regionCode/regionMatchStrategy；新增 REGION_MATCH_STRATEGY_OPTIONS
- `src/components/job-templates/JobTemplateDialog.vue` — 三维度改下拉 + 地区/策略选择器

---

## Task 1: DB 加列 + drizzle schema

**Files:**
- Modify: `drizzle/schema.ts`（jobTemplate 表定义，追加两列）
- Create: `drizzle/manual/0012_job_template_region.sql`

- [ ] **Step 1: 在 `drizzle/schema.ts` 的 jobTemplate 表定义中，`bankCardTemplateId` 那行下方追加两列**

找到：
```ts
  bankCardTemplateId: int('bank_card_template_id'),
  adminUserId: int('admin_user_id').default(1).notNull(),
```

改为：
```ts
  bankCardTemplateId: int('bank_card_template_id'),
  regionCode: varchar('region_code', { length: 20 }),
  regionMatchStrategy: varchar('region_match_strategy', { length: 255 }),
  adminUserId: int('admin_user_id').default(1).notNull(),
```

- [ ] **Step 2: 创建 `drizzle/manual/0012_job_template_region.sql`**

```sql
-- job_template 新增地区匹配字段（对齐 task_template 设计）
-- region_code: 地区码（100000=全国，省级6位，地市级6位），null=不限地区
-- region_match_strategy: EXACT（精确匹配）| INCLUDE_ALL（省含全部地市）| EXCLUDE_PLAN_SINGLE_CITY（省排除计划单列市）
ALTER TABLE `job_template`
  ADD COLUMN `region_code` varchar(20) NULL AFTER `bank_card_template_id`,
  ADD COLUMN `region_match_strategy` varchar(255) NULL AFTER `region_code`;
```

- [ ] **Step 3: 类型检查 schema 改动**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "schema.ts" || echo "schema OK"`
Expected: 输出 `schema OK`

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/manual/0012_job_template_region.sql
git commit --no-verify -m "feat(job_template): 新增 regionCode/regionMatchStrategy 列与迁移"
```

---

## Task 2: 纯函数更新（zod + mutation）— TDD

**Files:**
- Modify: `server/utils/jobTemplate.ts`
- Modify: `test/job-template.test.ts`

- [ ] **Step 1: 先在 `test/job-template.test.ts` 末尾添加 region 测试（会 fail，因为实现还未更新）**

在文件末尾（`parseJobTemplateId` describe 块之后）追加：

```ts
describe('getJobTemplateSchema - region fields', () => {
  const base = {
    title: '测试',
    repeatType: 'MONTHLY' as const,
    tiers: [{ minCount: 1, logic: 'OR' as const, minAmount: null, description: null }],
  }

  it('defaults regionCode and regionMatchStrategy to null when omitted', () => {
    const r = getJobTemplateSchema().safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.regionCode).toBeNull()
      expect(r.data.regionMatchStrategy).toBeNull()
    }
  })

  it('accepts valid regionCode and regionMatchStrategy', () => {
    const r = getJobTemplateSchema().safeParse({ ...base, regionCode: '330000', regionMatchStrategy: 'EXCLUDE_PLAN_SINGLE_CITY' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.regionCode).toBe('330000')
      expect(r.data.regionMatchStrategy).toBe('EXCLUDE_PLAN_SINGLE_CITY')
    }
  })

  it('rejects regionMatchStrategy longer than 255 chars', () => {
    const r = getJobTemplateSchema().safeParse({ ...base, regionCode: '100000', regionMatchStrategy: 'x'.repeat(256) })
    expect(r.success).toBe(false)
  })
})

describe('toJobTemplateMutation - region fields', () => {
  it('includes regionCode and regionMatchStrategy in mutation output', () => {
    const parsed = getJobTemplateSchema().parse({
      title: 'x',
      repeatType: 'MONTHLY',
      tiers: [{ minCount: 1, logic: 'OR', minAmount: null, description: null }],
      regionCode: '110000',
      regionMatchStrategy: 'INCLUDE_ALL',
    })
    const v = toJobTemplateMutation(parsed)
    expect(v.regionCode).toBe('110000')
    expect(v.regionMatchStrategy).toBe('INCLUDE_ALL')
  })

  it('passes null through when region fields are absent', () => {
    const parsed = getJobTemplateSchema().parse({
      title: 'x',
      repeatType: 'MONTHLY',
      tiers: [{ minCount: 1, logic: 'OR', minAmount: null, description: null }],
    })
    const v = toJobTemplateMutation(parsed)
    expect(v.regionCode).toBeNull()
    expect(v.regionMatchStrategy).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认 fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" && pnpm exec vitest run test/job-template.test.ts 2>&1 | grep -E "FAIL|fail|regionCode" | head`
Expected: FAIL（`regionCode` 字段不存在于 schema 输出）

- [ ] **Step 3: 更新 `server/utils/jobTemplate.ts`**

在 `getJobTemplateSchema()` 的 `z.object({...})` 中，`bankCardTemplateId` 行后追加两个字段：

```ts
    bankCardTemplateId: z.number().int().positive().nullish().transform(v => v ?? null),
    regionCode: z.string().max(20).nullish().transform(v => v ?? null),
    regionMatchStrategy: z.string().max(255).nullish().transform(v => v ?? null),
    isVisible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
```

在 `toJobTemplateMutation` 的 return 对象中，`bankCardTemplateId` 行后追加：

```ts
    bankCardTemplateId: input.bankCardTemplateId,
    regionCode: input.regionCode,
    regionMatchStrategy: input.regionMatchStrategy,
    isVisible: input.isVisible ? 1 : 0,
```

（注：`JobTemplateInput` 类型由 `z.infer` 自动派生，无需手动改动。）

- [ ] **Step 4: 运行确认全部通过**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" && pnpm exec vitest run test/job-template.test.ts 2>&1 | grep -E "Test Files|Tests " | head`
Expected: `Test Files 1 passed` / `Tests 15 passed`（原 9 + 新 6）

- [ ] **Step 5: Commit**

```bash
git add server/utils/jobTemplate.ts test/job-template.test.ts
git commit --no-verify -m "feat(job_template): zod schema + mutation 加入 regionCode/regionMatchStrategy"
```

---

## Task 3: 活动搜索接口 + 列表 GET 加 regionCode

**Files:**
- Create: `server/api/jobTemplates/searchActivities.get.ts`
- Modify: `server/api/jobTemplates/index.get.ts`

- [ ] **Step 1: 创建 `server/api/jobTemplates/searchActivities.get.ts`**

模式与 `/api/bankCardActivities/web/searchBankCardTemplates.get.ts` 一致，但搜索的是 `task_template` 并返回活动标题+银行名。

```ts
import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'

export default defineHandler(async (event) => {
  await referenceData.ensureInitialized()
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return { options: [] }
  }

  return {
    options: referenceData.searchTemplates(q, 10).map(match => ({
      label: match.item.title,
      value: match.item.id,
      bankName: match.item.bankName ?? null,
    })),
  }
})
```

> 注意：`referenceData.searchTemplates` 搜的是 `_templateFuse`（task_template，即"活动"），`match.item` 的形状来自 `referenceData.ts`。先读 `server/agent/utils/referenceData.ts` 确认 `_templateFuse` 的 item 有 `title`、`id`、`bankName` 字段；若字段名不同，以实际为准——绝不猜测。

- [ ] **Step 2: 更新 `server/api/jobTemplates/index.get.ts` 列表响应加 regionCode**

在 `.select({...})` 的 `bankCardTemplateId` 行后追加：
```ts
      bankCardTemplateId: jobTemplate.bankCardTemplateId,
      regionCode: jobTemplate.regionCode,
```

在最后的 `.map(row => ({...}))` 里，`bankCardTemplateId` 行后追加：
```ts
      bankCardTemplateId: row.bankCardTemplateId,
      regionCode: row.regionCode ?? null,
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "jobTemplates" || echo "api OK"`
Expected: `api OK`

- [ ] **Step 4: Commit**

```bash
git add server/api/jobTemplates/searchActivities.get.ts server/api/jobTemplates/index.get.ts
git commit --no-verify -m "feat(job_template): 活动搜索接口 + 列表响应加 regionCode"
```

---

## Task 4: 前端类型 + 对话框组件重写

**Files:**
- Modify: `src/types/jobTemplates.ts`
- Modify: `src/components/job-templates/JobTemplateDialog.vue`

### Step 1: 更新 `src/types/jobTemplates.ts`

- [ ] 在文件末尾追加 region 相关常量和类型；同时在 `JobTemplateRow` 接口加两个字段：

```ts
// 在现有内容末尾追加：

export type RegionMatchStrategy = 'EXACT' | 'INCLUDE_ALL' | 'EXCLUDE_PLAN_SINGLE_CITY'

export const REGION_MATCH_STRATEGY_OPTIONS = [
  { label: '精确匹配', value: 'EXACT' },
  { label: '省（含全部地市）', value: 'INCLUDE_ALL' },
  { label: '省（排除计划单列市）', value: 'EXCLUDE_PLAN_SINGLE_CITY' },
]
```

在 `JobTemplateRow` 接口中，`bankCardTemplateId` 行后追加：

```ts
  bankCardTemplateId: number | null
  regionCode: string | null
  regionMatchStrategy: string | null
```

### Step 2: 重写 `src/components/job-templates/JobTemplateDialog.vue`

- [ ] 将文件完整替换为以下内容：

```vue
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { REGION_MATCH_STRATEGY_OPTIONS, REPEAT_TYPE_OPTIONS, type JobTemplateRow, type JobTemplateTier } from '@/types/jobTemplates'

const props = defineProps<{ visible: boolean, jobId: number | null }>()
const emit = defineEmits<{ 'update:visible': [boolean], 'saved': [] }>()

const LOGIC_OPTIONS = [{ label: '且', value: 'AND' }, { label: '或', value: 'OR' }]

// ── 搜索选项状态 ──────────────────────────────────────────────
interface SelectOption { label: string, value: number | string, bankName?: string | null }

const bankOptions = ref<SelectOption[]>([])
const bankCardTemplateOptions = ref<SelectOption[]>([])
const activityOptions = ref<SelectOption[]>([])
const regionOptions = ref<SelectOption[]>([])

async function searchBanks(q: string) {
  if (!q.trim()) { bankOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/bankCardActivities/web/searchBanks?q=${encodeURIComponent(q)}`)
    bankOptions.value = res.options
  }
  catch {}
}

async function searchBankCardTemplates(q: string) {
  if (!q.trim()) { bankCardTemplateOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/bankCardActivities/web/searchBankCardTemplates?q=${encodeURIComponent(q)}`)
    bankCardTemplateOptions.value = res.options
  }
  catch {}
}

async function searchActivities(q: string) {
  if (!q.trim()) { activityOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/jobTemplates/searchActivities?q=${encodeURIComponent(q)}`)
    activityOptions.value = res.options
  }
  catch {}
}

async function searchRegions(q: string) {
  if (!q.trim()) { regionOptions.value = []; return }
  try {
    const res = await requestJson<{ options: SelectOption[] }>(`/api/bankCardActivities/web/searchRegions?q=${encodeURIComponent(q)}`)
    regionOptions.value = res.options
  }
  catch {}
}

// ── 表单 ─────────────────────────────────────────────────────
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
  regionCode: null as string | null,
  regionMatchStrategy: null as string | null,
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
  form.regionCode = null
  form.regionMatchStrategy = null
  form.isVisible = false
  bankOptions.value = []
  bankCardTemplateOptions.value = []
  activityOptions.value = []
  regionOptions.value = []
}

// 编辑时：先加载详情，再回填当前值到各搜索选项（让选择器显示可读名称而非空）
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
    form.regionCode = row.regionCode
    form.regionMatchStrategy = row.regionMatchStrategy
    form.isVisible = !!row.isVisible

    // 回填选项（让选择器显示名称，不能只存 id/code）
    await Promise.allSettled([
      row.bankId ? searchBanks(String(row.bankId)) : Promise.resolve(),
      row.bankCardTemplateId ? searchBankCardTemplates(String(row.bankCardTemplateId)) : Promise.resolve(),
      row.taskTemplateId ? searchActivities(String(row.taskTemplateId)) : Promise.resolve(),
      row.regionCode ? searchRegions(row.regionCode) : Promise.resolve(),
    ])
    // 若搜索结果不含当前值（搜索词太短），注入占位选项
    if (row.bankId && !bankOptions.value.find(o => o.value === row.bankId))
      bankOptions.value = [{ label: `银行 ID: ${row.bankId}`, value: row.bankId }]
    if (row.bankCardTemplateId && !bankCardTemplateOptions.value.find(o => o.value === row.bankCardTemplateId))
      bankCardTemplateOptions.value = [{ label: `模板卡 ID: ${row.bankCardTemplateId}`, value: row.bankCardTemplateId }]
    if (row.taskTemplateId && !activityOptions.value.find(o => o.value === row.taskTemplateId))
      activityOptions.value = [{ label: `活动 ID: ${row.taskTemplateId}`, value: row.taskTemplateId }]
    if (row.regionCode && !regionOptions.value.find(o => o.value === row.regionCode))
      regionOptions.value = [{ label: row.regionCode, value: row.regionCode }]
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

// ── 档位操作 ─────────────────────────────────────────────────
function addTier() { form.tiers.push(emptyTier()) }
function removeTier(i: number) { if (form.tiers.length > 1) form.tiers.splice(i, 1) }

// ── writable computeds（date-picker null↔undefined bridge） ──
const startDateModel = computed({
  get: () => form.startDate ?? undefined,
  set: (v) => { form.startDate = v ?? null },
})
const endDateModel = computed({
  get: () => form.endDate ?? undefined,
  set: (v) => { form.endDate = v ?? null },
})

// ── 提交 ────────────────────────────────────────────────────
async function handleConfirm() {
  if (!form.title.trim()) { MessagePlugin.warning('请填写标题'); return }
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
      regionCode: form.regionCode,
      regionMatchStrategy: form.regionMatchStrategy,
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
    width="680px"
    :confirm-btn="{ content: '保存', loading: saving }"
    @update:visible="emit('update:visible', $event)"
    @confirm="handleConfirm"
    @close="emit('update:visible', false)"
  >
    <t-form label-width="90px">
      <t-form-item label="标题">
        <t-input v-model="form.title" placeholder="如：本月刷满5笔" />
      </t-form-item>
      <t-form-item label="周期">
        <t-select v-model="form.repeatType" :options="[...REPEAT_TYPE_OPTIONS]" />
      </t-form-item>
      <t-form-item label="有效期起">
        <t-date-picker v-model="startDateModel" value-type="time-stamp" clearable />
      </t-form-item>
      <t-form-item label="有效期止">
        <t-date-picker v-model="endDateModel" value-type="time-stamp" clearable />
      </t-form-item>

      <t-form-item label="关联活动">
        <t-select
          v-model="form.taskTemplateId"
          filterable
          clearable
          :options="activityOptions"
          placeholder="搜索活动标题"
          @search="searchActivities"
        >
          <t-option
            v-for="opt in activityOptions"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          >
            <span>{{ opt.label }}</span>
            <span v-if="opt.bankName" class="ml-1 text-xs text-gray-400">{{ opt.bankName }}</span>
          </t-option>
        </t-select>
      </t-form-item>

      <t-form-item label="关联银行">
        <t-select
          v-model="form.bankId"
          filterable
          clearable
          :options="bankOptions"
          placeholder="搜索银行名称"
          @search="searchBanks"
        />
      </t-form-item>

      <t-form-item label="关联模板卡">
        <t-select
          v-model="form.bankCardTemplateId"
          filterable
          clearable
          :options="bankCardTemplateOptions"
          placeholder="搜索模板卡名称"
          @search="searchBankCardTemplates"
        />
      </t-form-item>

      <t-form-item label="适用地区">
        <t-select
          v-model="form.regionCode"
          filterable
          clearable
          :options="regionOptions"
          placeholder="搜索地区名称"
          @search="searchRegions"
          @change="form.regionMatchStrategy = null"
        />
      </t-form-item>

      <t-form-item v-if="form.regionCode" label="匹配策略">
        <t-select v-model="form.regionMatchStrategy" :options="REGION_MATCH_STRATEGY_OPTIONS" clearable placeholder="请选择" />
      </t-form-item>

      <t-form-item label="可见">
        <t-switch v-model="form.isVisible" />
      </t-form-item>

      <t-form-item label="档位">
        <div class="w-full flex flex-col gap-2">
          <div v-for="(tier, i) in form.tiers" :key="i" class="flex items-center gap-2">
            <t-input-number
              :model-value="tier.minAmount ?? undefined"
              placeholder="金额"
              theme="normal"
              style="width: 110px"
              @change="(v: string | number) => { tier.minAmount = typeof v === 'number' ? v : null }"
            />
            <t-input-number
              :model-value="tier.minCount ?? undefined"
              placeholder="笔数"
              theme="normal"
              style="width: 100px"
              @change="(v: string | number) => { tier.minCount = typeof v === 'number' ? v : null }"
            />
            <t-select v-model="tier.logic" :options="LOGIC_OPTIONS" style="width: 80px" />
            <t-input
              :model-value="tier.description ?? undefined"
              placeholder="说明"
              @change="(v: string | number) => { tier.description = String(v) || null }"
            />
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

- [ ] **Step 3: 类型检查前端（Node 22）**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" && pnpm run typecheck 2>&1 | grep -i "jobTemplate\|JobTemplate\|job-template" || echo "frontend OK"`
Expected: `frontend OK`（jobTemplates 相关无新增错误；已有的 ~15 个无关文件错误可忽略）

- [ ] **Step 4: 确认无 `as any`**

Run: `grep "as any" src/components/job-templates/JobTemplateDialog.vue || echo "clean"`
Expected: `clean`

- [ ] **Step 5: Commit**

```bash
git add src/types/jobTemplates.ts src/components/job-templates/JobTemplateDialog.vue
git commit --no-verify -m "feat(job_template): 地区选择器 + 三维度改可搜索下拉"
```

---

## Self-Review 记录

**Spec 覆盖：**
- regionCode/regionMatchStrategy DB 列 → Task 1 ✅
- zod schema/mutation 加字段 → Task 2 ✅
- 活动搜索接口 → Task 3 ✅
- 列表 GET 加 regionCode → Task 3 ✅
- 前端类型（REGION_MATCH_STRATEGY_OPTIONS/JobTemplateRow） → Task 4 ✅
- 弹层银行/模板卡/活动三维度改下拉搜索 → Task 4 ✅
- 弹层地区选择器 + 匹配策略选择器（仅 regionCode 有值时显示） → Task 4 ✅
- 编辑模式回填当前选项（显示可读名称而非 ID） → Task 4 ✅
- 切换地区时自动清空策略 → Task 4 ✅

**不做（明确边界）：**
- 列表页表格不加地区列（列宽已满，后续可按需加；核心是弹层）
- 不改 `task_template` 任何字段
- 不碰 how-api/ha

**类型一致性：**
- `regionCode: string | null` / `regionMatchStrategy: string | null` 在 DB 列/zod 输出/toJobTemplateMutation/JobTemplateRow/form 各层一致
- searchActivities 返回 `{ options: {label, value, bankName?} }` 与其他 search* API 形状一致
- `REGION_MATCH_STRATEGY_OPTIONS`（Task 4 types）在弹层 template 中使用，命名一致

**占位符扫描：** 无 TBD/TODO；每个改码步骤均含完整代码；Task 3 Step 1 有一个"先读文件确认字段名"的指令，这是必要的防御性提醒（referenceData item 形状不确定），非占位符。
