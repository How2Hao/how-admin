import { relations } from 'drizzle-orm/relations'
import { accCategories, accLedgers, accTransactions, accUsers, app, bank, bankCard, bankCardTemplate, benefitPayPlatform, task, taskTemplateLike, userIdentities, users, userSessions } from './schema'

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
