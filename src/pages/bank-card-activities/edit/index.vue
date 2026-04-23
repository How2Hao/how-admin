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
import { requestJson } from '@/composables/useJsonRequest'

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

const columns = computed<PrimaryTableCol<TableRowData>[]>(() => [
  {
    colKey: 'title',
    title: '活动标题',
    width: 320,
    ellipsis: true,
  },
  {
    colKey: 'bankName',
    title: '银行',
    width: 180,
  },
  {
    colKey: 'bankCardType',
    title: '卡类型',
    width: 120,
  },
  {
    colKey: 'repeatType',
    title: '重复类型',
    width: 120,
  },
  {
    colKey: 'startDate',
    title: '开始时间',
    width: 180,
  },
  {
    colKey: 'endDate',
    title: '结束时间',
    width: 180,
  },
  {
    colKey: 'updatedAt',
    title: '更新时间',
    width: 180,
  },
  {
    colKey: 'op',
    title: '操作',
    width: 160,
    fixed: 'right',
  },
])

onMounted(async () => {
  try {
    await loadReferenceOptions()
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载基础选项失败')
  }

  await loadList()
})

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
    const response = await requestJson<TaskTemplateListResponse>('/api/bankCardActivities/taskTemplates'
      + `?page=${pagination.page}&pageSize=${pagination.pageSize}&keyword=${encodeURIComponent(keyword.value)}`)

    list.value = response.list
    total.value = response.total
  }
  catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : '加载模板列表失败')
  }
  finally {
    listLoading.value = false
  }
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

async function handleEdit(row: TaskTemplateListItem) {
  editingId.value = row.id
  submitLoading.value = true

  try {
    const detail = await requestJson<TaskTemplateDetailResponse>(`/api/bankCardActivities/taskTemplates/${row.id}`)
    fillForm(detail)
    await loadResolvedSelections(detail)
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
    await loadList()
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
    await loadList()
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
          table-layout="fixed"
          :columns="columns"
          :data="list"
          :loading="listLoading"
        >
          <template #bankName="{ row }">
            {{ row.bankName || `银行 ID: ${row.bankId}` }}
          </template>
          <template #bankCardType="{ row }">
            {{ bankCardTypeLabelMap[String(row.bankCardType ?? '')] ?? row.bankCardType }}
          </template>
          <template #repeatType="{ row }">
            {{ repeatTypeLabelMap[String(row.repeatType ?? '')] ?? row.repeatType }}
          </template>
          <template #op="{ row }">
            <div class="flex gap-2">
              <t-button theme="primary" variant="text" @click="handleEdit(row as TaskTemplateListItem)">
                编辑
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
        确认删除模板“{{ deleteTarget?.title }}”吗？该操作不可恢复。
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
  min-width: 1260px;
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
  padding: 24px 28px 8px;
}

:deep(.template-dialog .t-dialog__body),
:deep(.template-delete-dialog .t-dialog__body) {
  padding: 12px 28px 28px;
}

:deep(.template-dialog .t-dialog__footer),
:deep(.template-delete-dialog .t-dialog__footer) {
  border-top: 0;
  padding: 0 28px 24px;
}

:deep(.template-dialog .t-form__item) {
  margin-bottom: 18px;
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
