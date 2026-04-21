import { sql } from 'drizzle-orm'
import { AnyMySqlColumn, bigint, char, datetime, decimal, double, foreignKey, index, int, mysqlEnum, mysqlSchema, mysqlTable, primaryKey, smallint, text, tinyint, unique, varchar } from 'drizzle-orm/mysql-core'

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

export const accUsers = mysqlTable('acc_users', {
  id: int().autoincrement().notNull(),
  username: varchar({ length: 50 }).notNull(),
  email: varchar({ length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatar: varchar({ length: 500 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'acc_users_id' }),
  unique('uniq_username').on(table.username),
  unique('uniq_email').on(table.email),
])

export const accLedgers = mysqlTable('acc_ledgers', {
  id: int().autoincrement().notNull(),
  userId: int('user_id').notNull().references(() => accUsers.id, { onDelete: 'cascade' }),
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

export const accTransactions = mysqlTable('acc_transactions', {
  id: int().autoincrement().notNull(),
  ledgerId: int('ledger_id').notNull().references(() => accLedgers.id, { onDelete: 'cascade' }),
  accUserId: int('acc_user_id'),
  categoryId: int('category_id').notNull().references(() => accCategories.id, { onDelete: 'restrict' }),
  type: mysqlEnum(['INCOME', 'EXPENSE']).notNull(),
  amount: decimal({ precision: 15, scale: 2 }).notNull(),
  account: varchar({ length: 50 }),
  bank: varchar({ length: 50 }),
  bankId: varchar('bank_id', { length: 50 }),
  bankCardId: int('bank_card_id'),
  benefitPlatformId: int('benefit_platform_id'),
  transactionDate: bigint('transaction_date', { mode: 'number' }).notNull(),
  description: text(),
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
  primaryKey({ columns: [table.id], name: 'acc_transactions_id' }),
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

export const bankCardTemplate = mysqlTable('bank_card_template', {
  id: int().autoincrement().notNull(),
  bankId: varchar('bank_id', { length: 50 }).notNull(),
  cardName: varchar('card_name', { length: 255 }).notNull(),
  cardType: varchar('card_type', { length: 20 }).notNull(),
  cardLevel: varchar('card_level', { length: 255 }),
  cardOrganization: varchar('card_organization', { length: 50 }).default('UNIONPAY').notNull(),
  cover: varchar({ length: 500 }),
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

export const benefitPlatform = mysqlTable('benefit_platform', {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 50 }).notNull(),
  icon: varchar({ length: 255 }),
  sortOrder: int('sort_order').default(0).notNull(),
}, table => [
  primaryKey({ columns: [table.id], name: 'benefit_platform_id' }),
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
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  date: bigint({ mode: 'number' }),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  reminderTime: varchar('reminder_time', { length: 10 }),
  highPriority: tinyint('high_priority').default(0).notNull(),
  advanceReminderMinutes: smallint('advance_reminder_minutes'),
  status: mysqlEnum(['PENDING', 'EXPIRED', 'COMPLETED']).default('PENDING').notNull(),
  regionType: mysqlEnum('region_type', ['NATIONWIDE', 'REGIONAL']).default('NATIONWIDE').notNull(),
  regionCode: varchar('region_code', { length: 20 }),
  regionProvinceName: varchar('region_province_name', { length: 50 }),
  regionCityName: varchar('region_city_name', { length: 50 }),
  bankId: varchar('bank_id', { length: 50 }),
  bankCardId: int('bank_card_id'),
  bankCardType: varchar('bank_card_type', { length: 255 }),
  bankCardLevel: int('bank_card_level'),
  bankCardOrganization: text('bank_card_organization'),
  taskTemplateId: int('task_template_id'),
  benefitCategoryId: int('benefit_category_id'),
  benefitAmount: decimal('benefit_amount', { precision: 10, scale: 2 }),
  benefitVoucherDescription: varchar('benefit_voucher_description', { length: 500 }),
  benefitPlatformId: int('benefit_platform_id'),
  frequencyControl: varchar('frequency_control', { length: 100 }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => [
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
  description: text(),
  date: bigint({ mode: 'number' }),
  bankId: int('bank_id').notNull(),
  bankCardOrganization: varchar('bank_card_organization', { length: 255 }),
  bankCardTemplateId: int('bank_card_template_id'),
  bankCardType: varchar('bank_card_type', { length: 255 }),
  bankCardLevel: int('bank_card_level'),
  regionCode: varchar('region_code', { length: 255 }),
  regionMatchStrategy: varchar('region_match_strategy', { length: 255 }),
  repeatType: mysqlEnum('repeat_type', ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('ONE_TIME').notNull(),
  daysOfWeek: varchar('days_of_week', { length: 50 }),
  daysOfMonth: varchar('days_of_month', { length: 200 }),
  yearlyMonths: varchar('yearly_months', { length: 100 }),
  yearlyDaysOfMonth: varchar('yearly_days_of_month', { length: 200 }),
  reminderTime: varchar('reminder_time', { length: 10 }),
  startDate: bigint('start_date', { mode: 'number' }),
  endDate: bigint('end_date', { mode: 'number' }),
  frequencyControl: varchar('frequency_control', { length: 100 }),
  highPriority: tinyint('high_priority').default(0).notNull(),
  advanceReminderMinutes: smallint('advance_reminder_minutes'),
  isCompleted: tinyint('is_completed').default(0).notNull(),
  status: mysqlEnum(['PENDING', 'EXPIRED', 'COMPLETED']).default('PENDING').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  regionType: mysqlEnum('region_type', ['NATIONWIDE', 'REGIONAL']).default('NATIONWIDE').notNull(),
  benefitCategoryId: int('benefit_category_id'),
  benefitAmount: decimal('benefit_amount', { precision: 10, scale: 2 }),
  benefitVoucherDescription: varchar('benefit_voucher_description', { length: 500 }),
  benefitPlatformId: int('benefit_platform_id'),
  activityTagCode: varchar('activity_tag_code', { length: 32 }),
  offerSummaryText: varchar('offer_summary_text', { length: 500 }),
  updatedAt: datetime('updated_at', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  publisher: varchar({ length: 255 }),
  publishTime: datetime('publish_time', { mode: 'string', fsp: 6 }),
  likes: int().default(0),
  addCount: int('add_count').default(0),
  taskType: varchar('task_type', { length: 64 }),
  participationDifficulty: varchar('participation_difficulty', { length: 16 }),
  extraConditionsText: text('extra_conditions_text'),
  guideType: varchar('guide_type', { length: 16 }),
  guideText: text('guide_text'),
  guideUrl: varchar('guide_url', { length: 500 }),
  detailedRule: text('detailed_rule'),
}, table => [
  index('idx_task_template_activity_tag_code').on(table.activityTagCode),
  primaryKey({ columns: [table.id], name: 'task_template_id' }),
])

export const taskTemplateLike = mysqlTable('task_template_like', {
  id: int().autoincrement().notNull(),
  taskTemplateId: int('task_template_id').notNull(),
  userId: int('user_id').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  index('idx_task_template_like_template_id').on(table.taskTemplateId),
  index('idx_task_template_like_user_id').on(table.userId),
  primaryKey({ columns: [table.id], name: 'task_template_like_id' }),
  unique('uniq_task_template_like_user').on(table.taskTemplateId, table.userId),
])
