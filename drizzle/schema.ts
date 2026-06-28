import { sql } from 'drizzle-orm'
import { bigint, char, datetime, decimal, double, index, int, json, mediumtext, mysqlEnum, mysqlTable, primaryKey, smallint, text, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'

export const accCategories = mysqlTable('acc_categories', {
  id: int().autoincrement().notNull(),
  userId: int('user_id'),
  type: mysqlEnum(['INCOME', 'EXPENSE']).default('EXPENSE').notNull(),
  name: varchar({ length: 50 }).notNull(),
  icon: varchar({ length: 200 }),
  sortOrder: int('sort_order').default(0).notNull(),
  isSystem: tinyint('is_system').default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_cat_user_type').on(table.userId, table.type),
  primaryKey({ columns: [table.id], name: 'acc_categories_id' }),
])

export const users = mysqlTable('users', {
  id: int().autoincrement().notNull(),
  uid6: char({ length: 6 }).notNull(),
  phone: varchar({ length: 20 }),
  phoneVerifiedAt: bigint('phone_verified_at', { mode: 'number' }),
  username: varchar({ length: 100 }).notNull(),
  avatar: varchar({ length: 500 }),
  status: mysqlEnum(['ACTIVE', 'PENDING_BIND', 'DISABLED']).default('ACTIVE').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  lastLoginAt: bigint('last_login_at', { mode: 'number' }),
}, table => [
  primaryKey({ columns: [table.id], name: 'users_id' }),
  unique('uniq_users_uid6').on(table.uid6),
  unique('uniq_users_phone').on(table.phone),
])

export const accLedgers = mysqlTable('acc_ledgers', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  icon: varchar({ length: 20 }),
  currency: varchar({ length: 10 }).default('CNY').notNull(),
  isDefault: tinyint('is_default').default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_ledger_user').on(table.userId),
  primaryKey({ columns: [table.id], name: 'acc_ledgers_id' }),
])

export const benefitPayPlatform = mysqlTable('benefit_pay_platform', {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 50 }).notNull(),
  icon: varchar({ length: 255 }),
  sortOrder: int('sort_order').default(0).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'benefit_pay_platform_id' }),
  unique('code').on(table.code),
])

export const accTransactions = mysqlTable('acc_transactions', {
  id: int().autoincrement().notNull(),
  ledgerId: int('ledger_id').notNull().references(() => accLedgers.id, { onDelete: 'cascade' }),
  accUserId: int('acc_user_id'),
  categoryId: int('category_id').notNull().references(() => accCategories.id, { onDelete: 'restrict' }),
  type: mysqlEnum(['INCOME', 'EXPENSE']).notNull(),
  amount: decimal({ precision: 15, scale: 2 }).notNull(),
  account: varchar({ length: 50 }),
  bankId: varchar('bank_id', { length: 50 }),
  bankCardId: int('bank_card_id'),
  benefitPayPlatformId: int('benefit_pay_platform_id').references(() => benefitPayPlatform.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  transactionDate: bigint('transaction_date', { mode: 'number' }).notNull(),
  remark: varchar({ length: 500 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  relatedIncomeId: int('related_income_id'),
}, table => [
  index('idx_txn_ledger').on(table.ledgerId),
  index('idx_txn_category').on(table.categoryId),
  index('idx_txn_date').on(table.transactionDate),
  index('idx_related_income_id').on(table.relatedIncomeId),
  index('idx_acc_transactions_acc_user_id').on(table.accUserId),
  index('idx_txn_ledger_date').on(table.ledgerId, table.transactionDate),
  index('idx_txn_benefit_pay_platform_id').on(table.benefitPayPlatformId),
  primaryKey({ columns: [table.id], name: 'acc_transactions_id' }),
])

export const accUsers = mysqlTable('acc_users', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  username: varchar({ length: 50 }).notNull(),
  avatar: varchar({ length: 500 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_acc_user_owner').on(table.userId),
  primaryKey({ columns: [table.id], name: 'acc_users_id' }),
  unique('uniq_acc_user_owner_username').on(table.userId, table.username),
])

/**
 * 卡券分类树（自指；parent_id=0 = 一级分类，parent_id>0 = 二级品牌）。
 * 数据来源：scripts/sync_coupon_categories_from_quanma.ts 从 quanma51.com 抓取入库。
 */
export const couponCategory = mysqlTable('coupon_category', {
  id: int().autoincrement().notNull(),
  source: varchar({ length: 32 }).default('quanma51').notNull(),
  parentId: int('parent_id').default(0).notNull(),
  name: varchar({ length: 64 }).notNull(),
  sortOrder: int('sort_order').default(0).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  logoOriginUrl: varchar('logo_origin_url', { length: 500 }),
  skuQueryName: varchar('sku_query_name', { length: 64 }),
  isVisible: tinyint('is_visible').default(1).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_coupon_category_parent_visible').on(table.parentId, table.isVisible),
  primaryKey({ columns: [table.id], name: 'coupon_category_id' }),
  unique('uniq_coupon_category').on(table.source, table.parentId, table.name),
])

export const activityCategory = mysqlTable('activity_category', {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 32 }).notNull(),
  name: varchar({ length: 50 }).notNull(),
  parentId: int('parent_id'),
  icon: varchar({ length: 255 }),
  sortOrder: int('sort_order').default(0),
  createdAt: bigint('created_at', { mode: 'number' }).default(sql`((unix_timestamp() * 1000))`).notNull(),
}, table => [
  index('idx_parent').on(table.parentId),
  primaryKey({ columns: [table.id], name: 'activity_category_id' }),
  unique('code').on(table.code),
])

export const bank = mysqlTable('bank', {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 100 }).notNull(),
  shortName: varchar('short_name', { length: 50 }),
  pinyinIndex: varchar('pinyin_index', { length: 100 }),
  code: varchar({ length: 50 }),
  logo: varchar({ length: 255 }),
  createdAt: datetime('created_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  themeColor: varchar('theme_color', { length: 255 }),
  creditCardCount: int('credit_card_count'),
  source: varchar({ length: 255 }),
  isUnifiedBill: tinyint('is_unified_bill').default(0).notNull(),
  isVisible: tinyint('is_visible').default(1).notNull(),
  bankType: varchar('bank_type', { length: 32 }),
  isHot: tinyint('is_hot').default(0).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'bank_id' }),
])

export const app = mysqlTable('app', {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 255 }).notNull(),
  logo: varchar({ length: 255 }),
  iosSchemaUrl: varchar('ios_schema_url', { length: 255 }),
  androidSchemaUrl: varchar('android_schema_url', { length: 255 }),
  bankId: int('bank_id').references(() => bank.id),
}, table => [
  index('bank_id').on(table.bankId),
  primaryKey({ columns: [table.id], name: 'app_id' }),
])

export const authSmsEvents = mysqlTable('auth_sms_events', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  phone: varchar({ length: 20 }).notNull(),
  scene: varchar({ length: 50 }).notNull(),
  provider: varchar({ length: 50 }).notNull(),
  providerRequestId: varchar('provider_request_id', { length: 100 }),
  action: mysqlEnum(['SEND', 'VERIFY']).notNull(),
  result: mysqlEnum(['SUCCESS', 'FAILED', 'RATE_LIMITED']).notNull(),
  failureReason: varchar('failure_reason', { length: 255 }),
  ip: varchar({ length: 64 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_auth_sms_event_phone_scene_created_at').on(table.phone, table.scene, table.createdAt),
  index('idx_auth_sms_event_provider_request').on(table.providerRequestId),
  primaryKey({ columns: [table.id], name: 'auth_sms_events_id' }),
])

export const bankCardTemplate = mysqlTable('bank_card_template', {
  id: int().autoincrement().notNull(),
  bankId: varchar('bank_id', { length: 50 }).notNull(),
  cardName: varchar('card_name', { length: 255 }).notNull(),
  cardType: varchar('card_type', { length: 20 }).notNull(),
  cardLevel: varchar('card_level', { length: 255 }),
  cardOrganization: varchar('card_organization', { length: 50 }).default('UNIONPAY').notNull(),
  cover: varchar({ length: 500 }),
  isVisible: tinyint('is_visible').default(1).notNull(),
  alias: varchar({ length: 255 }),
  tags: varchar({ length: 1024 }),
  dataSource: varchar('data_source', { length: 50 }).default('51credit').notNull(),
  relatedCount: int('related_count').default(0).notNull(),
  annualFeeType: varchar('annual_fee_type', { length: 20 }),
  rigidFeeAmount: double('rigid_fee_amount'),
  waiverMethod: varchar('waiver_method', { length: 30 }),
  waiverValue: double('waiver_value'),
  feeMonth: int('fee_month'),
  feeDay: int('fee_day'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }),
}, table => [
  primaryKey({ columns: [table.id], name: 'bank_card_template_id' }),
])

export const bankCard = mysqlTable('bank_card', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  bankId: varchar('bank_id', { length: 50 }).default('').notNull(),
  cardName: varchar('card_name', { length: 255 }),
  cardLevel: varchar('card_level', { length: 255 }),
  cardClass: int('card_class'),
  cardType: varchar('card_type', { length: 20 }).notNull(),
  cardOrganization: varchar('card_organization', { length: 50 }).default('UNIONPAY').notNull(),
  cover: varchar({ length: 500 }),
  regionCode: varchar('region_code', { length: 20 }).notNull(),
  cardLastFour: varchar('card_last_four', { length: 10 }).notNull(),
  creditLimit: double('credit_limit'),
  annualFeeType: varchar('annual_fee_type', { length: 20 }),
  rigidFeeAmount: double('rigid_fee_amount'),
  waiverMethod: varchar('waiver_method', { length: 30 }),
  waiverValue: double('waiver_value'),
  feeMonth: int('fee_month'),
  feeDay: int('fee_day'),
  statementDay: int('statement_day'),
  repaymentRuleType: varchar('repayment_rule_type', { length: 32 }),
  repaymentDay: int('repayment_day'),
  repaymentOffsetDays: int('repayment_offset_days'),
  maxInterestFreeDays: int('max_interest_free_days'),
  availableLimit: double('available_limit'),
  currency: varchar({ length: 8 }).default('CNY').notNull(),
  expiry: char({ length: 6 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }),
  templateId: int('template_id').references(() => bankCardTemplate.id),
}, table => [
  index('FK_8f2b7ce439989da5dba4c6cc9de').on(table.bankId),
  index('idx_bank_card_user_id').on(table.userId),
  primaryKey({ columns: [table.id], name: 'bank_card_id' }),
])

export const bankSmsRule = mysqlTable('bank_sms_rule', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  bankId: varchar('bank_id', { length: 50 }).notNull(),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  smsNumbersCsv: varchar('sms_numbers_csv', { length: 500 }).notNull(),
  smsTemplate: text('sms_template').notNull(),
  isEnabled: tinyint('is_enabled').default(1).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_bank_sms_rule_enabled').on(table.isEnabled),
  primaryKey({ columns: [table.id], name: 'bank_sms_rule_id' }),
  unique('uniq_bank_sms_rule_bank_id').on(table.bankId),
])

export const benefitCategory = mysqlTable('benefit_category', {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 50 }).notNull(),
  icon: varchar({ length: 200 }),
  sortOrder: int('sort_order').default(0).notNull(),
  accCategoryId: int('acc_category_id'),
  benefitPlatformIds: varchar('benefit_platform_ids', { length: 255 }),
}, table => [
  index('idx_acc_category_id').on(table.accCategoryId),
  primaryKey({ columns: [table.id], name: 'benefit_category_id' }),
])

export const benefitUsagePlatform = mysqlTable('benefit_usage_platform', {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 50 }).notNull(),
  icon: varchar({ length: 255 }),
  remark: varchar({ length: 255 }),
  sortOrder: int('sort_order').default(0),
  createdAt: datetime('created_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`),
}, table => [
  primaryKey({ columns: [table.id], name: 'benefit_usage_platform_id' }),
  unique('code').on(table.code),
])

export const cardLevel = mysqlTable('card_level', {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 50 }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'card_level_id' }),
  unique('id').on(table.id),
])

export const cardOrganization = mysqlTable('card_organization', {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 100 }).notNull(),
  logo: varchar({ length: 255 }).default('').notNull(),
  supportedCardTypes: varchar('supported_card_types', { length: 64 }),
  memberOrgIds: varchar('member_org_ids', { length: 64 }),
  status: varchar({ length: 16 }).default('ENABLED').notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'card_organization_id' }),
])

export const region = mysqlTable('region', {
  regionCode: varchar('region_code', { length: 20 }).notNull(),
  regionName: varchar('region_name', { length: 50 }),
  parentCode: varchar('parent_code', { length: 20 }),
  level: int(),
  regionType: varchar('region_type', { length: 20 }).default('NORMAL'),
  isPlanSingleCity: tinyint('is_plan_single_city').default(0),
}, table => [
  primaryKey({ columns: [table.regionCode], name: 'region_region_code' }),
])

export const task = mysqlTable('task', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  date: bigint({ mode: 'number' }),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  reminderTime: varchar('reminder_time', { length: 10 }),
  expireAt: bigint('expire_at', { mode: 'number' }),
  highPriority: tinyint('high_priority').default(0).notNull(),
  advanceReminderMinutes: smallint('advance_reminder_minutes'),
  status: mysqlEnum(['PENDING', 'EXPIRED', 'COMPLETED']).default('PENDING').notNull(),
  bankId: varchar('bank_id', { length: 50 }),
  bankCardId: int('bank_card_id'),
  bankCardType: varchar('bank_card_type', { length: 255 }),
  bankCardLevel: int('bank_card_level'),
  bankCardOrganization: text('bank_card_organization'),
  taskTemplateId: int('task_template_id'),
  reminderTemplateId: int('reminder_template_id'),
  sourceJobId: int('source_job_id'),
  sourceJobOccurrenceId: int('source_job_occurrence_id'),
  kind: mysqlEnum(['TRACKING', 'REMINDER', 'EXPIRY_REMINDER', 'PIN']),
  benefitCategoryId: int('benefit_category_id'),
  benefitAmount: decimal('benefit_amount', { precision: 10, scale: 2 }),
  benefitVoucherDescription: varchar('benefit_voucher_description', { length: 500 }),
  benefitPayPlatformId: int('benefit_pay_platform_id'),
  frequencyControl: varchar('frequency_control', { length: 100 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_task_user_id').on(table.userId),
  index('idx_task_reminder_template').on(table.reminderTemplateId),
  index('idx_task_source_job').on(table.sourceJobId),
  index('idx_task_source_job_occurrence').on(table.sourceJobOccurrenceId),
  primaryKey({ columns: [table.id], name: 'task_id' }),
])

export const taskRecurring = mysqlTable('task_recurring', {
  id: int().autoincrement().notNull(),
  taskId: int('task_id').notNull(),
  repeatType: mysqlEnum('repeat_type', ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('DAILY').notNull(),
  daysOfWeek: varchar('days_of_week', { length: 50 }),
  daysOfMonth: varchar('days_of_month', { length: 200 }),
  yearlyMonths: varchar('yearly_months', { length: 100 }),
  yearlyDaysOfMonth: varchar('yearly_days_of_month', { length: 200 }),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  reminderTime: varchar('reminder_time', { length: 10 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_repeat_type').on(table.repeatType),
  primaryKey({ columns: [table.id], name: 'task_recurring_id' }),
  unique('uniq_task_id').on(table.taskId),
])

export const taskRecurringOccurrence = mysqlTable('task_recurring_occurrence', {
  id: int().autoincrement().notNull(),
  taskId: int('task_id').notNull(),
  occurrenceDate: bigint('occurrence_date', { mode: 'number' }).notNull(),
  status: mysqlEnum(['PENDING', 'EXPIRED', 'COMPLETED']).default('PENDING').notNull(),
  isCompleted: tinyint('is_completed').default(0).notNull(),
  completedAt: bigint('completed_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_occurrence_date').on(table.occurrenceDate),
  index('idx_status').on(table.status),
  primaryKey({ columns: [table.id], name: 'task_recurring_occurrence_id' }),
  unique('uniq_task_occurrence').on(table.taskId, table.occurrenceDate),
])

export const taskTemplate = mysqlTable('task_template', {
  id: int().autoincrement().notNull(),
  title: varchar({ length: 200 }).notNull(),
  ruleBrief: varchar('rule_brief', { length: 500 }),
  ruleDetail: text('rule_detail'),
  ruleSource: json('rule_source'),
  reminderTemplateId: int('reminder_template_id'),
  jobTemplateId: int('job_template_id'),
  date: bigint({ mode: 'number' }),
  bankId: int('bank_id').notNull(),
  bankCardOrganization: varchar('bank_card_organization', { length: 255 }),
  bankCardTemplateId: int('bank_card_template_id'),
  bankCardType: varchar('bank_card_type', { length: 255 }),
  bankCardLevel: int('bank_card_level'),
  regionCode: varchar('region_code', { length: 20 }).notNull(),
  regionMatchStrategy: varchar('region_match_strategy', { length: 255 }),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  reminderTime: varchar('reminder_time', { length: 10 }),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  daysOfWeek: varchar('days_of_week', { length: 50 }),
  yearlyMonths: varchar('yearly_months', { length: 100 }),
  daysOfMonth: varchar('days_of_month', { length: 200 }),
  yearlyDaysOfMonth: varchar('yearly_days_of_month', { length: 200 }),
  frequencyControl: varchar('frequency_control', { length: 100 }),
  highPriority: tinyint('high_priority').default(0).notNull(),
  isCompleted: tinyint('is_completed').default(0).notNull(),
  status: mysqlEnum(['PENDING', 'EXPIRED', 'COMPLETED']).default('PENDING').notNull(),
  benefitCategoryId: int('benefit_category_id'),
  benefitPayPlatformId: int('benefit_pay_platform_id'),
  benefitUsagePlatformId: int('benefit_usage_platform_id'),
  activityCategoryId: int('activity_category_id'),
  publisher: varchar({ length: 255 }),
  publishTime: varchar('publish_time', { length: 200 }),
  likes: int().default(0),
  addCount: int('add_count').default(0),
  participationDifficulty: varchar('participation_difficulty', { length: 16 }),
  extraConditionsText: text('extra_conditions_text'),
  guideText: text('guide_text'),
  /** 档位信息数组（主存储），至少 1 个元素。tiers.length > 1 = 同一行内"互斥取一" */
  tiers: json('tiers').$type<{
    minAmount: number | null
    benefitAmountFixed: number | null
    benefitAmountMin: number | null
    benefitAmountMax: number | null
    benefitDescription: string | null
    quotaPerCycleText: string | null
    quotaTotalText: string | null
  }[]>().notNull(),
  /** UI 聚合分组 ID（无业务语义；同 groupId 的行渲染为同一聚合卡片） */
  groupId: int('group_id'),
  /**
   * 电子卡券 / 会员充值类活动关联的卡券明细（仅 benefitCategoryId in (1, 2) 时填值）。
   * 同 couponId 的不同 SKU 用数组里多行表示（爱奇艺月卡 + 爱奇艺季卡）。
   */
  linkedCoupons: json('linked_coupons').$type<{
    couponId: number
    purchasePrice: number | null
    sku: string | null
    actualValue: number | null
  }[]>(),
  // 创建/维护该模板的管理员 id（指向 admin_user.id）。现有数据回填为 1。
  // 默认值 1 是兜底（新代码会显式从当前登录 admin 写入），保留以防 INSERT 时漏带导致 NOT NULL 报错。
  adminUserId: int('admin_user_id').default(1).notNull(),
  isVisible: tinyint('is_visible').default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_activity_category').on(table.activityCategoryId),
  index('idx_task_template_reminder_template').on(table.reminderTemplateId),
  index('idx_task_template_job_template').on(table.jobTemplateId),
  index('idx_template_group').on(table.groupId),
  index('idx_task_template_admin_user').on(table.adminUserId),
  primaryKey({ columns: [table.id], name: 'task_template_id' }),
])

export const reminderTemplate = mysqlTable('reminder_template', {
  id: int().autoincrement().notNull(),
  taskTemplateId: int('task_template_id').notNull(),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  kind: mysqlEnum(['REMINDER', 'EXPIRY_REMINDER']).default('REMINDER').notNull(),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  date: bigint({ mode: 'number' }),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  daysOfWeek: varchar('days_of_week', { length: 50 }),
  daysOfMonth: varchar('days_of_month', { length: 200 }),
  yearlyMonths: varchar('yearly_months', { length: 100 }),
  yearlyDaysOfMonth: varchar('yearly_days_of_month', { length: 200 }),
  reminderTime: varchar('reminder_time', { length: 10 }),
  advanceReminderMinutes: smallint('advance_reminder_minutes'),
  isVisible: tinyint('is_visible').default(1).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_reminder_template_task_template').on(table.taskTemplateId),
  primaryKey({ columns: [table.id], name: 'reminder_template_id' }),
])

export const taskTemplateLike = mysqlTable('task_template_like', {
  id: int().autoincrement().notNull(),
  taskTemplateId: int('task_template_id').notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_task_template_like_template_id').on(table.taskTemplateId),
  index('idx_task_template_like_user_id').on(table.userId),
  primaryKey({ columns: [table.id], name: 'task_template_like_id' }),
  unique('uniq_task_template_like_user').on(table.taskTemplateId, table.userId),
])

export const userIdentities = mysqlTable('user_identities', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  provider: mysqlEnum(['PHONE_SMS', 'APPLE', 'WECHAT']).notNull(),
  providerUid: varchar('provider_uid', { length: 191 }).notNull(),
  appId: varchar('app_id', { length: 100 }),
  unionid: varchar({ length: 191 }),
  openid: varchar({ length: 191 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_user_identity_user_id').on(table.userId),
  primaryKey({ columns: [table.id], name: 'user_identities_id' }),
  unique('uniq_user_identity_provider_uid').on(table.provider, table.providerUid),
  unique('uniq_user_identity_wechat_app_openid').on(table.provider, table.appId, table.openid),
])

export const userSessions = mysqlTable('user_sessions', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  refreshToken: varchar('refresh_token', { length: 128 }).notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  revokedAt: bigint('revoked_at', { mode: 'number' }),
  ip: varchar({ length: 64 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  lastUsedAt: bigint('last_used_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_user_session_user_id').on(table.userId),
  primaryKey({ columns: [table.id], name: 'user_sessions_id' }),
  unique('uniq_user_session_refresh_token').on(table.refreshToken),
])

export const userUidSequence = mysqlTable('user_uid_sequence', {
  id: tinyint().notNull(),
  nextVal: bigint('next_val', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'user_uid_sequence_id' }),
])

export const appRelease = mysqlTable('app_release', {
  id: int().autoincrement().notNull(),
  version: varchar({ length: 32 }).notNull(),
  changelog: text().notNull(),
  androidUrl: varchar('android_url', { length: 500 }),
  iosUrl: varchar('ios_url', { length: 500 }),
  isMandatory: tinyint('is_mandatory').default(0).notNull(),
  publishedAt: bigint('published_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  article: mediumtext('article'),
  articleTitle: varchar('article_title', { length: 200 }),
}, table => [
  unique('app_release_version').on(table.version),
  primaryKey({ columns: [table.id], name: 'app_release_id' }),
])

// 草稿箱：仅 how-admin 读写，ha/hi 不感知。发布时把内容写入 app_release。
export const appReleaseDraft = mysqlTable('app_release_draft', {
  id: int().autoincrement().notNull(),
  version: varchar({ length: 32 }).notNull(),
  changelog: text().notNull(),
  androidUrl: varchar('android_url', { length: 500 }),
  iosUrl: varchar('ios_url', { length: 500 }),
  isMandatory: tinyint('is_mandatory').default(0).notNull(),
  publishedAt: bigint('published_at', { mode: 'number' }).notNull(),
  article: mediumtext('article'),
  articleTitle: varchar('article_title', { length: 200 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'app_release_draft_id' }),
])

export const userFeedback = mysqlTable('user_feedback', {
  id: int().autoincrement().notNull(),
  userId: int().notNull(),
  type: varchar({ length: 20 }).notNull(),
  content: text().notNull(),
  images: json().$type<string[]>(),
  context: json().$type<Record<string, unknown>>(),
  status: mysqlEnum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX']).default('OPEN').notNull(),
  resolutionType: mysqlEnum('resolution_type', ['NONE', 'NO_UPDATE', 'NEEDS_UPDATE']).default('NONE').notNull(),
  minAppVersion: varchar('min_app_version', { length: 20 }),
  resolutionNote: varchar('resolution_note', { length: 500 }),
  resolvedAt: bigint('resolved_at', { mode: 'number' }),
  createdAt: datetime({ mode: 'string', fsp: 6 }).default(sql`(CURRENT_TIMESTAMP(6))`).notNull(),
}, table => [
  index('idx_user_feedback_userId').on(table.userId),
  index('idx_user_feedback_user_created').on(table.userId, table.createdAt),
  primaryKey({ columns: [table.id], name: 'user_feedback_id' }),
])

// ── 后台管理员账号体系 ──────────────────────────────────────────────────
// 与 ha 端 users 表完全解耦：admin 用 username + 密码登录；ha 端走手机号 + SMS。
// role 字段为权限扩展预留：现阶段两个值 SUPER_ADMIN / ADMIN，后续要做 RBAC 不需要改 schema。
export const adminUser = mysqlTable('admin_user', {
  id: int().autoincrement().notNull(),
  username: varchar({ length: 64 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  // 头像 URL（OSS 完整地址或外链）；与 users.avatar 字段语义一致
  avatar: varchar({ length: 500 }),
  role: varchar({ length: 32 }).default('ADMIN').notNull(),
  status: varchar({ length: 16 }).default('ACTIVE').notNull(),
  lastLoginAt: bigint('last_login_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'admin_user_id' }),
  unique('admin_user_username').on(table.username),
])

// 会话用 random token + httpOnly cookie；revokedAt 支持服务端主动登出
export const adminSession = mysqlTable('admin_session', {
  id: int().autoincrement().notNull(),
  adminUserId: int('admin_user_id').notNull(),
  token: char({ length: 64 }).notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  revokedAt: bigint('revoked_at', { mode: 'number' }),
  ip: varchar({ length: 64 }),
  userAgent: varchar('user_agent', { length: 500 }),
  lastUsedAt: bigint('last_used_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'admin_session_id' }),
  unique('admin_session_token').on(table.token),
  index('idx_admin_session_admin_user').on(table.adminUserId),
])

export const deviceTokens = mysqlTable('device_tokens', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  userId: int('user_id').notNull(),
  platform: varchar({ length: 16 }).notNull(),
  apnsToken: varchar('apns_token', { length: 255 }),
  apnsEnv: varchar('apns_env', { length: 16 }),
  deviceId: varchar('device_id', { length: 100 }).notNull(),
  appVersion: varchar('app_version', { length: 20 }),
  osVersion: varchar('os_version', { length: 20 }),
  isActive: tinyint('is_active').default(1).notNull(),
  lastActiveAt: bigint('last_active_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'device_tokens_id' }),
  unique('uk_user_device').on(table.userId, table.deviceId),
])

// ─── 推送任务（admin 创建的推送行为元数据 + 缓存统计） ───
export const pushTask = mysqlTable('push_task', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  name: varchar({ length: 100 }).notNull(),
  status: varchar({ length: 20 }).default('DRAFT').notNull(),
  triggerSource: varchar('trigger_source', { length: 20 }).default('ADMIN').notNull(),
  // ACTIVITY / ANNOUNCEMENT / FEEDBACK_REPLY / SYSTEM — 决定走用户哪个子开关
  type: varchar({ length: 40 }).default('ACTIVITY').notNull(),
  // 下发方式：APNS=横幅+消息中心；INBOX=仅消息中心（永不发横幅）
  deliveryMode: varchar('delivery_mode', { length: 20 }).default('APNS').notNull(),

  audienceType: varchar('audience_type', { length: 20 }).notNull(),
  audienceUserIds: json('audience_user_ids'),
  audienceTagIds: json('audience_tag_ids'),
  audienceTagOp: varchar('audience_tag_op', { length: 8 }),
  audienceSnapshotCount: int('audience_snapshot_count'),

  title: varchar({ length: 200 }).notNull(),
  body: varchar({ length: 2000 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  landingType: varchar('landing_type', { length: 20 }).default('NONE').notNull(),
  landingPayload: json('landing_payload'),

  scheduledAt: bigint('scheduled_at', { mode: 'number' }),
  sentStartedAt: bigint('sent_started_at', { mode: 'number' }),
  sentFinishedAt: bigint('sent_finished_at', { mode: 'number' }),

  statsTotal: int('stats_total').default(0).notNull(),
  statsInboxWritten: int('stats_inbox_written').default(0).notNull(),
  statsSent: int('stats_sent').default(0).notNull(),
  statsFailed: int('stats_failed').default(0).notNull(),
  statsOpened: int('stats_opened').default(0).notNull(),
  // 类型订阅关闭被过滤的人数（既不写 inbox 也不推 APNs）
  statsFilteredByType: int('stats_filtered_by_type').default(0).notNull(),
  // 总开关关闭：写 inbox 但不推 APNs 的人数
  statsFilteredByMaster: int('stats_filtered_by_master').default(0).notNull(),

  createdByAdminId: int('created_by_admin_id'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'push_task_id' }),
])

// push_send 表已并入 notification_user_inbox（delivery_* 字段）

// ─── 标签（纯元数据壳，离线 user_id 名单的容器）───
export const pushTag = mysqlTable('push_tag', {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 60 }).notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 500 }),
  // 缓存的成员数（每次导入完更新）
  userCount: int('user_count').default(0).notNull(),
  createdByAdminId: int('created_by_admin_id'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'push_tag_id' }),
  unique('uk_code').on(table.code),
])

// ─── 用户 ↔ 标签 N:N（离线导入的数据）───
export const pushUserTag = mysqlTable('push_user_tag', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  userId: int('user_id').notNull(),
  tagId: int('tag_id').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'push_user_tag_id' }),
  unique('uk_user_tag').on(table.userId, table.tagId),
  index('idx_user').on(table.userId),
])

// ─── 消息内容（去重存储） ───
export const notificationMessage = mysqlTable('notification_message', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  // ACTIVITY / ANNOUNCEMENT / FEEDBACK_REPLY / SYSTEM
  type: varchar({ length: 40 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  body: varchar({ length: 2000 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  landingType: varchar('landing_type', { length: 20 }).default('NONE').notNull(),
  landingPayload: json('landing_payload'),
  // admin push_task 触发的消息会填这里；系统事件（反馈回复等）为 null
  sourcePushTaskId: bigint('source_push_task_id', { mode: 'number' }),
  // 仅个性化消息使用（反馈回复指向单个用户）；广播为 null
  targetUserId: int('target_user_id'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'notification_message_id' }),
])

// ─── 用户 × 消息：投递 + 阅读 一体（吸收了原 push_send） ───
export const notificationUserInbox = mysqlTable('notification_user_inbox', {
  id: bigint({ mode: 'number' }).autoincrement().notNull(),
  userId: int('user_id').notNull(),
  messageId: bigint('message_id', { mode: 'number' }).notNull(),

  // 投递（admin 写入）
  // APNS: 走 APNs；INBOX_ONLY: 用户关了总开关或无活跃 token
  deliveryChannel: varchar('delivery_channel', { length: 20 }),
  // PENDING / SENT / FAILED。INBOX_ONLY 视为 SENT
  deliveryStatus: varchar('delivery_status', { length: 20 }),
  deliveryErrorCode: varchar('delivery_error_code', { length: 50 }),
  deliveryErrorReason: varchar('delivery_error_reason', { length: 255 }),
  deliveryAttemptedAt: bigint('delivery_attempted_at', { mode: 'number' }),
  deliverySentAt: bigint('delivery_sent_at', { mode: 'number' }),

  // 阅读
  readAt: bigint('read_at', { mode: 'number' }),
  // PUSH_TAP: 用户点 push；INBOX_TAP: app 内点 inbox 项
  openedVia: varchar('opened_via', { length: 20 }),
  archivedAt: bigint('archived_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'notification_user_inbox_id' }),
  unique('uk_user_message').on(table.userId, table.messageId),
  index('idx_inbox_message_delivery').on(table.messageId, table.deliveryStatus),
])

// ─── 用户设置（由 hi 维护，admin 仅读取 settings_json.notification 做推送过滤） ───
export const userSettings = mysqlTable('user_settings', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  schemaVersion: tinyint('schema_version').default(1).notNull(),
  settingsJson: json('settings_json').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'user_settings_id' }),
  unique('uniq_user_settings_user_id').on(table.userId),
])

// ─── 广场自定义运营 Tab（admin 配置；C 端按 is_visible=1 过滤）───
export const plazaCustomTab = mysqlTable('plaza_custom_tab', {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 32 }).notNull(),
  name: varchar({ length: 20 }).notNull(),
  logo: varchar({ length: 255 }),
  templateIds: json('template_ids').$type<number[]>().notNull(),
  sortOrder: int('sort_order').default(0).notNull(),
  isVisible: tinyint('is_visible').default(1).notNull(),
  startTime: bigint('start_time', { mode: 'number' }),
  endTime: bigint('end_time', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'plaza_custom_tab_id' }),
  unique('uniq_plaza_custom_tab_code').on(table.code),
  index('idx_plaza_custom_tab_visible_sort').on(table.isVisible, table.sortOrder),
])

export const jobTemplate = mysqlTable('job_template', {
  id: int().autoincrement().notNull(),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  date: bigint({ mode: 'number' }),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  daysOfWeek: varchar('days_of_week', { length: 50 }),
  daysOfMonth: varchar('days_of_month', { length: 200 }),
  yearlyMonths: varchar('yearly_months', { length: 100 }),
  yearlyDaysOfMonth: varchar('yearly_days_of_month', { length: 200 }),
  /** 档位数组（主存储），至少 1 个元素。length > 1 = 多档。logic 控制金额/笔数的且或关系 */
  tiers: json('tiers').$type<{
    minAmount: number | null
    minCount: number | null
    logic: 'AND' | 'OR'
    description: string | null
  }[]>().notNull(),
  // 新设计中 job_template 属于一个 task_template，银行/卡/地区维度从 task_template 继承。
  taskTemplateId: int('task_template_id'),
  reminderTemplateId: int('reminder_template_id'),
  rewardWindowRule: json('reward_window_rule').$type<{
    mode: 'NEXT_MONTH' | 'NEXT_WEEK' | 'AFTER_COMPLETION_DAYS' | 'FIXED'
    startDay?: number | 'FIRST_DAY'
    endDay?: number | 'LAST_DAY'
    weekStartsOn?: number
    startOffsetDays?: number
    durationDays?: number
    startAt?: number
    endAt?: number
  }>(),
  rewardDescription: varchar('reward_description', { length: 500 }),
  // 兼容旧 admin 页面，后续 job_template 全量迁到 task_template 维度后再物理清理。
  bankId: int('bank_id'),
  bankCardTemplateId: int('bank_card_template_id'),
  regionCode: varchar('region_code', { length: 20 }),
  regionMatchStrategy: varchar('region_match_strategy', { length: 255 }),
  adminUserId: int('admin_user_id').default(1).notNull(),
  isVisible: tinyint('is_visible').default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_job_template_admin_user').on(table.adminUserId),
  index('idx_job_template_task_template').on(table.taskTemplateId),
  index('idx_job_template_reminder_template').on(table.reminderTemplateId),
  index('idx_job_template_bank').on(table.bankId),
  index('idx_job_template_card').on(table.bankCardTemplateId),
  primaryKey({ columns: [table.id], name: 'job_template_id' }),
])

export const job = mysqlTable('job', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  jobTemplateId: int('job_template_id'),
  taskTemplateId: int('task_template_id'),
  sourceType: mysqlEnum('source_type', ['ACTIVITY', 'REPAYMENT']).notNull(),
  subjectType: mysqlEnum('subject_type', ['TASK_TEMPLATE', 'BANK', 'BANK_CARD']).notNull(),
  subjectId: int('subject_id').notNull(),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  status: mysqlEnum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ARCHIVED']).default('PENDING').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_job_user_source').on(table.userId, table.sourceType),
  index('idx_job_subject').on(table.subjectType, table.subjectId),
  index('idx_job_template').on(table.jobTemplateId),
  index('idx_job_task_template').on(table.taskTemplateId),
  primaryKey({ columns: [table.id], name: 'job_id' }),
])

export const jobRecurring = mysqlTable('job_recurring', {
  id: int().autoincrement().notNull(),
  jobId: int('job_id').notNull(),
  repeatType: mysqlEnum('repeat_type', ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('DAILY').notNull(),
  daysOfWeek: varchar('days_of_week', { length: 50 }),
  daysOfMonth: varchar('days_of_month', { length: 200 }),
  yearlyMonths: varchar('yearly_months', { length: 100 }),
  yearlyDaysOfMonth: varchar('yearly_days_of_month', { length: 200 }),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_job_repeat_type').on(table.repeatType),
  primaryKey({ columns: [table.id], name: 'job_recurring_id' }),
  unique('uniq_job_id').on(table.jobId),
])

export const jobRecurringOccurrence = mysqlTable('job_recurring_occurrence', {
  id: int().autoincrement().notNull(),
  jobId: int('job_id').notNull(),
  cycleKey: varchar('cycle_key', { length: 64 }).notNull(),
  occurrenceStartAt: bigint('occurrence_start_at', { mode: 'number' }).notNull(),
  occurrenceEndAt: bigint('occurrence_end_at', { mode: 'number' }).notNull(),
  rewardStartAt: bigint('reward_start_at', { mode: 'number' }),
  rewardEndAt: bigint('reward_end_at', { mode: 'number' }),
  status: mysqlEnum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED']).default('PENDING').notNull(),
  progressAmount: decimal('progress_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  progressCount: int('progress_count').default(0).notNull(),
  completedAt: bigint('completed_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_job_occurrence_window').on(table.occurrenceStartAt, table.occurrenceEndAt),
  index('idx_job_occurrence_reward_window').on(table.rewardStartAt, table.rewardEndAt),
  index('idx_job_occurrence_status').on(table.status),
  primaryKey({ columns: [table.id], name: 'job_recurring_occurrence_id' }),
  unique('uniq_job_occurrence').on(table.jobId, table.cycleKey),
])
