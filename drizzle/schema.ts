import { sql } from 'drizzle-orm'
import { bigint, char, datetime, decimal, double, index, int, json, mysqlEnum, mysqlTable, primaryKey, smallint, text, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'

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
  alias: varchar({ length: 255 }),
  tags: varchar({ length: 1024 }),
  dataSource: varchar('data_source', { length: 50 }).default('51credit').notNull(),
  relatedCount: int('related_count').default(0).notNull(),
  provinceCode: varchar('province_code', { length: 20 }),
  provinceName: varchar('province_name', { length: 50 }),
  cityCode: varchar('city_code', { length: 20 }),
  cityName: varchar('city_name', { length: 50 }),
  cardLastFour: varchar('card_last_four', { length: 10 }),
  creditLimit: double('credit_limit'),
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
  highPriority: tinyint('high_priority').default(0).notNull(),
  advanceReminderMinutes: smallint('advance_reminder_minutes'),
  status: mysqlEnum(['PENDING', 'EXPIRED', 'COMPLETED']).default('PENDING').notNull(),
  bankId: varchar('bank_id', { length: 50 }),
  bankCardId: int('bank_card_id'),
  bankCardType: varchar('bank_card_type', { length: 255 }),
  bankCardLevel: int('bank_card_level'),
  bankCardOrganization: text('bank_card_organization'),
  taskTemplateId: int('task_template_id'),
  benefitCategoryId: int('benefit_category_id'),
  benefitAmount: decimal('benefit_amount', { precision: 10, scale: 2 }),
  benefitVoucherDescription: varchar('benefit_voucher_description', { length: 500 }),
  benefitPayPlatformId: int('benefit_pay_platform_id'),
  frequencyControl: varchar('frequency_control', { length: 100 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_task_user_id').on(table.userId),
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
  benefitAmount: decimal('benefit_amount', { precision: 10, scale: 2 }),
  benefitDescription: varchar('benefit_description', { length: 500 }),
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
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
  index('idx_activity_category').on(table.activityCategoryId),
  primaryKey({ columns: [table.id], name: 'task_template_id' }),
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
}, table => [
  unique('app_release_version').on(table.version),
  primaryKey({ columns: [table.id], name: 'app_release_id' }),
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
