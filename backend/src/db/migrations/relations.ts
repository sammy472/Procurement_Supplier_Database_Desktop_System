import { relations } from "drizzle-orm/relations";
import { users, activityLogs, materialRequests, suppliers, materials, materialSuppliers, passwordResetTokens, priceHistory, quotations, purchaseOrders, refreshTokens, supplierDocuments, materialDocuments, materialRequestDocuments, notificationReadStatus, mailMessages, mailRecipients, tenders, tenderTasks, mailAttachments } from "./schema";

export const activityLogsRelations = relations(activityLogs, ({one, many}) => ({
	user: one(users, {
		fields: [activityLogs.userId],
		references: [users.id]
	}),
	notificationReadStatuses: many(notificationReadStatus),
}));

export const usersRelations = relations(users, ({many}) => ({
	activityLogs: many(activityLogs),
	materialRequests_requestingEngineer: many(materialRequests, {
		relationName: "materialRequests_requestingEngineer_users_id"
	}),
	materialRequests_approvedBy: many(materialRequests, {
		relationName: "materialRequests_approvedBy_users_id"
	}),
	materials: many(materials),
	suppliers: many(suppliers),
	passwordResetTokens: many(passwordResetTokens),
	priceHistories: many(priceHistory),
	purchaseOrders: many(purchaseOrders),
	refreshTokens: many(refreshTokens),
	supplierDocuments: many(supplierDocuments),
	quotations: many(quotations),
	materialDocuments: many(materialDocuments),
	materialRequestDocuments: many(materialRequestDocuments),
	notificationReadStatuses: many(notificationReadStatus),
	mailRecipients: many(mailRecipients),
	tenders: many(tenders),
	tenderTasks: many(tenderTasks),
	mailMessages: many(mailMessages),
	mailAttachments: many(mailAttachments),
}));

export const materialRequestsRelations = relations(materialRequests, ({one, many}) => ({
	user_requestingEngineer: one(users, {
		fields: [materialRequests.requestingEngineer],
		references: [users.id],
		relationName: "materialRequests_requestingEngineer_users_id"
	}),
	user_approvedBy: one(users, {
		fields: [materialRequests.approvedBy],
		references: [users.id],
		relationName: "materialRequests_approvedBy_users_id"
	}),
	materialRequestDocuments: many(materialRequestDocuments),
}));

export const materialsRelations = relations(materials, ({one, many}) => ({
	supplier: one(suppliers, {
		fields: [materials.defaultSupplierId],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [materials.createdBy],
		references: [users.id]
	}),
	materialSuppliers: many(materialSuppliers),
	priceHistories: many(priceHistory),
	materialDocuments: many(materialDocuments),
}));

export const suppliersRelations = relations(suppliers, ({one, many}) => ({
	materials: many(materials),
	materialSuppliers: many(materialSuppliers),
	user: one(users, {
		fields: [suppliers.createdBy],
		references: [users.id]
	}),
	priceHistories: many(priceHistory),
	purchaseOrders: many(purchaseOrders),
	supplierDocuments: many(supplierDocuments),
}));

export const materialSuppliersRelations = relations(materialSuppliers, ({one}) => ({
	material: one(materials, {
		fields: [materialSuppliers.materialId],
		references: [materials.id]
	}),
	supplier: one(suppliers, {
		fields: [materialSuppliers.supplierId],
		references: [suppliers.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const priceHistoryRelations = relations(priceHistory, ({one}) => ({
	material: one(materials, {
		fields: [priceHistory.materialId],
		references: [materials.id]
	}),
	supplier: one(suppliers, {
		fields: [priceHistory.supplierId],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [priceHistory.createdBy],
		references: [users.id]
	}),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({one}) => ({
	quotation: one(quotations, {
		fields: [purchaseOrders.quotationId],
		references: [quotations.id]
	}),
	supplier: one(suppliers, {
		fields: [purchaseOrders.supplierId],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [purchaseOrders.createdBy],
		references: [users.id]
	}),
}));

export const quotationsRelations = relations(quotations, ({one, many}) => ({
	purchaseOrders: many(purchaseOrders),
	user: one(users, {
		fields: [quotations.preparedBy],
		references: [users.id]
	}),
}));

export const refreshTokensRelations = relations(refreshTokens, ({one}) => ({
	user: one(users, {
		fields: [refreshTokens.userId],
		references: [users.id]
	}),
}));

export const supplierDocumentsRelations = relations(supplierDocuments, ({one}) => ({
	supplier: one(suppliers, {
		fields: [supplierDocuments.supplierId],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [supplierDocuments.uploadedBy],
		references: [users.id]
	}),
}));

export const materialDocumentsRelations = relations(materialDocuments, ({one}) => ({
	material: one(materials, {
		fields: [materialDocuments.materialId],
		references: [materials.id]
	}),
	user: one(users, {
		fields: [materialDocuments.uploadedBy],
		references: [users.id]
	}),
}));

export const materialRequestDocumentsRelations = relations(materialRequestDocuments, ({one}) => ({
	materialRequest: one(materialRequests, {
		fields: [materialRequestDocuments.requestId],
		references: [materialRequests.id]
	}),
	user: one(users, {
		fields: [materialRequestDocuments.uploadedBy],
		references: [users.id]
	}),
}));

export const notificationReadStatusRelations = relations(notificationReadStatus, ({one}) => ({
	user: one(users, {
		fields: [notificationReadStatus.userId],
		references: [users.id]
	}),
	activityLog: one(activityLogs, {
		fields: [notificationReadStatus.activityLogId],
		references: [activityLogs.id]
	}),
}));

export const mailRecipientsRelations = relations(mailRecipients, ({one}) => ({
	mailMessage: one(mailMessages, {
		fields: [mailRecipients.messageId],
		references: [mailMessages.id]
	}),
	user: one(users, {
		fields: [mailRecipients.userId],
		references: [users.id]
	}),
}));

export const mailMessagesRelations = relations(mailMessages, ({one, many}) => ({
	mailRecipients: many(mailRecipients),
	user: one(users, {
		fields: [mailMessages.senderId],
		references: [users.id]
	}),
	mailAttachments: many(mailAttachments),
}));

export const tendersRelations = relations(tenders, ({one, many}) => ({
	user: one(users, {
		fields: [tenders.createdBy],
		references: [users.id]
	}),
	tenderTasks: many(tenderTasks),
}));

export const tenderTasksRelations = relations(tenderTasks, ({one}) => ({
	tender: one(tenders, {
		fields: [tenderTasks.tenderId],
		references: [tenders.id]
	}),
	user: one(users, {
		fields: [tenderTasks.assigneeId],
		references: [users.id]
	}),
}));

export const mailAttachmentsRelations = relations(mailAttachments, ({one}) => ({
	mailMessage: one(mailMessages, {
		fields: [mailAttachments.messageId],
		references: [mailMessages.id]
	}),
	user: one(users, {
		fields: [mailAttachments.uploadedBy],
		references: [users.id]
	}),
}));