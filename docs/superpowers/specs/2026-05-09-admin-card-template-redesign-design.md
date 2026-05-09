# Admin 卡片模板管理重构 · 设计文档

**日期**：2026-05-09
**作用范围**：how-admin（前端 + 内置 Nitro 后端 + drizzle schema/migration）。how-api（hi）只服务 ha（C 端），本次**完全不动**；不动 ha。
**关联记忆**：`project_card_template_visibility`（is_visible 迁移规则）。

---

## 1. 背景与现状

how-admin 的"卡片模板管理"现状：
- 侧边栏一级菜单 `/card-templates` → `pages/card-templates/index.vue`，t-table 7 列展示
- 页内顶部按 `data_source = '51credit' | 'flyert'` 切两个 tab（"待处理 / 用户可见"）；过滤 `card_type='1'`
- 旧操作：编辑（CardTemplateEditDialog）、审核通过（仅 51credit 卡）、上传/增强封面

**关键架构事实**：
- how-admin 自带 **Nitro 后端**，用 **drizzle ORM** 直接查同一个 MySQL；admin 前端 `/api/cardTemplates/...` 由 `how-admin/server/api/cardTemplates/*.ts` 提供，**不经过 how-api**
- drizzle schema 在 `how-admin/drizzle/schema.ts`；手写 migration 在 `how-admin/drizzle/manual/000N_xxx.sql`，已有 0002-0005，本次新增 0006
- how-api（hi）只服务 ha（C 端），与 admin 互不调用；admin 任何后端/schema 改动都封闭在 how-admin 仓库内，**不动 hi**
- 现状字段：`alias` 在 drizzle schema 里**已存在**；`is_visible` 不存在；`data_source` 默认 `'51credit'`，仅 `'51credit' | 'flyert'` 两值

C 端（ha）当前查询条件 `where data_source = 'flyert'`，本次不动；hi 那边 TypeORM 实体也保持不变。

**为什么加列不会让 hi 挂掉**：
- `how-api/src/config/config.default.ts` 里 `synchronize: false`，启动不会基于 entity ↔ DB 差异自动 ALTER/DROP
- TypeORM 的 SELECT 用实体显式列名，多出来的 `is_visible` 不查不返、也不报错
- 新列 `NOT NULL DEFAULT 1`，即便有 INSERT 也由 MySQL 填默认值（grep 显示 hi 对这张表没有写入路径，是只读消费）
- ha 业务查询仍按 `data_source='flyert'` 过滤，迁移后 flyert 行的 is_visible 全为 1，结果集不变

等 ha 需要按 is_visible 过滤时，由后续 PR 同步 hi 实体并切查询条件。

## 2. 目标

1. "卡片模板管理"从一级菜单升为带子项的二级菜单（信用卡管理 / 借记卡管理）。
2. 信用卡管理页整体重构：左侧银行分组 + 右侧卡片网格 + 单卡 Switch。
3. 引入 `is_visible` 字段（卡片粒度）+ 数据回填。
4. 引入 `'self'` 来源枚举值（仅扩展白名单，不实现创建接口）。
5. 借记卡管理：仅占位空页（路由 + 菜单 + "待实现"提示）。
6. 不动 C 端查询逻辑。

## 3. 路由 & 菜单

**菜单**（`how-admin/src/App.vue` 第 93 行附近）—— 把 `t-menu-item value="/card-templates"` 替换为：

```vue
<t-submenu value="/card-templates">
  <template #icon><div i-carbon:purchase mr-3 /></template>
  <template #title>卡片模板管理</template>
  <t-menu-item value="/card-templates/credit" to="/card-templates/credit">
    <template #icon><div i-carbon:credit-card mr-2 /></template>
    信用卡管理
  </t-menu-item>
  <t-menu-item value="/card-templates/debit" to="/card-templates/debit">
    <template #icon><div i-carbon:money mr-2 /></template>
    借记卡管理
  </t-menu-item>
</t-submenu>
```

**Icon 取舍**：一级避开已用的 `wallet`（支付平台）/ `bank`（银行管理）/ `credit-card`（让给信用卡子项），选 `purchase`。

**路由 & 文件**：
- `/card-templates` → `redirect: '/card-templates/credit'`（兼容旧 URL）
- `/card-templates/credit` → `pages/card-templates/credit.vue`（重构后的信用卡管理）
- `/card-templates/debit` → `pages/card-templates/debit.vue`（占位空状态页）
- 旧 `pages/card-templates/index.vue` 删除

## 4. 数据库改动（how-admin/drizzle）

新建 migration `how-admin/drizzle/manual/0006_card_template_is_visible.sql`：

```sql
-- 0006_card_template_is_visible.sql
ALTER TABLE `bank_card_template`
  ADD COLUMN `is_visible` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否对外展示' AFTER `cover`;

-- 回填：51credit 来源默认隐藏，flyert 默认可见（迁移前所有 C 端展示均按 data_source='flyert' 过滤）
UPDATE `bank_card_template` SET `is_visible` = 0 WHERE `data_source` = '51credit';
UPDATE `bank_card_template` SET `is_visible` = 1 WHERE `data_source` = 'flyert';
```

同步更新 `how-admin/drizzle/schema.ts` 的 `bankCardTemplate`：在 `cover` 后插入

```ts
isVisible: tinyint('is_visible').default(1).notNull(),
```

> alias 已存在，不动；how-api/src/entity 一律不动（hi 仅服务 ha）。

## 5. Nitro 后端改动（how-admin/server/api/cardTemplates）

| 文件 | 动作 | 用途 |
|---|---|---|
| `bank-groups.get.ts` | **新增** | 左侧栏数据：按 bank 聚合 credit 卡，返回 `{bankId, bankName, logoUrl, color, total, sourceCounts}`，仅 `card_type='1'`；不带 is_visible 过滤 |
| `[id]/visibility.patch.ts` | **新增** | body `{is_visible: 0\|1}`；`UPDATE bank_card_template SET is_visible=?, updated_at=? WHERE id=?`；返回更新后的记录 |
| `index.get.ts` | **改** | 返回字段加 `isVisible`；不再依赖 `dataSource` 做隐式过滤；`card_type='1'` 仍硬编码（信用卡页专用） |
| `[id].get.ts` | **改** | 返回字段加 `isVisible` |
| `[id].put.ts` | **改** | `passthrough` 白名单加入 `dataSource` 校验 `['51credit','flyert','self']`（防误传） |
| `options.get.ts` | 不动 | banks/levels/organizations 下拉选项 |
| `enhance-cover.post.ts` / `[id]/upload-cover.post.ts` | 不动后端逻辑 | 前端按封面 URL 域判断是否显示按钮（见 §8） |
| `[id]/approve.post.ts` | **删除** | "审核通过"语义被 Switch 取代；前端不再调用，handler 一并清理 |

## 6. 数据流

挂载 `credit.vue`：
1. `GET /api/cardTemplates/bank-groups` → 渲染左侧；默认选中"总数最多"那家银行
2. `GET /api/cardTemplates?bankId={id}&keyword={kw}&page=1&pageSize=200` → 渲染右侧卡片
3. Switch 点击 → 乐观更新（先翻 UI）→ `PATCH /api/cardTemplates/{id}/visibility` → 失败回滚 + `MessagePlugin.error`
4. 编辑弹窗保存 → `PUT /api/cardTemplates/{id}` → 成功后局部更新该卡 + 关闭弹窗
5. enhance-cover：弹窗内若 `cover` URL 不以 `https://how2hao-static.oss-cn-beijing.aliyuncs.com` 开头则显示"下载并上传到 OSS"按钮（替代旧的"按 51credit 来源判断"）

切换银行 / 关键词搜索 / 翻页 → 重新拉 list。

## 7. 前端组件结构

```
pages/card-templates/
├── credit.vue                  # 信用卡管理（容器 + 状态）
├── debit.vue                   # 借记卡管理占位页（t-empty + "待实现"）
└── components/
    ├── BankSidebar.vue         # 左侧栏（搜索 + 银行列表）
    ├── BankItem.vue            # 单个银行项（logo + 名 + 总数 + 来源 chip）
    ├── CardGrid.vue            # 右侧 grid 容器（顶部工具栏 + auto-fill grid）
    ├── CardItem.vue            # 单卡（封面左 + 信息右 + Switch 浮右上）
    └── CardEditDialog.vue      # 迁移自 src/components/card-templates/CardTemplateEditDialog.vue
```

`credit.vue` 组合：

```vue
<BankSidebar v-model:selectedBankId="bankId" :groups @search="onBankSearch" />
<CardGrid :bankId :keyword v-model:keyword="keyword" :cards :loading>
  <CardItem v-for="card in cards" :key="card.id" :card
            @toggle="onToggleVisibility" @edit="onEdit" />
</CardGrid>
<CardEditDialog v-model:open="editingOpen" :card="editingCard" @saved="onSaved" />
```

旧 `src/components/card-templates/CardTemplateEditDialog.vue` 移到 `pages/card-templates/components/CardEditDialog.vue`，去掉旧目录。

## 8. 视觉规格（参考确认通过的 v10 mockup）

**整体**：左 320px 固定 + 右 flex；高度占满 viewport。

**左侧 BankSidebar**：
- 顶部 12px padding + 搜索框 28px 高（搜银行名）
- 单个银行项 padding 10/14；选中：左边 3px 蓝条 + `#eef4ff` 背景
- logo 36×36 contain；银行名 15px；右上总数 11px 灰
- 三个来源 chip 11px：飞客 蓝（`#dbeafe / #1e40af`）/ 51 黄（`#fef3c7 / #92400e`）/ 自建 绿（`#dcfce7 / #166534`）；数量为 0 时改用灰底 `#f3f4f6 / #888`

**右侧 CardGrid**：
- 顶部工具栏 padding 12/16：`{银行名} · {总张数} · 右侧 keyword 搜索框 200px`
- 卡片网格：`grid-template-columns: repeat(auto-fill, 380px)`，gap 14，padding 16，背景 `#fafafa`

**CardItem**：
- 容器 `position:relative; width:380px; height:120px; border-radius:10px; overflow:hidden; cursor:pointer; display:flex; background:#fff; border:1px solid #e5e7eb`
- 封面 `<img>` `width:190px; height:120px; object-fit:cover`（贴满左边，无内边距），`onerror` 兜底为占位灰块
- 信息区 padding `14px 16px`，flex-column 垂直居中
  - 卡名 14px font-weight 600 行高 1.35，最多 2 行 `-webkit-line-clamp:2` 省略；hover tooltip 显示完整名
  - meta 12px `#888` 上方 6px：`{cardLevelName} · {cardOrganizationName}`，单行省略
- Switch 绝对定位 `top:8px; right:8px; 36×20 圆角 10`，开 `#16a34a` 关 `#cbd5e1`，`box-shadow:0 1px 3px rgba(0,0,0,.2)`
- `is_visible=0` 整卡 `opacity:.55`
- 点卡片任意位置（除 Switch 区域）→ 打开 CardEditDialog

## 9. 错误处理 & 边界

- bank-groups 返空：左侧 t-empty，右侧不渲染
- 选中银行下没有卡：右侧 t-empty "该银行下暂无信用卡模板"
- Switch 接口 4xx/5xx：UI 回滚 + `MessagePlugin.error`
- 封面图片加载失败：`<img onerror>` 兜底灰块
- 长卡名（如"招商瑞丽联名卡(银联+VISA，人民币+美元，金卡)"）：2 行 line-clamp 省略 + tooltip
- 编辑弹窗 alias 为空字符串 → 后端入库 NULL（前端 trim 后空字符串映射 null）

## 10. 测试与验证

- **单测**（如已有 vitest 配置）：bank-groups 聚合在不同 source 组合下计数正确
- **DB 验证**：migration 后跑 `SELECT data_source, COUNT(*), SUM(is_visible) FROM bank_card_template GROUP BY data_source`，应满足：51credit 行 SUM=0、flyert 行 SUM=count
- **手动 E2E**：
  - 菜单展开看到二级；点击两个子项路由切换正常
  - 旧 URL `/card-templates` 重定向到 `/card-templates/credit`
  - 选不同银行右侧切换；keyword 搜索正确
  - Switch 切后刷新页面状态保持
  - 编辑弹窗保存后卡名/别名/封面更新
  - 隐藏的卡（is_visible=0）整卡半透明
  - 借记卡管理页显示"待实现"占位
  - enhance-cover 按钮：cover URL 是 51credit 域时显示，是 oss-cn-beijing 域时不显示

## 11. 显式不在范围内

- ha（C 端）+ how-api（hi）侧**完全不动**：hi 的 TypeORM 实体、controller、查询过滤都保持原样，仍 `data_source='flyert'`；切换到 `is_visible=1` 留作后续独立 PR（届时同步 hi 实体加 is_visible）
- 借记卡完整 CRUD（创建/删除/编辑接口与页面）
- 自建来源的"+ 新建"按钮（admin 不加创建入口；'self' 仅作为白名单值预留）
- 旧 `POST /api/cardTemplates/[id]/approve` 调用方排查（admin 自身用了，本次清理；如果有其他系统调，由那边自己迁移）

## 12. 实施顺序建议

1. **DB & schema**：写 0006 migration + 同步 drizzle schema；本地 DB 跑一遍验证 SUM 与 count 关系（不动 how-api 实体）
2. **Nitro endpoints**：新增 `bank-groups.get.ts` + `[id]/visibility.patch.ts`；改 `index.get.ts` / `[id].get.ts` / `[id].put.ts` 返回/接收字段；删 `[id]/approve.post.ts`
3. **前端组件骨架**：搭 BankSidebar / BankItem / CardGrid / CardItem，先用 mock 数据
4. **接通真实接口** + 联调 `credit.vue`
5. **迁移 CardEditDialog** 到新位置，调整 enhance-cover 按钮显示判断
6. **占位 debit.vue** + 路由 + 菜单
7. 端到端走查 + DB 验证 + PR

---

## 附：用户已确认的关键决策清单

- 导航：侧边栏二级菜单（不是 tab）
- is_visible 字段位置：bank_card_template 上新增（不是复用 bank.is_visible）
- 借记卡数据：复用 bank_card_template，card_type='2'（不是新建表）
- 来源枚举：新增 `'self'`（admin 手动卡未来用）
- 范围：信用卡完整重构，借记卡只占位
- 数据迁移：51credit→0、flyert→1
- C 端：本次不切，后续 PR
- 写操作：Switch 卡外（必选）+ 编辑保留弹窗 + enhance-cover 按 URL 域判断（不按来源）；不要"+ 新建"，不保留 approve
- 左侧计数口径：该银行下所有卡（不论 is_visible），按来源拆分
- icon：一级 `purchase` / 信用卡 `credit-card` / 借记卡 `money`
- 视觉：v10 mockup（封面 190×120 贴满左边 + 信息右垂直居中两行 + Switch 右上浮标 + 隐藏卡 55% 透明）
