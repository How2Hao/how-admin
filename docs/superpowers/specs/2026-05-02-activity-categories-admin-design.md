# 活动分类管理页面设计

**日期：** 2026-05-02  
**范围：** how-admin 新增活动分类 CRUD 页面

## 需求

在 admin 后台新增活动分类管理页面，风格参考使用平台页面，支持两级层级（parent → children），图片上传至 OSS `activity_category/{id}.png`。不需要删除功能。

## 数据模型

`activity_category` 表（已存在）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int autoincrement | 主键 |
| code | varchar(32) unique | 唯一标识 |
| name | varchar(50) | 显示名称 |
| parentId | int nullable | null = 顶级分类 |
| icon | varchar(255) | OSS 图片 URL |
| sortOrder | int default 0 | 排序权重 |
| createdAt | bigint | 创建时间戳 |

## 架构方案

**方案 A（选定）：前端组树 + TDesign tree table**

后端返回扁平列表，前端按 `parentId` 分组组装两级树，传给 `t-table` 的 `tree.childrenKey`。

## 新增文件

| 文件 | 说明 |
|------|------|
| `src/pages/activity-categories/index.vue` | 页面：树形表格 + 新增按钮 |
| `src/components/activity-categories/ActivityCategoryDialog.vue` | 新增/编辑弹窗 |
| `server/api/activityCategories/index.get.ts` | GET 扁平列表 |
| `server/api/activityCategories/index.post.ts` | POST 新增，写后 invalidate 缓存 |
| `server/api/activityCategories/[id].put.ts` | PUT 编辑，写后 invalidate 缓存 |

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/App.vue` | 侧栏在"使用平台"下方加"活动分类"菜单项 |

## 前端设计

### 页面（index.vue）

- `t-table` 启用 `tree` 模式，`childrenKey: 'children'`，默认展开所有父节点
- 列：图标、名称、Code、排序、父分类（顶级显示"—"）、创建时间、操作（编辑按钮）
- 顶部"新增分类"按钮打开 dialog，`editingId = null`

### 前端组树逻辑

```
flat list → parents（parentId === null） + children map（parentId → rows[]）
parents.forEach(p => p.children = childrenMap[p.id] ?? [])
```

### 弹窗（ActivityCategoryDialog.vue）

表单字段：
- **Code**（必填，maxlength 32）
- **名称**（必填，maxlength 50）
- **父分类**（下拉，仅列出顶级分类；留空 = 顶级）
- **排序**（数字输入，默认 0）
- **图标**（点击上传，base64 传后端，≤ 5MB）

编辑时：打开前调用 `GET /api/activityCategories` 取当前行数据回填（同 UsagePlatformDialog 模式）。

父分类下拉：只展示 `parentId === null` 的行，防止创建超过两级的层级。

## 后端设计

### GET /api/activityCategories

返回 `{ list: Row[] }`，按 `sortOrder ASC, id ASC` 排序，字段：`id, code, name, parentId, icon, sortOrder, createdAt`。

### POST /api/activityCategories

Payload: `{ code, name, parentId?, sortOrder?, iconBase64? }`  
验证：code/name 非空；若提供 parentId 则校验目标行存在且其 parentId 为 null（防止三级）。  
写入 DB → 上传图标（若有）→ `referenceData.invalidate()` → 返回新行。

### PUT /api/activityCategories/:id

Payload: 同 POST（所有字段可选）。  
同样校验 parentId 合法性（不能指向自身，不能指向子分类）。  
更新 DB → 上传图标（若有）→ `referenceData.invalidate()` → 返回更新后行。

## 图片上传

OSS 路径：`activity_category/{id}.png`，复用 `uploadFile` 工具，限 5MB，同 usage_platform 模式。

## 缓存失效

POST 和 PUT 成功后调用 `referenceData.invalidate()`，确保下次解析模板时使用最新分类数据。
