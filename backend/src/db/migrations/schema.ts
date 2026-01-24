import { pgTable, unique, uuid, varchar, boolean, timestamp, foreignKey, text, jsonb, integer, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const mailStatus = pgEnum("mail_status", ['draft', 'sent', 'archived', 'trashed'])
export const poStatus = pgEnum("po_status", ['draft', 'sent', 'delivered', 'closed'])
export const quotationStatus = pgEnum("quotation_status", ['draft', 'sent', 'accepted', 'rejected', 'expired'])
export const recipientType = pgEnum("recipient_type", ['to', 'cc', 'bcc'])
export const requestStatus = pgEnum("request_status", ['pending', 'approved', 'rejected', 'procured'])
export const tenderStatus = pgEnum("tender_status", ['draft', 'active', 'closed', 'cancelled'])
export const tenderTaskStatus = pgEnum("tender_task_status", ['pending', 'submitted', 'deleted'])
export const userRole = pgEnum("user_role", ['admin', 'procurement_officer', 'engineer', 'viewer'])


export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	role: userRole().default('viewer').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const activityLogs = pgTable("activity_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	action: varchar({ length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: uuid("entity_id"),
	description: text(),
	previousValue: jsonb("previous_value"),
	newValue: jsonb("new_value"),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activity_logs_user_id_users_id_fk"
		}),
]);

export const materialRequests = pgTable("material_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	requestNumber: varchar("request_number", { length: 50 }).notNull(),
	requestingEngineer: uuid("requesting_engineer").notNull(),
	department: varchar({ length: 100 }),
	project: varchar({ length: 255 }),
	items: jsonb().notNull(),
	justification: text(),
	urgencyLevel: varchar("urgency_level", { length: 50 }).default('normal'),
	attachmentPath: varchar("attachment_path", { length: 500 }),
	status: requestStatus().default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.requestingEngineer],
			foreignColumns: [users.id],
			name: "material_requests_requesting_engineer_users_id_fk"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "material_requests_approved_by_users_id_fk"
		}),
	unique("material_requests_request_number_unique").on(table.requestNumber),
]);

export const materials = pgTable("materials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	technicalSpec: text("technical_spec"),
	category: varchar({ length: 100 }),
	partNumber: varchar("part_number", { length: 100 }),
	unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
	brand: varchar({ length: 100 }),
	manufacturer: varchar({ length: 100 }),
	defaultSupplierId: uuid("default_supplier_id"),
	minimumStockLevel: integer("minimum_stock_level").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.defaultSupplierId],
			foreignColumns: [suppliers.id],
			name: "materials_default_supplier_id_suppliers_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "materials_created_by_users_id_fk"
		}),
]);

export const materialSuppliers = pgTable("material_suppliers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	materialId: uuid("material_id").notNull(),
	supplierId: uuid("supplier_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "material_suppliers_material_id_materials_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "material_suppliers_supplier_id_suppliers_id_fk"
		}).onDelete("cascade"),
]);

export const suppliers = pgTable("suppliers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }),
	address: text(),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 50 }),
	country: varchar({ length: 100 }),
	contactPerson: varchar("contact_person", { length: 255 }),
	reliabilityRating: integer("reliability_rating").default(3),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "suppliers_created_by_users_id_fk"
		}),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: varchar({ length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const priceHistory = pgTable("price_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	materialId: uuid("material_id").notNull(),
	supplierId: uuid("supplier_id").notNull(),
	unitPrice: numeric("unit_price", { precision: 12, scale:  2 }).notNull(),
	currency: varchar({ length: 3 }).default('USD').notNull(),
	dateQuoted: timestamp("date_quoted", { mode: 'string' }).defaultNow().notNull(),
	availabilityStatus: varchar("availability_status", { length: 50 }),
	warrantyNotes: text("warranty_notes"),
	leadTime: integer("lead_time"),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "price_history_material_id_materials_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "price_history_supplier_id_suppliers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "price_history_created_by_users_id_fk"
		}),
]);

export const purchaseOrders = pgTable("purchase_orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	poNumber: varchar("po_number", { length: 50 }).notNull(),
	quotationId: uuid("quotation_id"),
	supplierId: uuid("supplier_id").notNull(),
	lineItems: jsonb("line_items").notNull(),
	subtotal: numeric({ precision: 12, scale:  2 }).notNull(),
	discount: numeric({ precision: 12, scale:  2 }).default('0'),
	vatRate: numeric("vat_rate", { precision: 5, scale:  2 }).default('0'),
	vatAmount: numeric("vat_amount", { precision: 12, scale:  2 }).default('0'),
	total: numeric({ precision: 12, scale:  2 }).notNull(),
	expectedDeliveryDate: timestamp("expected_delivery_date", { mode: 'string' }),
	paymentTerms: text("payment_terms"),
	status: poStatus().default('draft').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [quotations.id],
			name: "purchase_orders_quotation_id_quotations_id_fk"
		}),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "purchase_orders_supplier_id_suppliers_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "purchase_orders_created_by_users_id_fk"
		}),
	unique("purchase_orders_po_number_unique").on(table.poNumber),
]);

export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: varchar({ length: 500 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "refresh_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("refresh_tokens_token_unique").on(table.token),
]);

export const supplierDocuments = pgTable("supplier_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	supplierId: uuid("supplier_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileType: varchar("file_type", { length: 50 }),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	uploadedBy: uuid("uploaded_by"),
}, (table) => [
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "supplier_documents_supplier_id_suppliers_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "supplier_documents_uploaded_by_users_id_fk"
		}),
]);

export const quotations = pgTable("quotations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quotationNumber: varchar("quotation_number", { length: 50 }).notNull(),
	clientName: varchar("client_name", { length: 255 }).notNull(),
	clientAddress: text("client_address"),
	clientEmail: varchar("client_email", { length: 255 }),
	clientPhone: varchar("client_phone", { length: 50 }),
	projectTitle: varchar("project_title", { length: 255 }),
	projectReference: varchar("project_reference", { length: 100 }),
	preparedBy: uuid("prepared_by").notNull(),
	lineItems: jsonb("line_items").notNull(),
	subtotal: numeric({ precision: 12, scale:  2 }).notNull(),
	vatRate: numeric("vat_rate", { precision: 5, scale:  2 }).default('0'),
	vatAmount: numeric("vat_amount", { precision: 12, scale:  2 }).default('0'),
	total: numeric({ precision: 12, scale:  2 }).notNull(),
	deliveryPeriod: varchar("delivery_period", { length: 255 }),
	validityPeriod: integer("validity_period"),
	termsAndConditions: text("terms_and_conditions"),
	status: quotationStatus().default('draft').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	nhilRate: numeric("nhil_rate", { precision: 5, scale:  2 }),
	getfundRate: numeric("getfund_rate", { precision: 5, scale:  2 }),
	covidRate: numeric("covid_rate", { precision: 5, scale:  2 }),
	paymentTerms: text("payment_terms"),
	deliveryTerms: text("delivery_terms"),
	currency: varchar({ length: 3 }).default('GHC').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.preparedBy],
			foreignColumns: [users.id],
			name: "quotations_prepared_by_users_id_fk"
		}),
	unique("quotations_quotation_number_unique").on(table.quotationNumber),
]);

export const materialDocuments = pgTable("material_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	materialId: uuid("material_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileType: varchar("file_type", { length: 50 }),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	uploadedBy: uuid("uploaded_by"),
}, (table) => [
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "material_documents_material_id_materials_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "material_documents_uploaded_by_users_id_fk"
		}),
]);

export const materialRequestDocuments = pgTable("material_request_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	requestId: uuid("request_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileType: varchar("file_type", { length: 50 }),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	uploadedBy: uuid("uploaded_by"),
}, (table) => [
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [materialRequests.id],
			name: "material_request_documents_request_id_material_requests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "material_request_documents_uploaded_by_users_id_fk"
		}),
]);

export const notificationReadStatus = pgTable("notification_read_status", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	activityLogId: uuid("activity_log_id").notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_read_status_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.activityLogId],
			foreignColumns: [activityLogs.id],
			name: "notification_read_status_activity_log_id_activity_logs_id_fk"
		}).onDelete("cascade"),
]);

export const mailRecipients = pgTable("mail_recipients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	userId: uuid("user_id").notNull(),
	type: recipientType().default('to').notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [mailMessages.id],
			name: "mail_recipients_message_id_mail_messages_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "mail_recipients_user_id_users_id_fk"
		}),
]);

export const tenders = pgTable("tenders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	deadline: timestamp({ mode: 'string' }).notNull(),
	status: tenderStatus().default('active').notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "tenders_created_by_users_id_fk"
		}),
]);

export const tenderTasks = pgTable("tender_tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenderId: uuid("tender_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	assigneeId: uuid("assignee_id").notNull(),
	status: tenderTaskStatus().default('pending').notNull(),
	fileName: varchar("file_name", { length: 255 }),
	filePath: varchar("file_path", { length: 500 }),
	fileType: varchar("file_type", { length: 100 }),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenderId],
			foreignColumns: [tenders.id],
			name: "tender_tasks_tender_id_tenders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assigneeId],
			foreignColumns: [users.id],
			name: "tender_tasks_assignee_id_users_id_fk"
		}),
]);

export const mailMessages = pgTable("mail_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationId: uuid("conversation_id"),
	senderId: uuid("sender_id").notNull(),
	subject: varchar({ length: 255 }).notNull(),
	bodyText: text("body_text"),
	bodyHtml: text("body_html"),
	status: mailStatus().default('sent').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "mail_messages_sender_id_users_id_fk"
		}),
]);

export const mailAttachments = pgTable("mail_attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileType: varchar("file_type", { length: 100 }),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	uploadedBy: uuid("uploaded_by"),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [mailMessages.id],
			name: "mail_attachments_message_id_mail_messages_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "mail_attachments_uploaded_by_users_id_fk"
		}),
]);
