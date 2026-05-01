# 使用平台管理页 — 设计文档

**日期**: 2026-05-02  
**状态**: 已批准

---

## 背景

`benefit_usage_platform` 表已存在，存储使用平台（如支付宝、微信支付等）的基础信息，包含 `code`、`name`、`icon`、`sortOrder`。目前没有对应的后台管理页，需要新建一套增 + 改界面。

---

## 范围

- **新增平台**：填写 code / name / sortOrder，可选上传图标
- **编辑平台**：修改上述字段，支持更换图标
- **不做删除**（平台数据被关联引用，删除有风险）

---

## 数据模型（已有表，无需迁移）

```
benefit_usage_platform
  id         INT AUTO_INCREMENT PK
  code       VARCHAR(50) UNIQUE NOT NULL   -- 机器可读标识，如 alipay
  name       VARCHAR(50) NOT NULL          -- 展示名，如 支付宝
  icon       VARCHAR(255)                  -- OSS 公开 URL
  sortOrder  INT DEFAULT 0
  createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## 数据流

### 新增

1. 前端：用户填写表单，可选选取图片文件
2. 前端：FileReader 读取图片为 base64，本地预览
3. 前端：点"保存" → `POST /api/usagePlatforms` body: `{ code, name, sortOrder, iconBase64? }`
4. 后端：`INSERT` 记录，拿到自增 `id`
5. 后端：若 iconBase64 非空 → 上传 `usage_platform/{id}.png` 到 OSS → `UPDATE icon = url`
6. 后端：返回完整记录，前端刷新列表

### 编辑

1. 前端：点"编辑" → 弹窗加载当前记录，显示现有图标
2. 前端：用户可修改字段，可点"更换图片"触发 file input 选新图
3. 前端：点"保存" → `PUT /api/usagePlatforms/:id` body: `{ code, name, sortOrder, iconBase64? }`
4. 后端：`UPDATE` 文字字段；若 iconBase64 非空（`undefined` / `''` / `null` 均视为不更新）→ 上传（覆盖原文件）→ `UPDATE icon = url`
5. 后端：返回更新后记录，前端刷新列表

---

## API

### `GET /api/usagePlatforms`

返回全量列表（平台数量少，不分页）：

```json
{
  "list": [
    { "id": 1, "code": "alipay", "name": "支付宝", "icon": "https://...", "sortOrder": 0, "createdAt": "2026-01-01 00:00:00" }
  ]
}
```

### `POST /api/usagePlatforms`

Request body:
```json
{ "code": "alipay", "name": "支付宝", "sortOrder": 0, "iconBase64": "data:image/png;base64,..." }
```

Response: 完整记录（含 id、icon URL）

### `PUT /api/usagePlatforms/:id`

Request body: 同上（iconBase64 为空则不更新图标）

Response: 更新后完整记录

---

## OSS 工具

在 `server/utils/ossClient.ts` 新增：

```ts
async function uploadUsagePlatformIcon(id: number, buf: Buffer): Promise<string>
```

- 上传路径：`usage_platform/{id}.png`
- Content-Type: `image/png`
- Cache-Control: `public, max-age=2592000`
- 返回公开 URL

---

## 前端文件

### `src/pages/usage-platforms/index.vue`

- `t-card` 标题"使用平台管理"
- 顶部右侧"新增平台"按钮
- `t-table` 列：图标（60px 正方形）、名称、code、排序、创建时间、操作（编辑）
- 无分页（数据量小）
- 编辑按钮打开 `UsagePlatformDialog`，新增按钮也打开同一个弹窗（editingId 为 null 表示新增）

### `src/components/usage-platforms/UsagePlatformDialog.vue`

Props: `visible: boolean`, `platformId: number | null`  
Emits: `update:visible`, `saved`

表单字段：
| 字段 | 组件 | 校验 |
|------|------|------|
| code | `t-input` | 必填，长度 ≤ 50 |
| name | `t-input` | 必填，长度 ≤ 50 |
| sortOrder | `t-input-number` | 默认 0 |
| 图标 | 点击区域触发 file input | 可选，选后本地预览 |

图标交互：
- 新增时：空白占位区 + "点击上传"提示
- 编辑时：展示当前图标，右下角"更换"按钮
- 选图后：显示本地预览（base64）覆盖旧预览

---

## 导航

`src/app.vue` 新增顶层菜单项：

```html
<t-menu-item value="/usage-platforms" to="/usage-platforms">
  <template #icon><div i-carbon:application mr-3 /></template>
  使用平台
</t-menu-item>
```

位置：插在"卡片模板"之后。

---

## 错误处理

- code 重复：后端捕获 unique 约束错误，返回 409 + 提示"code 已存在"
- 图片过大（>5MB）：前端在 FileReader 读取后检查 file.size，超限提示不提交
- OSS 上传失败：后端返回 500，前端 `MessagePlugin.error` 提示
