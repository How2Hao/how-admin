<script setup lang="ts">
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next'
import type {
  CreateTaskTemplateResponse,
  TaskTemplateDetailResponse,
  TaskTemplateListItem,
  TaskTemplateListResponse,
  UpdateTaskTemplateResponse,
} from '@/types/bankCardActivities'
import { MessagePlugin } from 'tdesign-vue-next'
import { ensureCurrentOption, useBankCardActivityForm } from '@/composables/useBankCardActivityForm'
import { useBankCardActivityReferenceData } from '@/composables/useBankCardActivityReferenceData'
import { fetchCouponCategoryTree } from '@/composables/useCouponCategories'
import { requestJson } from '@/composables/useJsonRequest'

interface BankTab { id: number, name: string, logo: string | null, count: number }
interface TierRow {
  sortIndex: number
  minAmount: number | null
  benefitAmountFixed: number | null
  benefitAmountMin: number | null
  benefitAmountMax: number | null
  benefitDescription: string | null
  quotaPerCycleText: string | null
  quotaTotalText: string | null
}

const keyword = ref('')
const keywordInput = ref('')
const listLoading = ref(false)
const submitLoading = ref(false)
const deleteLoading = ref(false)
const formVisible = ref(false)
const deleteVisible = ref(false)
const editingId = ref<number | null>(null)
const deleteTarget = ref<TaskTemplateListItem | null>(null)
const list = ref<TaskTemplateListItem[]>([])
const total = ref(0)
const pagination = reactive({
  page: 1,
  pageSize: 10,
})
const selectedBankId = ref<number | null>(null)
const banks = ref<BankTab[]>([])
const banksTotal = ref(0)
const expandedIds = ref(new Set<number>())

const {
  form,
  resetForm,
  fillForm,
  buildPayload,
  validateForm,
  cleanupRepeatFields,
} = useBankCardActivityForm()

const {
  bankOptions,
  bankCardTemplateOptions,
  regionOptions,
  benefitUsagePlatformOptions,
  activityCategoryOptions,
  cardOrganizationOptions,
  benefitCategoryOptions,
  benefitPayPlatformOptions,
  bankCardTypeOptions,
  regionMatchStrategyOptions,
  repeatTypeOptions,
  loadReferenceOptions,
  searchBanks,
  searchBankCardTemplates,
  searchRegions,
  searchBenefitUsagePlatforms,
  searchActivityCategories,
  loadResolvedSelections,
} = useBankCardActivityReferenceData()

const bankSelectOptions = computed(() =>
  ensureCurrentOption(bankOptions.value, form.bankId, (value: number | string) => `当前银行 ID: ${value}`))
const bankCardTemplateSelectOptions = computed(() =>
  ensureCurrentOption(bankCardTemplateOptions.value, form.bankCardTemplateId, (value: number | string) => `当前卡模板 ID: ${value}`))
const regionSelectOptions = computed(() =>
  ensureCurrentOption(regionOptions.value, form.regionCode, (value: number | string) => `当前区域代码: ${value}`))
const benefitUsagePlatformSelectOptions = computed(() =>
  ensureCurrentOption(benefitUsagePlatformOptions.value, form.benefitUsagePlatformId, (value: number | string) => `当前使用平台 ID: ${value}`))
const activityCategorySelectOptions = computed(() =>
  ensureCurrentOption(activityCategoryOptions.value, form.activityCategoryId, (value: number | string) => `当前活动分类 ID: ${value}`))

const bankCardTypeLabelMap = computed(() =>
  Object.fromEntries(bankCardTypeOptions.value.map((option: { value: string | number, label: string }) => [option.value, option.label])) as Record<string, string>)
const repeatTypeLabelMap = computed(() =>
  Object.fromEntries(repeatTypeOptions.value.map((option: { value: string | number, label: string }) => [option.value, option.label])) as Record<string, string>)

const categoryById = computed(() =>
  new Map(activityCategoryOptions.value.map(o => [o.value as number, o])))

// 把 task_template 一行转换成"何时提醒"的人类可读文案
//   - reminderTime 为空 → 全天任务（即"周期内任意时间可参与"）
//   - 否则按 repeatType + daysOfWeek/daysOfMonth/yearlyMonths/yearlyDaysOfMonth 拼："每周三 10:00" / "每月 1/15日 09:00" 等
const WEEKDAY_CN = ['一', '二', '三', '四', '五', '六', '日'] // ISO: 1=周一 ... 7=周日
function formatReminderSummary(row: any): string {
  const time = (row?.reminderTime ?? '').toString().trim()
  if (!time) return '全天任务'

  const repeat = String(row?.repeatType ?? '')
  const dow = Array.isArray(row?.daysOfWeek) ? (row.daysOfWeek as number[]) : []
  const dom = Array.isArray(row?.daysOfMonth) ? (row.daysOfMonth as number[]) : []
  const ymonths = Array.isArray(row?.yearlyMonths) ? (row.yearlyMonths as number[]) : []
  const ydays = Array.isArray(row?.yearlyDaysOfMonth) ? (row.yearlyDaysOfMonth as number[]) : []

  switch (repeat) {
    case 'DAILY':
      return `每日 ${time}`
    case 'WEEKLY': {
      if (dow.length === 0) return `每周 ${time}`
      const labels = dow.map(d => WEEKDAY_CN[(d - 1) % 7] ?? '?').join('/')
      return `每周${labels} ${time}`
    }
    case 'MONTHLY': {
      if (dom.length === 0) return `每月 ${time}`
      return `每月${dom.join('/')}日 ${time}`
    }
    case 'YEARLY': {
      if (ymonths.length === 0 || ydays.length === 0) return `每年 ${time}`
      // 多月 + 多日，组合枚举（典型场景一般是 1 个月 + 1 个日）
      const monthLabel = ymonths.join('/')
      const dayLabel = ydays.join('/')
      return `每年${monthLabel}月${dayLabel}日 ${time}`
    }
    case 'ONE_TIME':
    default:
      return time
  }
}

// 活动地区：regionCode 100000 视为"全国"；matchStrategy 决定是否带"（除计划单列市）"修饰
//   其它 regionCode 直接显示 regionName（leftJoin 来的），缺失才显示原 code
function formatRegion(row: any): string {
  const code = String(row?.regionCode ?? '').trim()
  const strategy = String(row?.regionMatchStrategy ?? '').trim()
  const name = (row?.regionName ?? '').toString().trim()

  if (code === '100000') {
    return strategy === 'EXCLUDE_PLAN_SINGLE_CITY' ? '全国（除计划单列市）' : '全国'
  }
  return name || code || '—'
}

const columns = computed<PrimaryTableCol<TableRowData>[]>(() => [
  {
    // 标题列承载两行：上行 [银行 logo+名] · [卡组织 logo+卡类型]，下行 活动标题
    colKey: 'title',
    title: '活动',
    width: 320,
  },
  {
    colKey: 'region',
    title: '活动地区',
    width: 140,
  },
  {
    colKey: 'activityCategory',
    title: '活动类型',
    width: 200,
  },
  {
    colKey: 'usagePlatform',
    title: '使用平台',
    width: 90,
  },
  {
    colKey: 'payPlatform',
    title: '支付平台',
    width: 90,
  },
  {
    colKey: 'repeatType',
    title: '重复类型',
    width: 110,
  },
  {
    colKey: 'reminderTime',
    title: '提醒',
    width: 100,
  },
  {
    colKey: 'dateRange',
    title: '起止日期',
    width: 200,
  },
  {
    colKey: 'updatedAt',
    title: '更新日期',
    width: 120,
  },
  {
    colKey: 'isVisible',
    title: '前台显示',
    width: 100,
    fixed: 'right',
  },
  {
    colKey: 'op',
    title: '操作',
    width: 140,
    fixed: 'right',
  },
])

async function handleToggleVisible(row: TaskTemplateListItem, next: unknown) {
  const nextBool = Boolean(next)
  const prev = row.isVisible
  // 乐观更新
  row.isVisible = nextBool ? 1 : 0
  try {
    await requestJson(`/api/bankCardActivities/taskTemplates/${row.id}/visibility`, {
      method: 'PUT',
      body: { isVisible: nextBool },
    })
    MessagePlugin.success(nextBool ? '已显示' : '已隐藏')
  }
  catch (e: any) {
    row.isVisible = prev
    MessagePlugin.error(e?.message ?? '切换失败')
  }
}

function getTierRows(row: TaskTemplateListItem): TierRow[] {
  const tiers = (row as any).tiers ?? []
  return tiers.map((t: any, i: number) => ({
    sortIndex: i + 1,
    minAmount: t.minAmount ?? null,
    benefitAmountFixed: t.benefitAmountFixed ?? null,
    benefitAmountMin: t.benefitAmountMin ?? null,
    benefitAmountMax: t.benefitAmountMax ?? null,
    benefitDescription: t.benefitDescription ?? null,
    quotaPerCycleText: t.quotaPerCycleText ?? null,
    quotaTotalText: t.quotaTotalText ?? null,
  }))
}

/**
 * 按 groupId 把同组行聚拢到一起渲染。
 * - 维持后端原有 id desc 顺序作为基准
 * - 同 groupId 的行在第一次出现时一次性铺平进结果
 * - 单行（groupId 为 null）按原顺序穿插
 */
const groupedList = computed<TaskTemplateListItem[]>(() => {
  const items = list.value
  if (items.length === 0) return items
  const seen = new Set<number>()
  const out: TaskTemplateListItem[] = []
  for (const item of items) {
    if (seen.has((item as any).id)) continue
    const gid = (item as any).groupId
    if (gid != null) {
      const sameGroup = items
        .filter(r => (r as any).groupId === gid)
        // 组内按 tiers[0].minAmount 升序，让"小档→大档"一目了然
        .sort((a, b) => {
          const am = (a as any).tiers?.[0]?.minAmount ?? 0
          const bm = (b as any).tiers?.[0]?.minAmount ?? 0
          return Number(am) - Number(bm)
        })
      sameGroup.forEach((r) => {
        out.push(r)
        seen.add((r as any).id)
      })
    }
    else {
      out.push(item)
      seen.add((item as any).id)
    }
  }
  return out
})

/** 给同 groupId 的行一组连贯的 CSS 标记，便于左侧色带 + 圆角拼接 */
function rowClassName({ row }: { row: any }): string {
  const gid = row?.groupId
  if (gid == null) return ''
  const grouped = groupedList.value
  const idxInList = grouped.findIndex(r => (r as any).id === row.id)
  if (idxInList < 0) return 'row-grouped'
  const prev = grouped[idxInList - 1]
  const next = grouped[idxInList + 1]
  const isFirst = !prev || (prev as any).groupId !== gid
  const isLast = !next || (next as any).groupId !== gid
  return [
    'row-grouped',
    isFirst ? 'row-grouped-first' : '',
    isLast ? 'row-grouped-last' : '',
  ].filter(Boolean).join(' ')
}

/** 计算某行在它的 group 内是第几条 / 共几条，用于显示 "2 / 3" */
function getGroupPosition(row: any): { idx: number, total: number } | null {
  const gid = row?.groupId
  if (gid == null) return null
  const grouped = groupedList.value
  const sameGroup = grouped.filter(r => (r as any).groupId === gid)
  const idx = sameGroup.findIndex(r => (r as any).id === row.id)
  return idx >= 0 ? { idx: idx + 1, total: sameGroup.length } : null
}

function toggleExpand(id: number) {
  const next = new Set(expandedIds.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  expandedIds.value = next
}

onMounted(async () => {
  try {
    await Promise.all([loadReferenceOptions(), loadBanks()])
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载基础选项失败')
  }

  await loadList()
})

async function loadBanks() {
  const response = await requestJson<{ banks: BankTab[], total: number }>('/api/bankCardActivities/taskTemplates/banks')
  banks.value = response.banks
  banksTotal.value = response.total
}

async function runSearch(handler: (keyword: string) => Promise<void>, searchKeyword: string, fallbackMessage: string) {
  try {
    await handler(searchKeyword)
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : fallbackMessage)
  }
}

async function loadList() {
  listLoading.value = true

  try {
    let url = `/api/bankCardActivities/taskTemplates?page=${pagination.page}&pageSize=${pagination.pageSize}&keyword=${encodeURIComponent(keyword.value)}`
    if (selectedBankId.value)
      url += `&bankId=${selectedBankId.value}`

    const response = await requestJson<TaskTemplateListResponse>(url)
    list.value = response.list
    total.value = response.total
    expandedIds.value = new Set(
      response.list.filter((r: any) => Array.isArray(r.tiers) && r.tiers.length > 1).map((r: any) => r.id),
    )
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载模板列表失败')
  }
  finally {
    listLoading.value = false
  }
}

function handleBankTabChange(bankId: number | null) {
  selectedBankId.value = bankId
  pagination.page = 1
  expandedIds.value = new Set()
  loadList()
}

function handleSearch() {
  pagination.page = 1
  keyword.value = keywordInput.value.trim()
  loadList()
}

function handleReset() {
  keywordInput.value = ''
  keyword.value = ''
  pagination.page = 1
  loadList()
}

function handlePageChange(pageInfo: { current: number, pageSize: number }) {
  pagination.page = pageInfo.current
  pagination.pageSize = pageInfo.pageSize
  loadList()
}

function handleCreate() {
  editingId.value = null
  resetForm()
  formVisible.value = true
}

function formatDateRange(row: TaskTemplateListItem): string {
  // startDate / endDate 来自后端 formatTimestamp，形如 'YYYY-MM-DD HH:mm:ss'
  // 列表只显示日期部分；任一为空显示占位
  const s = (row.startDate || '').slice(0, 10)
  const e = (row.endDate || '').slice(0, 10)
  if (!s && !e) return '—'
  return `${s || '?'} ~ ${e || '?'}`
}

async function handleCopy(row: TaskTemplateListItem) {
  if ((row as any).groupId != null) {
    MessagePlugin.warning('聚合组活动暂不支持复制')
    return
  }
  try {
    await requestJson<{ id: number, success: boolean }>(`/api/bankCardActivities/taskTemplates/${row.id}/copy`, {
      method: 'POST',
    })
    MessagePlugin.success('已复制为副本（前台不可见，可手动开启）')
    await loadList()
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '复制失败')
  }
}

async function handleEdit(row: TaskTemplateListItem) {
  editingId.value = row.id
  submitLoading.value = true

  try {
    const detail = await requestJson<TaskTemplateDetailResponse>(`/api/bankCardActivities/taskTemplates/${row.id}`)
    // 编辑回填：从 coupon-category tree 拉一份 lookup（id → {name, logoUrl}），让 fillForm 把 linkedCoupons 行补全 UI 字段
    const couponLookup = new Map<number, { name: string, logoUrl: string | null }>()
    try {
      const tree = await fetchCouponCategoryTree()
      for (const fl of tree) {
        for (const b of fl.children) couponLookup.set(b.id, { name: b.name, logoUrl: b.logoUrl })
      }
    }
    catch (e: any) {
      // 拉失败也不阻塞编辑（form 里的 linkedCoupons 用占位名 #id 兜底）
      console.warn('[edit] coupon tree fetch failed:', e?.message ?? e)
    }
    // detail 现在是扁平的单 template；fillForm 仍按 { templates: [...] } 协议接收
    fillForm({ templates: [detail as any] }, couponLookup)
    await loadResolvedSelections(detail as any)
    formVisible.value = true
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载模板详情失败')
  }
  finally {
    submitLoading.value = false
  }
}

function handleCloseForm() {
  if (submitLoading.value) {
    return
  }

  formVisible.value = false
}

async function handleSubmit() {
  const validationError = validateForm()
  if (validationError) {
    MessagePlugin.warning(validationError)
    return
  }

  submitLoading.value = true

  try {
    if (editingId.value === null) {
      const created = await requestJson<CreateTaskTemplateResponse>('/api/bankCardActivities/taskTemplates', {
        method: 'POST',
        body: buildPayload(),
      })

      MessagePlugin.success(`创建成功，模板 ID：${created.id}`)
      pagination.page = 1
    }
    else {
      const updated = await requestJson<UpdateTaskTemplateResponse>(`/api/bankCardActivities/taskTemplates/${editingId.value}`, {
        method: 'PUT',
        body: buildPayload(),
      })

      MessagePlugin.success(`更新成功，模板 ID：${updated.id}`)
    }

    formVisible.value = false
    await Promise.all([loadList(), loadBanks()])
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '保存模板失败')
  }
  finally {
    submitLoading.value = false
  }
}

function handleDeleteClick(row: TaskTemplateListItem) {
  deleteTarget.value = row
  deleteVisible.value = true
}

async function handleDeleteConfirm() {
  if (!deleteTarget.value) {
    return
  }

  deleteLoading.value = true

  try {
    await requestJson(`/api/bankCardActivities/taskTemplates/${deleteTarget.value.id}`, {
      method: 'DELETE',
    })

    if (list.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1
    }

    deleteVisible.value = false
    deleteTarget.value = null
    await Promise.all([loadList(), loadBanks()])
    MessagePlugin.success('删除成功')
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '删除模板失败')
  }
  finally {
    deleteLoading.value = false
  }
}

function handleDeleteCancel() {
  if (deleteLoading.value) {
    return
  }

  deleteVisible.value = false
  deleteTarget.value = null
}
</script>

<template>
  <div class="template-shell p-4 min-w-0 w-full overflow-x-hidden space-y-4 md:p-5">
    <div class="bank-filter-bar">
      <button
        :class="['bank-tab', selectedBankId === null && 'bank-tab--active']"
        @click="handleBankTabChange(null)"
      >
        全部 <span class="bank-tab-count">({{ banksTotal }})</span>
      </button>
      <button
        v-for="b in banks"
        :key="b.id"
        :class="['bank-tab', selectedBankId === b.id && 'bank-tab--active']"
        @click="handleBankTabChange(b.id)"
      >
        <img v-if="b.logo" :src="b.logo" class="bank-tab-logo">
        <span>{{ b.name }}</span>
        <span class="bank-tab-count">({{ b.count }})</span>
      </button>
    </div>

    <t-card title="模板管理" class="template-panel template-toolbar">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-1 flex-col gap-3 md:flex-row">
          <t-input
            v-model="keywordInput"
            clearable
            placeholder="按活动标题搜索模板"
            @enter="handleSearch"
          />
          <div class="flex gap-3">
            <t-button theme="primary" @click="handleSearch">
              查询
            </t-button>
            <t-button variant="outline" @click="handleReset">
              重置
            </t-button>
          </div>
        </div>
        <t-button theme="primary" @click="handleCreate">
          新增模板
        </t-button>
      </div>
    </t-card>

    <t-card class="template-panel template-table-panel">
      <div class="table-scroll-shell">
        <t-table
          row-key="id"
          hover
          vertical-align="top"
          table-layout="fixed"
          :columns="columns"
          :data="groupedList"
          :loading="listLoading"
          :row-class-name="rowClassName"
        >
          <template #title="{ row }">
            <div class="title-cell">
              <button
                v-if="(row as any).tiers?.length > 1"
                class="expand-btn"
                @click.stop="toggleExpand((row as any).id)"
              >
                <t-icon :name="expandedIds.has((row as any).id) ? 'chevron-down' : 'chevron-right'" size="14" />
              </button>
              <div v-else class="expand-btn-spacer" />
              <div class="title-body">
                <!-- 上行：银行 + 卡组织/卡类型，作为活动主体的"维度标签"行 -->
                <div class="title-meta-row">
                  <div class="title-bank">
                    <img
                      v-if="(row as any).bankLogo"
                      :src="(row as any).bankLogo"
                      class="title-bank-logo"
                    >
                    <span class="title-bank-name">{{ (row as any).bankName || `银行 ID: ${(row as any).bankId}` }}</span>
                  </div>
                  <span class="title-meta-sep">·</span>
                  <div class="title-card-type">
                    <img
                      v-if="(row as any).cardOrganizationLogo"
                      :src="(row as any).cardOrganizationLogo"
                      :alt="(row as any).cardOrganizationName ?? ''"
                      :title="(row as any).cardOrganizationName ?? ''"
                      class="title-card-org-logo"
                    >
                    <span class="title-card-type-name">
                      {{ bankCardTypeLabelMap[String((row as any).bankCardType ?? '')] ?? (row as any).bankCardType }}
                    </span>
                  </div>
                  <template v-if="(row as any).groupId != null">
                    <span class="title-meta-sep">·</span>
                    <span v-if="getGroupPosition(row)" class="group-pos">
                      聚合组 {{ getGroupPosition(row)!.idx }} / {{ getGroupPosition(row)!.total }}
                    </span>
                  </template>
                </div>
                <div class="title-text">{{ (row as any).title }}</div>
                <template v-if="expandedIds.has((row as any).id)">
                  <div v-if="((row as any).tiers?.length ?? 0) > 1" class="tier-relation">
                    互斥·取一档
                  </div>
                  <div
                    v-for="tier in getTierRows(row as TaskTemplateListItem)"
                    :key="tier.sortIndex"
                    class="tier-row"
                  >
                    <span class="tier-idx">第{{ tier.sortIndex }}档</span>
                    <template v-if="tier.minAmount != null">
                      <span class="tier-cond">满¥{{ tier.minAmount }}</span>
                    </template>
                    <span class="tier-arrow">→</span>
                    <template v-if="tier.benefitAmountFixed != null">
                      <span class="tier-reward">¥{{ tier.benefitAmountFixed }}</span>
                    </template>
                    <template v-else-if="tier.benefitAmountMin != null && tier.benefitAmountMax != null">
                      <span class="tier-reward">¥{{ tier.benefitAmountMin }}-{{ tier.benefitAmountMax }}</span>
                    </template>
                    <span v-if="tier.benefitDescription" class="tier-desc">{{ tier.benefitDescription }}</span>
                    <span v-if="tier.quotaPerCycleText" class="tier-desc">· {{ tier.quotaPerCycleText }}</span>
                    <span v-if="tier.quotaTotalText" class="tier-desc">· {{ tier.quotaTotalText }}</span>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <template #region="{ row }">
            <span class="region-cell" :title="(row as any).regionCode">
              {{ formatRegion(row) }}
            </span>
          </template>

          <template #activityCategory="{ row }">
            <template v-if="(row as any).activityCategoryName">
              <div
                v-if="(row as any).activityCategoryParentId"
                class="category-breadcrumb"
              >
                <template v-if="categoryById.get((row as any).activityCategoryParentId) as any">
                  <img
                    v-if="categoryById.get((row as any).activityCategoryParentId)?.icon"
                    :src="categoryById.get((row as any).activityCategoryParentId)!.icon!"
                    class="platform-chip-icon"
                  >
                  <span class="category-parent-name">{{ categoryById.get((row as any).activityCategoryParentId)?.label }}</span>
                  <span class="category-sep">›</span>
                </template>
                <img v-if="(row as any).activityCategoryIcon" :src="(row as any).activityCategoryIcon" class="platform-chip-icon">
                <span>{{ (row as any).activityCategoryName }}</span>
              </div>
              <div v-else class="platform-chip">
                <img v-if="(row as any).activityCategoryIcon" :src="(row as any).activityCategoryIcon" class="platform-chip-icon">
                <span>{{ (row as any).activityCategoryName }}</span>
              </div>
            </template>
            <span v-else class="text-gray-400 text-sm">—</span>
          </template>

          <template #usagePlatform="{ row }">
            <img
              v-if="(row as any).usagePlatformIcon"
              :src="(row as any).usagePlatformIcon"
              :alt="(row as any).usagePlatformName ?? ''"
              :title="(row as any).usagePlatformName ?? ''"
              class="platform-chip-icon platform-chip-icon--lg"
            >
            <span v-else-if="(row as any).usagePlatformName" :title="(row as any).usagePlatformName" class="platform-name-fallback">
              {{ (row as any).usagePlatformName }}
            </span>
            <span v-else class="text-gray-400 text-sm">—</span>
          </template>

          <template #payPlatform="{ row }">
            <img
              v-if="(row as any).payPlatformIcon"
              :src="(row as any).payPlatformIcon"
              :alt="(row as any).payPlatformName ?? ''"
              :title="(row as any).payPlatformName ?? ''"
              class="platform-chip-icon platform-chip-icon--lg"
            >
            <span v-else-if="(row as any).payPlatformName" :title="(row as any).payPlatformName" class="platform-name-fallback">
              {{ (row as any).payPlatformName }}
            </span>
            <span v-else class="text-gray-400 text-sm">—</span>
          </template>

          <template #repeatType="{ row }">
            {{ repeatTypeLabelMap[String((row as any).repeatType ?? '')] ?? (row as any).repeatType }}
          </template>
          <template #reminderTime="{ row }">
            <t-tag v-if="!(row as any).reminderTime" size="small" theme="warning" variant="light">
              全天任务
            </t-tag>
            <span v-else class="reminder-summary">
              {{ formatReminderSummary(row) }}
            </span>
          </template>
          <template #isVisible="{ row }">
            <t-switch
              :value="(row as any).isVisible === 1"
              @change="(v) => handleToggleVisible(row as TaskTemplateListItem, v)"
            />
          </template>
          <template #dateRange="{ row }">
            <span class="date-range-cell">
              {{ formatDateRange(row as TaskTemplateListItem) }}
            </span>
          </template>
          <template #op="{ row }">
            <div class="flex gap-2">
              <t-button theme="primary" variant="text" @click="handleEdit(row as TaskTemplateListItem)">
                编辑
              </t-button>
              <t-button
                variant="text"
                :disabled="(row as any).groupId != null"
                :title="(row as any).groupId != null ? '聚合组活动暂不支持复制' : ''"
                @click="handleCopy(row as TaskTemplateListItem)"
              >
                复制
              </t-button>
              <t-button theme="danger" variant="text" @click="handleDeleteClick(row as TaskTemplateListItem)">
                删除
              </t-button>
            </div>
          </template>
        </t-table>
      </div>

      <div class="mt-4 flex justify-end">
        <t-pagination
          :current="pagination.page"
          :page-size="pagination.pageSize"
          :total="total"
          show-page-size
          @change="handlePageChange"
        />
      </div>
    </t-card>

    <t-dialog
      v-model:visible="formVisible"
      class="template-dialog"
      destroy-on-close
      :close-on-overlay-click="false"
      :confirm-btn="{ content: editingId === null ? '创建模板' : '保存修改', loading: submitLoading }"
      :header="editingId === null ? '新增模板' : '编辑模板'"
      :on-confirm="handleSubmit"
      width="960px"
      @close="handleCloseForm"
    >
      <BankCardActivityForm
        v-model:form="form"
        :bank-select-options="bankSelectOptions"
        :bank-card-template-select-options="bankCardTemplateSelectOptions"
        :region-select-options="regionSelectOptions"
        :benefit-usage-platform-select-options="benefitUsagePlatformSelectOptions"
        :activity-category-select-options="activityCategorySelectOptions"
        :card-organization-options="cardOrganizationOptions"
        :benefit-category-options="benefitCategoryOptions"
        :benefit-pay-platform-options="benefitPayPlatformOptions"
        :bank-card-type-options="bankCardTypeOptions"
        :region-match-strategy-options="regionMatchStrategyOptions"
        :repeat-type-options="repeatTypeOptions"
        @search-banks="runSearch(searchBanks, $event, '搜索银行失败')"
        @search-bank-card-templates="runSearch(searchBankCardTemplates, $event, '搜索银行卡模板失败')"
        @search-regions="runSearch(searchRegions, $event, '搜索地区失败')"
        @search-benefit-usage-platforms="runSearch(searchBenefitUsagePlatforms, $event, '搜索使用平台失败')"
        @search-activity-categories="runSearch(searchActivityCategories, $event, '搜索活动分类失败')"
        @repeat-type-change="cleanupRepeatFields"
      />
    </t-dialog>

    <t-dialog
      v-model:visible="deleteVisible"
      class="template-delete-dialog"
      theme="warning"
      header="删除模板"
      :confirm-btn="{ theme: 'danger', content: '确认删除', loading: deleteLoading }"
      :on-cancel="handleDeleteCancel"
      :on-confirm="handleDeleteConfirm"
    >
      <div class="text-sm text-gray-600">
        确认删除模板"{{ deleteTarget?.title }}"吗？该操作将删除此活动的所有档位，不可恢复。
      </div>
    </t-dialog>
  </div>
</template>

<style scoped>
.template-shell {
  --template-surface: rgba(255, 255, 255, 0.98);
  --template-surface-strong: rgba(255, 255, 255, 0.96);
  --template-shadow: 0 14px 36px rgba(15, 23, 42, 0.05);
  min-height: 100%;
}

/* Bank filter bar */
.bank-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 2px 8px;
}

.bank-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.9);
  color: #555;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.bank-tab-count {
  opacity: 0.6;
  font-size: 12px;
  font-weight: 400;
}
.bank-tab:hover {
  background: rgba(59, 130, 246, 0.06);
  border-color: rgba(59, 130, 246, 0.24);
  color: #3b82f6;
}
.bank-tab--active {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.4);
  color: #2563eb;
  font-weight: 600;
}

.bank-tab-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 2px;
  flex-shrink: 0;
}

.platform-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
}

.category-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  flex-wrap: wrap;
}

.category-parent-name {
  color: #94a3b8;
}

.category-sep {
  color: #cbd5e1;
  font-size: 11px;
}

.platform-chip-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 2px;
  flex-shrink: 0;
}

/* 列表 logo-only 模式：取消 chip 容器，logo 大一点更易识别；hover 通过 title 看名字 */
.platform-chip-icon--lg {
  width: 22px;
  height: 22px;
  border-radius: 4px;
}

/* 没 logo 兜底：缩小字号、单行省略，避免占满列宽 */
.platform-name-fallback {
  display: inline-block;
  max-width: 80px;
  overflow: hidden;
  font-size: 12px;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-summary {
  font-size: 13px;
  color: #1e293b;
  white-space: nowrap;
}

.date-range-cell {
  font-size: 13px;
  color: #1e293b;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* 活动地区：单行省略；hover 通过 title 看 regionCode 原值 */
.region-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  color: #1e293b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Inline title + tier display */
.title-cell {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.expand-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #94a3b8;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}
.expand-btn:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.expand-btn-spacer {
  width: 18px;
  flex-shrink: 0;
}

.title-body {
  min-width: 0;
  flex: 1;
}

.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
  font-weight: 500;
  color: #0f172a;
}

/* 标题上方的元信息行：[银行 logo+名] · [卡组织 logo+卡类型]，灰色细字，不抢标题视觉 */
.title-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.3;
}
.title-meta-sep {
  color: #cbd5e1;
}
.title-bank,
.title-card-type {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.title-bank-logo {
  width: 14px;
  height: 14px;
  object-fit: contain;
  border-radius: 2px;
  flex-shrink: 0;
}
.title-bank-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title-card-org-logo {
  width: 14px;
  height: 14px;
  object-fit: contain;
  border-radius: 2px;
  flex-shrink: 0;
}
.title-card-type-name {
  white-space: nowrap;
}

.tier-relation {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
}

.group-pos {
  font-size: 11px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
}

/* 同 groupId 的行视觉聚合：左侧蓝色色带 + 浅蓝底 */
:deep(.row-grouped) td {
  background-color: #f0f7ff !important;
  position: relative;
}
:deep(.row-grouped) td:first-child {
  border-left: 3px solid #2563eb;
}
:deep(.row-grouped:not(.row-grouped-first):not(.row-grouped-last)) td {
  border-top-color: rgba(37, 99, 235, 0.15);
  border-bottom-color: rgba(37, 99, 235, 0.15);
}
:deep(.row-grouped-first:not(.row-grouped-last)) td {
  border-bottom: 1px dashed rgba(37, 99, 235, 0.25);
}
:deep(.row-grouped:not(.row-grouped-first):not(.row-grouped-last)) td {
  border-top: 1px dashed rgba(37, 99, 235, 0.25);
  border-bottom: 1px dashed rgba(37, 99, 235, 0.25);
}
:deep(.row-grouped-last:not(.row-grouped-first)) td {
  border-top: 1px dashed rgba(37, 99, 235, 0.25);
}

.tier-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}

.tier-idx {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  flex-shrink: 0;
  min-width: 28px;
}

.tier-cond {
  font-size: 11px;
  color: #64748b;
  background: rgba(100, 116, 139, 0.1);
  padding: 0 4px;
  border-radius: 2px;
  white-space: nowrap;
}

.tier-arrow {
  font-size: 11px;
  color: #cbd5e1;
}

.tier-reward {
  font-size: 12px;
  font-weight: 600;
  color: #16a34a;
  white-space: nowrap;
}

.tier-desc {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.table-scroll-shell {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}

.template-shell :deep(.t-card) {
  background: var(--template-surface);
  border: 0;
  border-radius: 10px;
  box-shadow: var(--template-shadow);
  overflow: hidden;
}

.template-toolbar :deep(.t-card__body) {
  padding-top: 2px;
}

.template-table-panel :deep(.t-card__body) {
  padding-top: 4px;
}

.template-table-panel {
  margin-top: 14px;
}

.template-shell :deep(.t-card__header) {
  border-bottom: 0;
  padding: 12px 16px 4px;
}

.template-shell :deep(.t-card__title) {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.template-shell :deep(.t-card__body) {
  padding: 8px 16px 12px;
}

.template-shell :deep(.t-input__wrap),
.template-shell :deep(.t-input-number),
.template-shell :deep(.t-input-adornment),
.template-shell :deep(.t-textarea__inner),
.template-shell :deep(.t-select .t-input),
.template-shell :deep(.t-date-picker .t-input),
.template-shell :deep(.t-time-picker .t-input) {
  border-color: transparent;
  background: var(--template-surface-strong);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
}

.template-shell :deep(.t-input__wrap:hover),
.template-shell :deep(.t-input-number:hover),
.template-shell :deep(.t-select .t-input:hover),
.template-shell :deep(.t-date-picker .t-input:hover),
.template-shell :deep(.t-time-picker .t-input:hover) {
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.24);
}

.template-shell :deep(.t-table) {
  min-width: 1440px;
}

.template-shell :deep(.t-pagination) {
  padding-top: 4px;
}

.template-shell :deep(.t-button--variant-outline) {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(148, 163, 184, 0.2);
}

.template-shell :deep(.t-button--variant-text) {
  border-radius: 999px;
}

.template-shell :deep(.t-button--variant-text.t-button--theme-primary) {
  background: rgba(59, 130, 246, 0.08);
}

.template-shell :deep(.t-button--variant-text.t-button--theme-danger) {
  background: rgba(239, 68, 68, 0.08);
}

:deep(.template-dialog .t-dialog),
:deep(.template-delete-dialog .t-dialog) {
  border: 0;
  border-radius: 12px;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.16);
  overflow: hidden;
}

:deep(.template-dialog .t-dialog__header),
:deep(.template-delete-dialog .t-dialog__header) {
  border-bottom: 0;
  padding: 16px 20px 6px;
}

:deep(.template-dialog .t-dialog__body),
:deep(.template-delete-dialog .t-dialog__body) {
  padding: 8px 20px 16px;
}

:deep(.template-dialog .t-dialog__footer),
:deep(.template-delete-dialog .t-dialog__footer) {
  border-top: 0;
  padding: 0 20px 16px;
}

:deep(.template-dialog .t-form__item) {
  margin-bottom: 10px;
}

:deep(.template-dialog .t-input__wrap),
:deep(.template-dialog .t-input-number),
:deep(.template-dialog .t-input-adornment),
:deep(.template-dialog .t-textarea__inner),
:deep(.template-dialog .t-select .t-input),
:deep(.template-dialog .t-date-picker .t-input),
:deep(.template-dialog .t-time-picker .t-input) {
  border-color: transparent;
  background: var(--template-surface-strong);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.16);
}

:global(html.dark) .template-shell {
  --template-surface: rgba(17, 24, 39, 0.92);
  --template-surface-strong: rgba(17, 24, 39, 0.98);
  --template-shadow: 0 18px 40px rgba(2, 6, 23, 0.32);
  background: transparent;
}

:global(html.dark) .bank-tab {
  background: rgba(17, 24, 39, 0.8);
  border-color: rgba(71, 85, 105, 0.3);
  color: rgba(148, 163, 184, 0.9);
}
:global(html.dark) .bank-tab:hover {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}
:global(html.dark) .bank-tab--active {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}


:global(html.dark) .expand-btn {
  color: rgba(148, 163, 184, 0.6);
}
:global(html.dark) .expand-btn:hover {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.15);
}
:global(html.dark) .tier-idx {
  color: #94a3b8;
}
:global(html.dark) .tier-cond {
  background: rgba(71, 85, 105, 0.25);
  color: #94a3b8;
}
:global(html.dark) .tier-reward {
  color: #4ade80;
}
:global(html.dark) .tier-desc {
  color: #64748b;
}

:global(html.dark) .template-shell :deep(.t-card) {
  background: rgba(17, 24, 39, 0.92) !important;
}

:global(html.dark) .template-shell :deep(.t-card__header),
:global(html.dark) .template-shell :deep(.t-card__body) {
  background: rgba(17, 24, 39, 0.92) !important;
}

:global(html.dark) .template-shell :deep(.t-card__title) {
  color: rgba(241, 245, 249, 0.96);
}

:global(html.dark) .template-shell :deep(.t-input__wrap),
:global(html.dark) .template-shell :deep(.t-input-number),
:global(html.dark) .template-shell :deep(.t-input-adornment),
:global(html.dark) .template-shell :deep(.t-textarea__inner),
:global(html.dark) .template-shell :deep(.t-select .t-input),
:global(html.dark) .template-shell :deep(.t-date-picker .t-input),
:global(html.dark) .template-shell :deep(.t-time-picker .t-input) {
  background: rgba(15, 23, 42, 0.96) !important;
  box-shadow: inset 0 0 0 1px rgba(71, 85, 105, 0.9);
}

:global(html.dark) .template-shell :deep(.t-input__wrap input),
:global(html.dark) .template-shell :deep(.t-input__wrap textarea),
:global(html.dark) .template-shell :deep(.t-input__wrap .t-input__inner),
:global(html.dark) .template-shell :deep(.t-input__wrap .t-textarea__inner) {
  color: rgba(241, 245, 249, 0.96) !important;
}

:global(html.dark) .template-shell :deep(.t-button--variant-outline) {
  background: rgba(17, 24, 39, 0.82) !important;
  border-color: rgba(148, 163, 184, 0.24);
}

:global(html.dark) .template-shell :deep(.t-button--variant-text.t-button--theme-primary) {
  background: rgba(59, 130, 246, 0.18);
}

:global(html.dark) .template-shell :deep(.t-button--variant-text.t-button--theme-danger) {
  background: rgba(239, 68, 68, 0.18);
}

:global(html.dark) :deep(.template-dialog .t-dialog),
:global(html.dark) :deep(.template-delete-dialog .t-dialog) {
  background: rgba(15, 23, 42, 0.98) !important;
}

:global(html.dark) :deep(.template-dialog .t-dialog__header),
:global(html.dark) :deep(.template-delete-dialog .t-dialog__header),
:global(html.dark) :deep(.template-dialog .t-dialog__body),
:global(html.dark) :deep(.template-delete-dialog .t-dialog__body),
:global(html.dark) :deep(.template-dialog .t-dialog__footer),
:global(html.dark) :deep(.template-delete-dialog .t-dialog__footer) {
  background: transparent !important;
}
</style>
