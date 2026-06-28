# job_template（任务模板）后台建模设计

> 日期：2026-06-01 · 范围：仅 how-admin（drizzle 表 + 迁移 + 后台 CRUD）

## 1. 背景与定位

现有 `task_template` 表名为"任务模板"，但其内容实际是**活动模板**（银行卡优惠活动：银行/卡/权益/档位/规则/地区 + 自带提醒档期），属历史命名问题。

本设计新增一张**真正独立的任务模板表 `job_template`**，用于沉淀一类**可复用的周期性前置/通用任务**，典型场景：刷卡前置任务。

它与"活动"是**间接关联**：一条 `job_template` 可挂到三个维度的主体上——活动（现 `task_template`）、模板银行卡（`bank_card_template`）、银行（`bank`）。例如"本自然月刷满 5 笔"既可作为某活动的前置门槛，也可作为某张卡 / 某家银行的通用任务。

### 关键特征
- **无提醒时刻**（不同于活动自带的"周三 10:00 提醒"）。
- **按周期循环**（如月维度）：整个周期内任务都"存在/可见"，周期结束后下个周期重建一个新实例。
- **支持多档位**（如"刷 5 笔一档 / 刷 10 笔一档"），档位条件支持金额、笔数及其"且/或"逻辑。

> 周期生成 / 跨周期重建属于 **C 端运行时逻辑，本期不实现**。本期只把模板"沉淀"出来并能在后台维护。

## 2. 范围边界

**本期做（仅 how-admin）：**
- `job_template` 表的 drizzle schema 定义 + 手写 SQL 迁移
- 后台 Nitro CRUD API
- 后台前端列表 + 新建/编辑页面 + 菜单入口

**本期明确不做：**
- how-api 下发、ha（C 端）UI
- 用户把 job 添加为任务、按周期生成实例 / 过期重建
- 银行层级通用任务的"谁能看到"可见性规则
- 删除活动模板（`task_template`）的任何冗余字段——**一个不删**

## 3. 数据模型

新表 `job_template`，列与索引设计对齐现有 `task_template` 的工程约定（`admin_user_id` 默认 1、`is_visible` 默认 0、`created_at` 为 bigint、`updated_at` 为 datetime）。

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | int | PK auto | |
| `title` | varchar(200) | NOT NULL | 任务名，如"本月刷满 5 笔" |
| `repeat_type` | enum(`ONE_TIME`/`DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY`) | NOT NULL default `ONE_TIME` | 周期维度。**无 reminder_time**。沿用现有表完整 5 值枚举 |
| `start_date` | bigint | NULL | 模板整体有效期起（epoch ms） |
| `end_date` | bigint | NULL | 模板整体有效期止（epoch ms） |
| `tiers` | json | NOT NULL | 档位数组，≥1 个元素；`length > 1` = 多档 |
| `task_template_id` | int | NULL | 维度①：关联活动（现 `task_template.id`） |
| `bank_id` | int | NULL | 维度②：关联银行（`bank.id`） |
| `bank_card_template_id` | int | NULL | 维度③：关联模板银行卡（`bank_card_template.id`） |
| `admin_user_id` | int | NOT NULL default 1 | 创建/维护者，指向 `admin_user.id` |
| `is_visible` | tinyint | NOT NULL default 0 | |
| `created_at` | bigint | NOT NULL | epoch ms |
| `updated_at` | datetime | NOT NULL default CURRENT_TIMESTAMP | |

### tiers 元素形状

```ts
tiers: {
  minAmount: number | null    // 刷卡金额门槛
  minCount: number | null     // 刷卡笔数门槛
  logic: 'AND' | 'OR'         // 金额与笔数的关系：且 / 或
  description: string | null  // 该档说明
}[]
```

> tiers 为 JSON，后续按需扩字段（如周期内配额、达成奖励、外链），无需改表。

### 维度关联说明
- 三个维度 FK 均可空，且**可同时填多个**（如"招行 + 某活动"才挂该任务）。
- **不加物理外键约束**，仅作逻辑外键 + 索引，对齐现有表风格。
- 为三个维度与 `admin_user_id` 各建一个索引，便于"查某银行 / 某卡 / 某活动下挂的全部任务"。

索引：
- `idx_job_template_admin_user` (`admin_user_id`)
- `idx_job_template_task_template` (`task_template_id`)
- `idx_job_template_bank` (`bank_id`)
- `idx_job_template_card` (`bank_card_template_id`)

## 4. 迁移

- 新增 `drizzle/manual/0011_job_template.sql`：`CREATE TABLE job_template ...`（含上述列与索引）。
- 在 `drizzle/schema.ts` 中新增 `jobTemplate` 表定义（含 `tiers` 的 `$type<...>` 标注）。

## 5. 后台 API（Nitro）

新目录 `server/api/jobTemplates/`，对齐 `server/api/bankCardActivities/taskTemplates/` 既有模式：

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `index.get.ts` | GET | 分页列表；支持 keyword（title 模糊）/ bankId / taskTemplateId / bankCardTemplateId 过滤；leftJoin `bank` 等取展示名 |
| `index.post.ts` | POST | 新建；`admin_user_id` 取当前登录 admin |
| `[id].get.ts` | GET | 详情 |
| `[id].put.ts` | PUT | 编辑 |
| `[id].delete.ts` | DELETE | 删除 |
| `[id]/visibility.put.ts` | PUT | 切换 `is_visible`（对齐 taskTemplates 既有模式） |

## 6. 后台前端

- 新页面 `src/pages/job-templates/index.vue`：列表 + 新建/编辑弹层；弹层含
  - `title`、`repeat_type`、`start_date`/`end_date`
  - **tiers 多档编辑器**（每档：金额、笔数、AND/OR、说明；可增删档）
  - 三维度选择器（活动 / 银行 / 模板银行卡，均可选/可空）
  - `is_visible` 开关
- `App.vue` 顶层菜单新增 `/job-templates` 入口。
- 类型定义 `src/types/jobTemplates.ts`。

## 7. 验收

- 迁移可执行，`job_template` 表按设计建出。
- 后台能新建 / 编辑 / 删除 / 列表 / 切可见性一条任务模板。
- 能为一条任务模板填写多档 tiers，并分别挂上活动 / 银行 / 模板卡三个维度（含同时多个、全空）。
- 不触碰 how-api / ha / 活动模板既有字段。
