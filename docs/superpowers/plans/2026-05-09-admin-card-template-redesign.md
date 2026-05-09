# Admin 卡片模板管理重构 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 how-admin 的"卡片模板管理"从 t-table 单页升级为侧边栏二级菜单（信用卡管理 / 借记卡管理），信用卡页改为左侧银行分组 + 右侧卡片网格（封面 190×120 横向 + Switch 控制 is_visible），借记卡页占位。

**Architecture:** 全部改动收敛在 how-admin 仓库内：drizzle 加列 `is_visible` 并回填，how-admin 内置 Nitro 后端在 `server/api/cardTemplates/` 下扩接口；前端 `pages/card-templates/` 拆 `credit.vue` / `debit.vue` 两个子页 + `components/` 复用组件。how-api（hi）一行不动 —— hi 只服务 ha，TypeORM `synchronize: false` 不会因 schema 不同步出问题。

**Tech Stack:** Vue 3 + TDesign vue-next + UnoCSS（前端）；Nitro + drizzle-orm + MySQL2（后端）；vitest（测试）；pnpm 10。

**关联文档：** `docs/superpowers/specs/2026-05-09-admin-card-template-redesign-design.md`

**Git 注意：** pre-commit hook 当前因 Node 版本问题 ESLint 加载失败（`Object.groupBy is not a function`，需 Node 21+）。文档/纯改动可用 `git commit --no-verify`，代码改动应在 Node 21+ 环境下提交，否则提示用户。

---

## 文件结构

```
how-admin/
├── drizzle/
│   ├── manual/0006_card_template_is_visible.sql   ← 新增
│   └── schema.ts                                   ← 改：bankCardTemplate 加 isVisible
├── server/api/cardTemplates/
│   ├── bank-groups.get.ts                          ← 新增
│   ├── [id]/
│   │   ├── visibility.patch.ts                     ← 新增
│   │   └── approve.post.ts                         ← 删除
│   ├── index.get.ts                                ← 改：select + isVisible
│   ├── [id].get.ts                                 ← 改：select + isVisible
│   └── [id].put.ts                                 ← 不动（passthrough 已含 alias，dataSource 暂不开放编辑）
├── src/
│   ├── App.vue                                     ← 改：把 t-menu-item /card-templates 改为 t-submenu
│   ├── components/card-templates/                  ← 删整目录（迁移完成后）
│   └── pages/card-templates/
│       ├── index.vue                               ← 删
│       ├── credit.vue                              ← 新增
│       ├── debit.vue                               ← 新增
│       └── components/
│           ├── BankSidebar.vue                     ← 新增
│           ├── BankItem.vue                        ← 新增
│           ├── CardGrid.vue                        ← 新增
│           ├── CardItem.vue                        ← 新增
│           └── CardEditDialog.vue                  ← 从 src/components/card-templates 迁移
```

---

## Task 1: DB migration 与 drizzle schema 同步

**Files:**
- Create: `drizzle/manual/0006_card_template_is_visible.sql`
- Modify: `drizzle/schema.ts`

- [ ] **Step 1.1: 写 migration SQL**

新建 `drizzle/manual/0006_card_template_is_visible.sql`：

```sql
-- bank_card_template 加 is_visible：admin Switch 控制对外展示
-- 回填规则：51credit→0（隐藏，admin 待发布），flyert→1（已发布）
-- MySQL 8 ALGORITHM=INSTANT 加列即时完成，零停机

ALTER TABLE `bank_card_template`
  ADD COLUMN `is_visible` TINYINT(1) NOT NULL DEFAULT 1
  COMMENT '是否对外展示（admin Switch 控制；ha 后续 PR 切换查询条件用此字段）'
  AFTER `cover`;

UPDATE `bank_card_template` SET `is_visible` = 0 WHERE `data_source` = '51credit';
UPDATE `bank_card_template` SET `is_visible` = 1 WHERE `data_source` = 'flyert';
```

- [ ] **Step 1.2: 同步 drizzle schema**

修改 `drizzle/schema.ts`，找到 `bankCardTemplate` 定义，在 `cover: varchar(...)` 那行后插入：

```ts
isVisible: tinyint('is_visible').default(1).notNull(),
```

（`tinyint` 已在文件顶部 import，无需新增 import。）

- [ ] **Step 1.3: 在本地 dev DB 执行 migration**

```bash
cd how-admin
pnpm dlx tsx scripts/run-manual-migration.ts drizzle/manual/0006_card_template_is_visible.sql
```

期望：脚本输出执行成功，无错误。

- [ ] **Step 1.4: 用 SQL 验证回填正确**

```bash
mysql -u<user> -p<pwd> <db> -e "SELECT data_source, COUNT(*) AS total, SUM(is_visible) AS visible FROM bank_card_template GROUP BY data_source;"
```

期望（与 dump 一致的样本）：

| data_source | total | visible |
|---|---|---|
| 51credit | N₁ | 0 |
| flyert | N₂ | N₂ |

`51credit` 行 `visible` 必须为 0，`flyert` 行 `visible` 必须等于 `total`。

- [ ] **Step 1.5: Commit**

```bash
git add drizzle/manual/0006_card_template_is_visible.sql drizzle/schema.ts
git commit -m "feat(db): bank_card_template add is_visible with backfill"
```

---

## Task 2: 新增 bank-groups 接口（左侧栏数据）

**Files:**
- Create: `server/api/cardTemplates/bank-groups.get.ts`

- [ ] **Step 2.1: 写接口实现**

新建 `server/api/cardTemplates/bank-groups.get.ts`：

```ts
import { eq, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCardTemplate } from '../../../drizzle/schema'

// 左侧银行分组：每家银行的信用卡总数 + 来源拆分（flyert / 51credit / self）
// 不带 is_visible 过滤 —— admin 看的是全量，不论是否对外展示
export default defineHandler(async () => {
  const rows = await db
    .select({
      bankId: bankCardTemplate.bankId,
      bankName: bank.name,
      bankLogo: bank.logoUrl,
      bankColor: bank.color,
      total: sql<number>`COUNT(*)`,
      flyertCount: sql<number>`SUM(CASE WHEN ${bankCardTemplate.dataSource} = 'flyert' THEN 1 ELSE 0 END)`,
      credit51Count: sql<number>`SUM(CASE WHEN ${bankCardTemplate.dataSource} = '51credit' THEN 1 ELSE 0 END)`,
      selfCount: sql<number>`SUM(CASE WHEN ${bankCardTemplate.dataSource} = 'self' THEN 1 ELSE 0 END)`,
    })
    .from(bankCardTemplate)
    .leftJoin(bank, sql`${bank.id} = CAST(${bankCardTemplate.bankId} AS UNSIGNED)`)
    .where(eq(bankCardTemplate.cardType, '1'))
    .groupBy(bankCardTemplate.bankId, bank.name, bank.logoUrl, bank.color)
    .orderBy(sql`COUNT(*) DESC`)

  return {
    list: rows.map(r => ({
      bankId: r.bankId,
      bankName: r.bankName ?? `(未匹配 bank.id=${r.bankId})`,
      bankLogo: r.bankLogo ?? null,
      bankColor: r.bankColor ?? null,
      total: Number(r.total ?? 0),
      sourceCounts: {
        flyert: Number(r.flyertCount ?? 0),
        '51credit': Number(r.credit51Count ?? 0),
        self: Number(r.selfCount ?? 0),
      },
    })),
  }
})
```

> 注意：drizzle schema 里 `bank` 的字段名是否为 `logoUrl` / `color` 需先 grep 确认。如果实际字段名不同，按实际写。

- [ ] **Step 2.2: 在 schema.ts 里确认 bank 表字段名**

```bash
grep -A 25 "^export const bank = mysqlTable" drizzle/schema.ts
```

把上面 `bank.logoUrl` / `bank.color` 替换成实际字段名（dump 里 bank 表有 `logo_url` / `color` 列，drizzle 里多半是 `logoUrl` / `color`，但请用 grep 实际确认）。

- [ ] **Step 2.3: 启动 dev server 手动 curl 验证**

```bash
pnpm dev   # 起一个新终端跑
curl -s 'http://localhost:3333/api/cardTemplates/bank-groups' | head -c 1000
```

期望：返回 JSON `{ list: [{bankId, bankName, bankLogo, bankColor, total, sourceCounts: {...}}, ...] }`，按 total 倒序。

- [ ] **Step 2.4: Commit**

```bash
git add server/api/cardTemplates/bank-groups.get.ts
git commit -m "feat(admin-api): add bank-groups endpoint for credit card sidebar"
```

---

## Task 3: 新增 visibility patch 接口

**Files:**
- Create: `server/api/cardTemplates/[id]/visibility.patch.ts`

- [ ] **Step 3.1: 写接口实现**

新建 `server/api/cardTemplates/[id]/visibility.patch.ts`：

```ts
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankCardTemplate } from '../../../../drizzle/schema'

interface Payload {
  is_visible?: 0 | 1 | boolean
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })
  }
  const body = await readBody<Payload>(event)
  if (!body || body.is_visible === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'is_visible 不能为空' })
  }
  const next = body.is_visible === 1 || body.is_visible === true ? 1 : 0

  const [existing] = await db
    .select({ id: bankCardTemplate.id })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  }

  await db
    .update(bankCardTemplate)
    .set({ isVisible: next, updatedAt: Date.now() })
    .where(eq(bankCardTemplate.id, id))

  return { id, isVisible: next, success: true }
})
```

- [ ] **Step 3.2: 手动 curl 验证**

```bash
# 选一张已知 id=348 的卡（dump 里招行 Hello Kitty 浪漫洋装）
curl -s -X PATCH 'http://localhost:3333/api/cardTemplates/348/visibility' \
  -H 'Content-Type: application/json' -d '{"is_visible": 0}'
# 期望：{"id":348,"isVisible":0,"success":true}

curl -s -X PATCH 'http://localhost:3333/api/cardTemplates/348/visibility' \
  -H 'Content-Type: application/json' -d '{"is_visible": 1}'
# 期望：{"id":348,"isVisible":1,"success":true}

# 再用 SQL 复核
mysql ... -e "SELECT id, is_visible FROM bank_card_template WHERE id=348;"
```

错误用例：

```bash
curl -s -X PATCH 'http://localhost:3333/api/cardTemplates/0/visibility' \
  -H 'Content-Type: application/json' -d '{"is_visible": 1}'
# 期望：400 模板 ID 不合法

curl -s -X PATCH 'http://localhost:3333/api/cardTemplates/99999999/visibility' \
  -H 'Content-Type: application/json' -d '{"is_visible": 1}'
# 期望：404 模板不存在
```

- [ ] **Step 3.3: Commit**

```bash
git add server/api/cardTemplates/\[id\]/visibility.patch.ts
git commit -m "feat(admin-api): add card template visibility patch endpoint"
```

---

## Task 4: 扩展 list / detail 接口返回 isVisible

**Files:**
- Modify: `server/api/cardTemplates/index.get.ts`
- Modify: `server/api/cardTemplates/[id].get.ts`

- [ ] **Step 4.1: 改 index.get.ts**

在 `server/api/cardTemplates/index.get.ts` 第 38-39 行的 select 字段块里（`cover` 字段之后），插入：

```ts
      isVisible: bankCardTemplate.isVisible,
```

完整位置示意（修改后的 select 片段）：

```ts
      cover: bankCardTemplate.cover,
      isVisible: bankCardTemplate.isVisible,
      alias: bankCardTemplate.alias,
```

- [ ] **Step 4.2: 改 [id].get.ts**

在 `server/api/cardTemplates/[id].get.ts` 第 21 行 `cover: bankCardTemplate.cover,` 之后插入：

```ts
      isVisible: bankCardTemplate.isVisible,
```

- [ ] **Step 4.3: 手动 curl 验证返回字段**

```bash
curl -s 'http://localhost:3333/api/cardTemplates?bankId=303&page=1&pageSize=2' | head -c 800
# 期望：list 里每条都有 isVisible 字段（值为 0 或 1）

curl -s 'http://localhost:3333/api/cardTemplates/348' | head -c 500
# 期望：返回对象含 isVisible: 0（招行 348 来源 51credit，回填后应为 0）
```

- [ ] **Step 4.4: Commit**

```bash
git add server/api/cardTemplates/index.get.ts server/api/cardTemplates/\[id\].get.ts
git commit -m "feat(admin-api): expose isVisible in card template list/detail"
```

---

## Task 5: 删除 approve 接口

**Files:**
- Delete: `server/api/cardTemplates/[id]/approve.post.ts`

- [ ] **Step 5.1: 确认接口不再被前端调用**

```bash
grep -rn "approve" /Users/wyhnotwhy/Documents/Kuaishou/How2hao/how-admin/src/
```

期望：除了 `pages/card-templates/index.vue`（旧页，下面会删）外，没有别处调用。如果发现别处仍在调，停手并向用户汇报；本计划假设 approve 仅旧页用。

- [ ] **Step 5.2: 删除文件**

```bash
git rm server/api/cardTemplates/\[id\]/approve.post.ts
```

- [ ] **Step 5.3: Commit**

```bash
git commit -m "feat(admin-api): drop approve endpoint (replaced by visibility switch)"
```

---

## Task 6: 路由注册 + 菜单升级 + 占位空页

**Files:**
- Modify: `src/App.vue`（行 93-98，原 `<t-menu-item value="/card-templates">`）
- Create: `src/pages/card-templates/credit.vue`（先写最简骨架）
- Create: `src/pages/card-templates/debit.vue`
- Modify: 旧 `src/pages/card-templates/index.vue` 改为 redirect 到 `/card-templates/credit`（保留兼容）

> 路由由 vue-router 文件路径自动生成（`vite-plugin-vue-router`）；`pages/card-templates/credit.vue` ⇒ `/card-templates/credit`。

- [ ] **Step 6.1: 替换 App.vue 菜单项**

在 `src/App.vue` 第 93-98 行（原本是 `<t-menu-item value="/card-templates" ...>`），替换为：

```vue
          <t-submenu value="/card-templates">
            <template #icon>
              <div i-carbon:purchase mr-3 />
            </template>
            <template #title>
              <span>卡片模板管理</span>
            </template>
            <t-menu-item value="/card-templates/credit" to="/card-templates/credit">
              <template #icon>
                <div i-carbon:credit-card mr-2 />
              </template>
              信用卡管理
            </t-menu-item>
            <t-menu-item value="/card-templates/debit" to="/card-templates/debit">
              <template #icon>
                <div i-carbon:money mr-2 />
              </template>
              借记卡管理
            </t-menu-item>
          </t-submenu>
```

同时把 `<t-menu :default-expanded="['bank-card-activities']">`（约第 60 行）改为 `:default-expanded="['bank-card-activities', '/card-templates']"`，保证默认展开新二级。

- [ ] **Step 6.2: 写 credit.vue 最简骨架**

新建 `src/pages/card-templates/credit.vue`：

```vue
<script setup lang="ts">
// 信用卡管理 · 后续 Task 13 会接通真实数据流
</script>

<template>
  <div class="page-credit">
    信用卡管理（骨架）
  </div>
</template>

<style scoped>
.page-credit {
  padding: 16px;
}
</style>
```

- [ ] **Step 6.3: 写 debit.vue 占位页**

新建 `src/pages/card-templates/debit.vue`：

```vue
<script setup lang="ts">
// 借记卡管理 · 占位页（后续 PR 实现）
</script>

<template>
  <t-empty description="借记卡管理 · 待实现">
    <template #action>
      <span style="color:#888">本期仅完成信用卡管理重构，借记卡功能将在后续 PR 上线。</span>
    </template>
  </t-empty>
</template>

<style scoped>
.t-empty {
  margin-top: 80px;
}
</style>
```

- [ ] **Step 6.4: 旧 index.vue 改成 redirect（暂时）**

把 `src/pages/card-templates/index.vue` **整个内容替换** 为：

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
router.replace('/card-templates/credit')
</script>

<template>
  <div />
</template>
```

> 注：vue-router auto routing 下，访问 `/card-templates`（无 trailing 子路由）会命中 `pages/card-templates/index.vue`，redirect 后等价于走 credit。这一步是暂态，Task 11/12 完成后旧 index.vue 直接整文件删除。

- [ ] **Step 6.5: 启动 dev server 验证**

```bash
pnpm dev
```

打开 `http://localhost:3333/`：
- 侧边栏 "卡片模板管理" 应展示为可展开的二级菜单
- 点击 "信用卡管理" → URL `/card-templates/credit`，页面显示 "信用卡管理（骨架）"
- 点击 "借记卡管理" → URL `/card-templates/debit`，页面显示 t-empty
- 直接访问 `/card-templates` → 自动跳到 `/card-templates/credit`

- [ ] **Step 6.6: Commit**

```bash
git add src/App.vue src/pages/card-templates/
git commit -m "feat(admin-ui): scaffold card-templates submenu with credit/debit pages"
```

---

## Task 7: BankSidebar + BankItem 组件

**Files:**
- Create: `src/pages/card-templates/components/BankItem.vue`
- Create: `src/pages/card-templates/components/BankSidebar.vue`

- [ ] **Step 7.1: 写 BankItem.vue**

```vue
<script setup lang="ts">
interface SourceCounts {
  flyert: number
  '51credit': number
  self: number
}
defineProps<{
  bankId: string
  bankName: string
  bankLogo: string | null
  bankColor: string | null
  total: number
  sourceCounts: SourceCounts
  selected: boolean
}>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <div class="bank-item" :class="{ selected }" @click="$emit('click')">
    <div class="row">
      <img v-if="bankLogo" :src="bankLogo" class="logo" :alt="bankName">
      <div v-else class="logo placeholder" />
      <div class="name">{{ bankName }}</div>
      <div class="total">{{ total }} 张</div>
    </div>
    <div class="chips">
      <span class="chip flyert" :class="{ zero: sourceCounts.flyert === 0 }">飞客 {{ sourceCounts.flyert }}</span>
      <span class="chip credit51" :class="{ zero: sourceCounts['51credit'] === 0 }">51 {{ sourceCounts['51credit'] }}</span>
      <span class="chip self" :class="{ zero: sourceCounts.self === 0 }">自建 {{ sourceCounts.self }}</span>
    </div>
  </div>
</template>

<style scoped>
.bank-item {
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background .15s;
}
.bank-item:hover { background: #fafbfd; }
.bank-item.selected { background: #eef4ff; border-left-color: #2563eb; }
.row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.logo { width: 36px; height: 36px; border-radius: 6px; object-fit: contain; background: #fff; flex-shrink: 0; }
.logo.placeholder { background: #e5e7eb; }
.name { font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bank-item.selected .name { font-weight: 600; }
.total { font-size: 11px; color: #888; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; }
.chip { padding: 2px 8px; border-radius: 10px; }
.chip.flyert { background: #dbeafe; color: #1e40af; }
.chip.credit51 { background: #fef3c7; color: #92400e; }
.chip.self { background: #dcfce7; color: #166534; }
.chip.zero { background: #f3f4f6; color: #888; }
</style>
```

- [ ] **Step 7.2: 写 BankSidebar.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import BankItem from './BankItem.vue'

interface SourceCounts { flyert: number, '51credit': number, self: number }
interface BankGroup {
  bankId: string
  bankName: string
  bankLogo: string | null
  bankColor: string | null
  total: number
  sourceCounts: SourceCounts
}

const props = defineProps<{
  groups: BankGroup[]
  selectedBankId: string
}>()
const emit = defineEmits<{ (e: 'update:selectedBankId', v: string): void }>()

const keyword = ref('')
const filtered = computed(() => {
  const k = keyword.value.trim()
  if (!k) return props.groups
  return props.groups.filter(g => g.bankName.includes(k))
})

function handlePick(id: string) {
  emit('update:selectedBankId', id)
}
</script>

<template>
  <aside class="bank-sidebar">
    <div class="search-row">
      <t-input v-model="keyword" placeholder="搜索银行" clearable size="small" />
    </div>
    <div class="bank-list">
      <BankItem
        v-for="g in filtered"
        :key="g.bankId"
        :bank-id="g.bankId"
        :bank-name="g.bankName"
        :bank-logo="g.bankLogo"
        :bank-color="g.bankColor"
        :total="g.total"
        :source-counts="g.sourceCounts"
        :selected="g.bankId === selectedBankId"
        @click="handlePick(g.bankId)"
      />
      <t-empty v-if="!filtered.length" size="small" description="无匹配银行" />
    </div>
  </aside>
</template>

<style scoped>
.bank-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.search-row { padding: 12px; border-bottom: 1px solid #e5e7eb; }
.bank-list { flex: 1; overflow-y: auto; }
</style>
```

- [ ] **Step 7.3: Commit**

```bash
git add src/pages/card-templates/components/BankItem.vue src/pages/card-templates/components/BankSidebar.vue
git commit -m "feat(admin-ui): add BankSidebar and BankItem components"
```

---

## Task 8: CardItem 组件

**Files:**
- Create: `src/pages/card-templates/components/CardItem.vue`

- [ ] **Step 8.1: 写 CardItem.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'

export interface CardItemData {
  id: number
  cardName: string
  cardLevelName: string | null
  cardOrganizationName: string | null
  cover: string | null
  isVisible: number   // 0 | 1
  dataSource: string  // 'flyert' | '51credit' | 'self'
}

defineProps<{ card: CardItemData }>()

const emit = defineEmits<{
  (e: 'toggle', id: number, next: 0 | 1): void
  (e: 'edit', id: number): void
}>()

const imgError = ref(false)

function onCardClick() {
  emit('edit', /* injected via template */ 0)
}
function onSwitchClick(card: CardItemData, e: MouseEvent) {
  e.stopPropagation()
  emit('toggle', card.id, card.isVisible === 1 ? 0 : 1)
}
</script>

<template>
  <div
    class="card-item"
    :class="{ hidden: card.isVisible === 0 }"
    @click="emit('edit', card.id)"
  >
    <img
      v-if="card.cover && !imgError"
      :src="card.cover"
      class="cover"
      :alt="card.cardName"
      @error="imgError = true"
    >
    <div v-else class="cover placeholder" />

    <div class="info">
      <div class="name" :title="card.cardName">{{ card.cardName }}</div>
      <div class="meta">
        {{ [card.cardLevelName, card.cardOrganizationName].filter(Boolean).join(' · ') || '—' }}
      </div>
    </div>

    <div
      class="switch"
      :class="{ on: card.isVisible === 1, off: card.isVisible === 0 }"
      :title="card.isVisible === 1 ? '点击隐藏（is_visible=0）' : '点击展示（is_visible=1）'"
      @click="onSwitchClick(card, $event)"
    >
      <div class="dot" />
    </div>
  </div>
</template>

<style scoped>
.card-item {
  position: relative;
  width: 380px;
  height: 120px;
  display: flex;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: opacity .15s, transform .15s;
}
.card-item:hover { transform: translateY(-1px); border-color: #cbd5e1; }
.card-item.hidden { opacity: .55; }
.cover {
  width: 190px;
  height: 120px;
  object-fit: cover;
  flex-shrink: 0;
  background: #0d1124;
}
.cover.placeholder { background: #e5e7eb; }
.info {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.name {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  color: #888;
  font-size: 12px;
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.switch {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
  cursor: pointer;
  transition: background .15s;
}
.switch.on { background: #16a34a; }
.switch.off { background: #cbd5e1; }
.switch .dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: margin .15s;
}
.switch.on .dot { margin-left: auto; }
.switch.off .dot { margin-left: 0; }
</style>
```

- [ ] **Step 8.2: Commit**

```bash
git add src/pages/card-templates/components/CardItem.vue
git commit -m "feat(admin-ui): add CardItem with cover-left layout and visibility switch"
```

---

## Task 9: CardGrid 组件

**Files:**
- Create: `src/pages/card-templates/components/CardGrid.vue`

- [ ] **Step 9.1: 写 CardGrid.vue**

```vue
<script setup lang="ts">
import CardItem, { type CardItemData } from './CardItem.vue'

defineProps<{
  bankName: string
  total: number
  cards: CardItemData[]
  loading: boolean
  keyword: string
}>()

const emit = defineEmits<{
  (e: 'update:keyword', v: string): void
  (e: 'toggle', id: number, next: 0 | 1): void
  (e: 'edit', id: number): void
}>()
</script>

<template>
  <section class="card-grid">
    <header class="toolbar">
      <span class="bank-name">{{ bankName || '— 请选择银行 —' }}</span>
      <span class="count">{{ total }} 张</span>
      <div class="search">
        <t-input
          :value="keyword"
          placeholder="搜索卡名"
          clearable
          size="small"
          style="width: 200px"
          @update:model-value="(v: string) => emit('update:keyword', v)"
        />
      </div>
    </header>
    <div class="body">
      <t-loading v-if="loading" size="small" />
      <t-empty v-else-if="!cards.length" description="该银行下暂无信用卡模板" />
      <div v-else class="grid">
        <CardItem
          v-for="card in cards"
          :key="card.id"
          :card="card"
          @toggle="(id, next) => emit('toggle', id, next)"
          @edit="(id) => emit('edit', id)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.card-grid { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fafafa; }
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.bank-name { font-size: 15px; font-weight: 600; }
.count { font-size: 12px; color: #888; }
.search { margin-left: auto; }
.body { flex: 1; overflow: auto; padding: 16px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 380px);
  gap: 14px;
  align-content: start;
  justify-content: start;
}
</style>
```

- [ ] **Step 9.2: Commit**

```bash
git add src/pages/card-templates/components/CardGrid.vue
git commit -m "feat(admin-ui): add CardGrid with auto-fill grid and toolbar"
```

---

## Task 10: 迁移 CardEditDialog

**Files:**
- Create: `src/pages/card-templates/components/CardEditDialog.vue`（从旧位置复制 + 微调）
- 删除: `src/components/card-templates/CardTemplateEditDialog.vue`（暂保留，Task 12 在确认全部链路通过后才删）

- [ ] **Step 10.1: 复制旧文件**

```bash
cp src/components/card-templates/CardTemplateEditDialog.vue \
   src/pages/card-templates/components/CardEditDialog.vue
```

- [ ] **Step 10.2: 检查 enhance-cover 判断逻辑（应已是 URL-based）**

打开新文件 `src/pages/card-templates/components/CardEditDialog.vue`，找到 `isExternalCover`（约第 60-65 行）。**当前已经是按 URL 判断的**：

```ts
const isExternalCover = computed(() => {
  const c = form.value.cover
  if (!c) return false
  return !c.includes('aliyuncs.com') && !c.includes('how2hao-static')
})
```

不需要改动，保留即可。spec 中的"按 URL 域判断"已经是现状。

- [ ] **Step 10.3: 验证组件名称导出**

确认文件首部是 `<script setup lang="ts">`（默认导出），无 `defineOptions({ name: '...' })`。如有，把 name 改成 `CardEditDialog`。

- [ ] **Step 10.4: Commit（保留旧文件）**

```bash
git add src/pages/card-templates/components/CardEditDialog.vue
git commit -m "refactor(admin-ui): copy CardTemplateEditDialog to new location as CardEditDialog"
```

---

## Task 11: 接通 credit.vue 端到端

**Files:**
- Modify: `src/pages/card-templates/credit.vue`

- [ ] **Step 11.1: 写完整 credit.vue**

整文件覆盖 `src/pages/card-templates/credit.vue`：

```vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import BankSidebar from './components/BankSidebar.vue'
import CardGrid from './components/CardGrid.vue'
import CardEditDialog from './components/CardEditDialog.vue'
import type { CardItemData } from './components/CardItem.vue'

interface BankGroup {
  bankId: string
  bankName: string
  bankLogo: string | null
  bankColor: string | null
  total: number
  sourceCounts: { flyert: number, '51credit': number, self: number }
}
interface ListResp {
  list: CardItemData[]
  total: number
  page: number
  pageSize: number
}
interface OptionsResp {
  banks: { label: string, value: number }[]
  cardOrganizations: { label: string, value: number }[]
  cardLevels: { label: string, value: number }[]
}

// ==== state ====
const groups = ref<BankGroup[]>([])
const selectedBankId = ref<string>('')
const cards = ref<CardItemData[]>([])
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const optionsRef = ref<OptionsResp>({ banks: [], cardOrganizations: [], cardLevels: [] })

const editingOpen = ref(false)
const editingId = ref<number | null>(null)

const selectedBank = computed(() =>
  groups.value.find(g => g.bankId === selectedBankId.value),
)

// ==== loaders ====
async function loadGroups() {
  const res = await requestJson<{ list: BankGroup[] }>('/api/cardTemplates/bank-groups')
  groups.value = res.list
  if (!selectedBankId.value && res.list.length) {
    selectedBankId.value = res.list[0].bankId   // 默认选总数最多那家（接口已按 total DESC 排序）
  }
}

async function loadOptions() {
  optionsRef.value = await requestJson<OptionsResp>('/api/cardTemplates/options')
}

async function loadCards() {
  if (!selectedBankId.value) return
  loading.value = true
  try {
    const params = new URLSearchParams({
      bankId: selectedBankId.value,
      keyword: keyword.value.trim(),
      page: '1',
      pageSize: '200',
    })
    const res = await requestJson<ListResp>(`/api/cardTemplates?${params.toString()}`)
    cards.value = res.list
    total.value = res.total
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '加载卡片列表失败')
  }
  finally {
    loading.value = false
  }
}

// ==== handlers ====
async function handleToggle(id: number, next: 0 | 1) {
  // 乐观更新
  const card = cards.value.find(c => c.id === id)
  const prev = card?.isVisible
  if (card) card.isVisible = next
  try {
    await requestJson(`/api/cardTemplates/${id}/visibility`, {
      method: 'PATCH',
      body: { is_visible: next },
    })
  }
  catch (e: any) {
    if (card && prev !== undefined) card.isVisible = prev
    MessagePlugin.error(e?.message ?? '切换显示失败')
  }
}

function handleEdit(id: number) {
  editingId.value = id
  editingOpen.value = true
}

async function handleSaved() {
  editingOpen.value = false
  // 重新拉当前银行卡片以同步编辑结果
  await loadCards()
}

// ==== effects ====
onMounted(async () => {
  await Promise.all([loadGroups(), loadOptions()])
  await loadCards()
})

watch(selectedBankId, () => {
  cards.value = []
  loadCards()
})

let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(loadCards, 300)
})
</script>

<template>
  <div class="page-credit">
    <BankSidebar
      v-model:selected-bank-id="selectedBankId"
      :groups="groups"
    />
    <CardGrid
      v-model:keyword="keyword"
      :bank-name="selectedBank?.bankName ?? ''"
      :total="total"
      :cards="cards"
      :loading="loading"
      @toggle="handleToggle"
      @edit="handleEdit"
    />
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
.page-credit {
  display: flex;
  height: calc(100vh - 64px);   /* 64 = t-header 高度，按现状目测 */
  overflow: hidden;
}
</style>
```

- [ ] **Step 11.2: 启动 dev server 端到端验证（手动）**

```bash
pnpm dev
```

打开 `http://localhost:3333/card-templates/credit`，逐项 check：

1. 左侧栏出现银行列表（按总数倒序），第一家自动选中（高亮）
2. 右侧显示该银行的卡片网格（auto-fill，封面 190×120 在左、信息在右）
3. 点击其它银行 → 右侧切换到该银行卡
4. 输入银行搜索关键字 → 左侧过滤
5. 输入右侧 keyword 搜卡名 → 300ms 防抖后右侧刷新
6. 隐藏的卡（is_visible=0，即 51credit 来源的卡）整张卡半透明
7. 点击 Switch → 切换 + 颜色变化（绿/灰）；刷新页面后状态保持
8. 点击卡片任意位置（除 Switch）→ 弹编辑对话框；改卡名后保存 → 该卡名称更新

- [ ] **Step 11.3: Commit**

```bash
git add src/pages/card-templates/credit.vue
git commit -m "feat(admin-ui): wire credit.vue end-to-end (sidebar + grid + edit + visibility)"
```

---

## Task 12: 删除旧文件

**Files:**
- Delete: `src/pages/card-templates/index.vue`
- Delete: `src/components/card-templates/CardTemplateEditDialog.vue`
- Delete: `src/components/card-templates/`（如果整目录空）

- [ ] **Step 12.1: 确认旧 dialog 不再被引用**

```bash
grep -rn "components/card-templates/CardTemplateEditDialog" /Users/wyhnotwhy/Documents/Kuaishou/How2hao/how-admin/src/
```

期望：没有匹配（除了被删的 `pages/card-templates/index.vue`）。

- [ ] **Step 12.2: 删除文件**

```bash
git rm src/pages/card-templates/index.vue
git rm src/components/card-templates/CardTemplateEditDialog.vue
# 如果目录已空：
rmdir src/components/card-templates 2>/dev/null || true
```

- [ ] **Step 12.3: 重启 dev server，再次 check 路由 + 链路**

```bash
pnpm dev
```

- 访问 `/card-templates` → 应仍能进入（vue-router auto routing 在没有 index.vue 时会怎么处理？需要验证）

> **可能的问题：** auto routing 删除 `index.vue` 后 `/card-templates` 直接 404。如果出现 404，加回一个 `index.vue` 内容仅做 redirect（沿用 Task 6.4 的写法）。

- [ ] **Step 12.4: 如果 /card-templates 直接 404，恢复 redirect index.vue**

只在 Step 12.3 验证发现 404 时执行。新建 `src/pages/card-templates/index.vue`：

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
router.replace('/card-templates/credit')
</script>

<template>
  <div />
</template>
```

`git add` 回。

- [ ] **Step 12.5: Commit**

```bash
git add -A src/pages/card-templates/ src/components/
git commit -m "chore(admin-ui): remove legacy card-templates index page and dialog"
```

---

## Task 13: 端到端验证清单 & PR

- [ ] **Step 13.1: 跑 typecheck + lint**

```bash
pnpm typecheck   # 期望：无 error
pnpm lint        # 如果 ESLint 因 Node 版本问题加载失败，提示用户在 Node 21+ 环境下跑
```

- [ ] **Step 13.2: 完整手动 E2E 走查**

| # | 用例 | 期望 |
|---|---|---|
| 1 | 侧边栏菜单 | "卡片模板管理"展示为可展开二级，icon `purchase` |
| 2 | 二级菜单 | 信用卡管理（icon `credit-card`）/ 借记卡管理（icon `money`），各自路由 |
| 3 | 旧 URL `/card-templates` | 自动跳到 `/card-templates/credit` |
| 4 | 借记卡管理页 | 显示 t-empty "借记卡管理 · 待实现" |
| 5 | 信用卡管理初始 | 左栏银行按总数倒序；第一家高亮选中；右栏自动加载该银行卡 |
| 6 | 切换银行 | 右栏更新；keyword 输入框可清空 |
| 7 | 银行搜索 | 输入"招商" → 左栏只剩匹配项 |
| 8 | 卡名搜索 | 输入"Hello Kitty" → 右栏 300ms 后过滤 |
| 9 | 隐藏卡视觉 | is_visible=0 的卡整张 55% 透明、Switch 灰色 |
| 10 | Switch 切换 | 点 Switch → 颜色变；刷新页面状态保持；DB 中 is_visible 字段已更新 |
| 11 | 编辑弹窗 | 点卡片（非 Switch）→ 弹窗打开，预填字段；改卡名保存后右侧更新 |
| 12 | enhance-cover | 编辑弹窗中 cover URL 是 51credit 域时显示"高清化"按钮；是 oss-cn-beijing 域时不显示 |
| 13 | 长卡名 | 招行瑞丽联名卡(银联+VISA…) 名称两行省略 + tooltip 显示完整 |
| 14 | 封面加载失败 | 故意改 cover 字段为无效 URL → 卡片显示灰块占位 |

- [ ] **Step 13.3: DB 复核**

```sql
-- 1. 字段存在
DESCRIBE bank_card_template;
-- 应包含 is_visible TINYINT(1) NOT NULL DEFAULT 1

-- 2. 回填正确（同 Task 1.4）
SELECT data_source, COUNT(*) AS total, SUM(is_visible) AS visible
FROM bank_card_template GROUP BY data_source;

-- 3. ha 业务查询不受影响
SELECT COUNT(*) FROM bank_card_template WHERE data_source='flyert';
-- 与迁移前同值
```

- [ ] **Step 13.4: 推分支 + 开 PR**

```bash
git push -u origin wyh/dev-20260508
# 然后 GitHub 上发起 PR 到 main，描述要点：
#   - 目标 / 范围（admin-only，hi 不动）
#   - DB migration 内容（is_visible + 回填）
#   - 前端布局新形态（贴 v10 截图或 mockup 链接）
#   - 已知 deferred：C 端切换 is_visible 留下一个 PR
```

---

## 显式不在范围内（重申）

- ha（C 端）调用的 how-api `/bank_card_template/...` 接口及 hi 的 TypeORM 实体本次完全不动
- 借记卡完整 CRUD（创建/删除/编辑接口与页面，本次仅占位）
- 自建来源的"+ 新建"按钮（'self' 仅作为白名单值预留，不开放手动创建入口）
- 旧 approve 接口的外部调用方排查（仅清理 admin 自身使用，外部由各方自己迁移）

## Self-Review 备注（计划写完后自检）

- ✅ Task 1 覆盖 spec §4-5（migration + 回填）
- ✅ Task 2 覆盖 spec §5 bank-groups
- ✅ Task 3 覆盖 spec §5 visibility patch
- ✅ Task 4 覆盖 spec §5 list/detail 字段扩展
- ✅ Task 5 覆盖 spec §5 approve 删除
- ✅ Task 6 覆盖 spec §3 路由 + 占位 + redirect 兼容
- ✅ Task 7-9 覆盖 spec §7 组件结构 + §8 视觉规格
- ✅ Task 10-11 覆盖 spec §6 数据流 + CardEditDialog 迁移 + enhance-cover 判断
- ✅ Task 12 覆盖 spec §7 旧文件清理
- ✅ Task 13 覆盖 spec §10 测试与验证 + §11 范围之外提醒
- 类型一致：CardItemData 接口在 CardItem.vue 定义并被 CardGrid / credit.vue 复用
- bank-groups 返回类型在 BankGroup interface 定义并跨组件一致
