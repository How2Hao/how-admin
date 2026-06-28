import { relations } from 'drizzle-orm/relations'
import {
  accCategories,
  accLedgers,
  accTransactions,
  accUsers,
  app,
  bank,
  bankCard,
  bankCardTemplate,
  benefitPayPlatform,
  job,
  jobRecurring,
  jobRecurringOccurrence,
  jobTemplate,
  reminderTemplate,
  task,
  taskTemplate,
  taskTemplateLike,
  userIdentities,
  users,
  userSessions,
} from './schema'

export const accLedgersRelations = relations(accLedgers, ({ one, many }) => ({
  user: one(users, {
    fields: [accLedgers.userId],
    references: [users.id],
  }),
  accTransactions: many(accTransactions),
}))

export const usersRelations = relations(users, ({ many }) => ({
  accLedgers: many(accLedgers),
  accUsers: many(accUsers),
  bankCards: many(bankCard),
  jobs: many(job),
  tasks: many(task),
  taskTemplateLikes: many(taskTemplateLike),
  userIdentities: many(userIdentities),
  userSessions: many(userSessions),
}))

export const accTransactionsRelations = relations(accTransactions, ({ one }) => ({
  benefitPayPlatform: one(benefitPayPlatform, {
    fields: [accTransactions.benefitPayPlatformId],
    references: [benefitPayPlatform.id],
  }),
  accCategory: one(accCategories, {
    fields: [accTransactions.categoryId],
    references: [accCategories.id],
  }),
  accLedger: one(accLedgers, {
    fields: [accTransactions.ledgerId],
    references: [accLedgers.id],
  }),
}))

export const benefitPayPlatformRelations = relations(benefitPayPlatform, ({ many }) => ({
  accTransactions: many(accTransactions),
}))

export const accCategoriesRelations = relations(accCategories, ({ many }) => ({
  accTransactions: many(accTransactions),
}))

export const accUsersRelations = relations(accUsers, ({ one }) => ({
  user: one(users, {
    fields: [accUsers.userId],
    references: [users.id],
  }),
}))

export const appRelations = relations(app, ({ one }) => ({
  bank: one(bank, {
    fields: [app.bankId],
    references: [bank.id],
  }),
}))

export const bankRelations = relations(bank, ({ many }) => ({
  apps: many(app),
}))

export const bankCardRelations = relations(bankCard, ({ one }) => ({
  user: one(users, {
    fields: [bankCard.userId],
    references: [users.id],
  }),
  bankCardTemplate: one(bankCardTemplate, {
    fields: [bankCard.templateId],
    references: [bankCardTemplate.id],
  }),
}))

export const bankCardTemplateRelations = relations(bankCardTemplate, ({ many }) => ({
  bankCards: many(bankCard),
}))

export const taskRelations = relations(task, ({ one }) => ({
  user: one(users, {
    fields: [task.userId],
    references: [users.id],
  }),
  reminderTemplate: one(reminderTemplate, {
    fields: [task.reminderTemplateId],
    references: [reminderTemplate.id],
  }),
  sourceJob: one(job, {
    fields: [task.sourceJobId],
    references: [job.id],
  }),
  sourceJobOccurrence: one(jobRecurringOccurrence, {
    fields: [task.sourceJobOccurrenceId],
    references: [jobRecurringOccurrence.id],
  }),
}))

export const taskTemplateRelations = relations(taskTemplate, ({ one, many }) => ({
  reminderTemplate: one(reminderTemplate, {
    fields: [taskTemplate.reminderTemplateId],
    references: [reminderTemplate.id],
  }),
  jobTemplate: one(jobTemplate, {
    fields: [taskTemplate.jobTemplateId],
    references: [jobTemplate.id],
  }),
  reminderTemplates: many(reminderTemplate),
  jobTemplates: many(jobTemplate),
  jobs: many(job),
}))

export const reminderTemplateRelations = relations(reminderTemplate, ({ one, many }) => ({
  taskTemplate: one(taskTemplate, {
    fields: [reminderTemplate.taskTemplateId],
    references: [taskTemplate.id],
  }),
  tasks: many(task),
  jobTemplates: many(jobTemplate),
}))

export const jobTemplateRelations = relations(jobTemplate, ({ one, many }) => ({
  taskTemplate: one(taskTemplate, {
    fields: [jobTemplate.taskTemplateId],
    references: [taskTemplate.id],
  }),
  reminderTemplate: one(reminderTemplate, {
    fields: [jobTemplate.reminderTemplateId],
    references: [reminderTemplate.id],
  }),
  jobs: many(job),
}))

export const jobRelations = relations(job, ({ one, many }) => ({
  user: one(users, {
    fields: [job.userId],
    references: [users.id],
  }),
  jobTemplate: one(jobTemplate, {
    fields: [job.jobTemplateId],
    references: [jobTemplate.id],
  }),
  taskTemplate: one(taskTemplate, {
    fields: [job.taskTemplateId],
    references: [taskTemplate.id],
  }),
  recurringRule: many(jobRecurring),
  occurrences: many(jobRecurringOccurrence),
  generatedTasks: many(task),
}))

export const jobRecurringRelations = relations(jobRecurring, ({ one }) => ({
  job: one(job, {
    fields: [jobRecurring.jobId],
    references: [job.id],
  }),
}))

export const jobRecurringOccurrenceRelations = relations(jobRecurringOccurrence, ({ one, many }) => ({
  job: one(job, {
    fields: [jobRecurringOccurrence.jobId],
    references: [job.id],
  }),
  generatedTasks: many(task),
}))

export const taskTemplateLikeRelations = relations(taskTemplateLike, ({ one }) => ({
  user: one(users, {
    fields: [taskTemplateLike.userId],
    references: [users.id],
  }),
}))

export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userIdentities.userId],
    references: [users.id],
  }),
}))

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}))
