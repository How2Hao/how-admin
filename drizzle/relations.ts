import { relations } from "drizzle-orm/relations";
import { accUsers, accLedgers, accCategories, accTransactions, bank, app, bankCardTemplate, bankCard } from "./schema";

export const accLedgersRelations = relations(accLedgers, ({one, many}) => ({
	accUser: one(accUsers, {
		fields: [accLedgers.userId],
		references: [accUsers.id]
	}),
	accTransactions: many(accTransactions),
}));

export const accUsersRelations = relations(accUsers, ({many}) => ({
	accLedgers: many(accLedgers),
}));

export const accTransactionsRelations = relations(accTransactions, ({one}) => ({
	accCategory: one(accCategories, {
		fields: [accTransactions.categoryId],
		references: [accCategories.id]
	}),
	accLedger: one(accLedgers, {
		fields: [accTransactions.ledgerId],
		references: [accLedgers.id]
	}),
}));

export const accCategoriesRelations = relations(accCategories, ({many}) => ({
	accTransactions: many(accTransactions),
}));

export const appRelations = relations(app, ({one}) => ({
	bank: one(bank, {
		fields: [app.bankId],
		references: [bank.id]
	}),
}));

export const bankRelations = relations(bank, ({many}) => ({
	apps: many(app),
}));

export const bankCardRelations = relations(bankCard, ({one}) => ({
	bankCardTemplate: one(bankCardTemplate, {
		fields: [bankCard.templateId],
		references: [bankCardTemplate.id]
	}),
}));

export const bankCardTemplateRelations = relations(bankCardTemplate, ({many}) => ({
	bankCards: many(bankCard),
}));