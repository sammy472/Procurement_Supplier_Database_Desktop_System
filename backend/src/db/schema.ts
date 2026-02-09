import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "procurement_officer",
  "engineer",
  "viewer",
]);

export const companyEnum = pgEnum("company", ["ONK_GROUP", "ANT_SAVY"]);

export const quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
  "procured",
]);

export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "sent",
  "delivered",
  "closed",
]);

export const tenderStatusEnum = pgEnum("tender_status", [
  "draft",
  "active",
  "closed",
  "cancelled",
]);

export const tenderTaskStatusEnum = pgEnum("tender_task_status", [
  "pending",
  "submitted",
  "deleted",
]);

export const rfqStatusEnum = pgEnum("rfq_status", [
  "active",
  "sent",
  "closed",
]);

export const mailStatusEnum = pgEnum("mail_status", [
  "draft",
  "sent",
  "archived",
  "trashed",
]);

export const recipientTypeEnum = pgEnum("recipient_type", ["to", "cc", "bcc"]);
export const emailProviderEnum = pgEnum("email_provider", ["google", "microsoft"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  company: companyEnum("company").notNull().default("ONK_GROUP"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Refresh tokens
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  address: text("address"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  reliabilityRating: integer("reliability_rating").default(3),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const suppliersSavy = pgTable("suppliers_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  address: text("address"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  reliabilityRating: integer("reliability_rating").default(3),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Supplier documents
export const supplierDocuments = pgTable("supplier_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

export const supplierDocumentsSavy = pgTable("supplier_documents_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliersSavy.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

// Materials table
export const materials = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  technicalSpec: text("technical_spec"),
  category: varchar("category", { length: 100 }),
  partNumber: varchar("part_number", { length: 100 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  brand: varchar("brand", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 100 }),
  defaultSupplierId: uuid("default_supplier_id").references(() => suppliers.id),
  minimumStockLevel: integer("minimum_stock_level").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const materialsSavy = pgTable("materials_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  technicalSpec: text("technical_spec"),
  category: varchar("category", { length: 100 }),
  partNumber: varchar("part_number", { length: 100 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  brand: varchar("brand", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 100 }),
  defaultSupplierId: uuid("default_supplier_id").references(() => suppliersSavy.id),
  minimumStockLevel: integer("minimum_stock_level").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Material-supplier links
export const materialSuppliers = pgTable("material_suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const materialSuppliersSavy = pgTable("material_suppliers_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").notNull().references(() => materialsSavy.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliersSavy.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Price history
export const priceHistory = pgTable("price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  dateQuoted: timestamp("date_quoted").notNull().defaultNow(),
  availabilityStatus: varchar("availability_status", { length: 50 }),
  warrantyNotes: text("warranty_notes"),
  leadTime: integer("lead_time"), // in days
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const priceHistorySavy = pgTable("price_history_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").notNull().references(() => materialsSavy.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliersSavy.id, { onDelete: "cascade" }),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  dateQuoted: timestamp("date_quoted").notNull().defaultNow(),
  availabilityStatus: varchar("availability_status", { length: 50 }),
  warrantyNotes: text("warranty_notes"),
  leadTime: integer("lead_time"), // in days
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Quotations
export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  quotationNumber: varchar("quotation_number", { length: 50 }).notNull().unique(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientAddress: text("client_address"),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  projectTitle: varchar("project_title", { length: 255 }),
  projectReference: varchar("project_reference", { length: 100 }),
  preparedBy: uuid("prepared_by").notNull().references(() => users.id),
  currency: varchar("currency", { length: 3 }).notNull().default("GHC"),
  lineItems: jsonb("line_items").notNull(), // Array of {materialId, description, qty, unitPrice, total}
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  nhilRate: decimal("nhil_rate", { precision: 5, scale: 2 }),
  getfundRate: decimal("getfund_rate", { precision: 5, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  deliveryPeriod: varchar("delivery_period", { length: 255 }),
  validityPeriod: integer("validity_period"), // in days
  termsAndConditions: text("terms_and_conditions"),
  status: quotationStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quotationsSavy = pgTable("quotations_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  quotationNumber: varchar("quotation_number", { length: 50 }).notNull().unique(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientAddress: text("client_address"),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  projectTitle: varchar("project_title", { length: 255 }),
  projectReference: varchar("project_reference", { length: 100 }),
  preparedBy: uuid("prepared_by").notNull().references(() => users.id),
  currency: varchar("currency", { length: 3 }).notNull().default("GHC"),
  lineItems: jsonb("line_items").notNull(), // Array of {materialId, description, qty, unitPrice, total}
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  nhilRate: decimal("nhil_rate", { precision: 5, scale: 2 }),
  getfundRate: decimal("getfund_rate", { precision: 5, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  deliveryPeriod: varchar("delivery_period", { length: 255 }),
  validityPeriod: integer("validity_period"), // in days
  termsAndConditions: text("terms_and_conditions"),
  status: quotationStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Material requests
export const materialRequests = pgTable("material_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestNumber: varchar("request_number", { length: 50 })
    .notNull()
    .unique(),
  requestingEngineer: uuid("requesting_engineer")
    .notNull()
    .references(() => users.id),
  department: varchar("department", { length: 100 }),
  project: varchar("project", { length: 255 }),
  items: jsonb("items").notNull(), // Array of {materialId, quantity, description}
  justification: text("justification"),
  urgencyLevel: varchar("urgency_level", { length: 50 }).default("normal"),
  attachmentPath: varchar("attachment_path", { length: 500 }),
  status: requestStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const materialRequestsSavy = pgTable("material_requests_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestNumber: varchar("request_number", { length: 50 })
    .notNull()
    .unique(),
  requestingEngineer: uuid("requesting_engineer")
    .notNull()
    .references(() => users.id),
  department: varchar("department", { length: 100 }),
  project: varchar("project", { length: 255 }),
  items: jsonb("items").notNull(), // Array of {materialId, quantity, description}
  justification: text("justification"),
  urgencyLevel: varchar("urgency_level", { length: 50 }).default("normal"),
  attachmentPath: varchar("attachment_path", { length: 500 }),
  status: requestStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Material documents
export const materialDocuments = pgTable("material_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

export const materialDocumentsSavy = pgTable("material_documents_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materialsSavy.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

// Material request documents
export const materialRequestDocuments = pgTable("material_request_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => materialRequests.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

export const materialRequestDocumentsSavy = pgTable("material_request_documents_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => materialRequestsSavy.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

export const mailMessages = pgTable("mail_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id"),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  subject: varchar("subject", { length: 255 }).notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  status: mailStatusEnum("status").notNull().default("sent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mailMessagesSavy = pgTable("mail_messages_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id"),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  subject: varchar("subject", { length: 255 }).notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  status: mailStatusEnum("status").notNull().default("sent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mailRecipients = pgTable("mail_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => mailMessages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: recipientTypeEnum("type").notNull().default("to"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mailRecipientsSavy = pgTable("mail_recipients_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => mailMessagesSavy.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: recipientTypeEnum("type").notNull().default("to"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mailAttachments = pgTable("mail_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => mailMessages.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 100 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

export const mailAttachmentsSavy = pgTable("mail_attachments_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => mailMessagesSavy.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 100 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
});

export const emailAccounts = pgTable("email_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: emailProviderEnum("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailAccountsSavy = pgTable("email_accounts_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: emailProviderEnum("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Purchase orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  quotationId: uuid("quotation_id").references(() => quotations.id),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  currency: varchar("currency", { length: 3 }).notNull().default("GHC"),
  lineItems: jsonb("line_items").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  paymentTerms: text("payment_terms"),
  status: poStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const purchaseOrdersSavy = pgTable("purchase_orders_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  quotationId: uuid("quotation_id").references(() => quotationsSavy.id),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliersSavy.id),
  currency: varchar("currency", { length: 3 }).notNull().default("GHC"),
  lineItems: jsonb("line_items").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  paymentTerms: text("payment_terms"),
  status: poStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const tenders = pgTable("tenders", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  deadline: timestamp("deadline").notNull(),
  status: tenderStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tendersSavy = pgTable("tenders_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  deadline: timestamp("deadline").notNull(),
  status: tenderStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenderTasks = pgTable("tender_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").notNull().references(() => users.id),
  status: tenderTaskStatusEnum("status").notNull().default("pending"),
  fileName: varchar("file_name", { length: 255 }),
  filePath: varchar("file_path", { length: 500 }),
  fileType: varchar("file_type", { length: 100 }),
  submittedAt: timestamp("submitted_at"),
  deletedAt: timestamp("deleted_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenderTasksSavy = pgTable("tender_tasks_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tendersSavy.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").notNull().references(() => users.id),
  status: tenderTaskStatusEnum("status").notNull().default("pending"),
  fileName: varchar("file_name", { length: 255 }),
  filePath: varchar("file_path", { length: 500 }),
  fileType: varchar("file_type", { length: 100 }),
  submittedAt: timestamp("submitted_at"),
  deletedAt: timestamp("deleted_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rfqs = pgTable("rfqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  senderAddress: text("sender_address").notNull(),
  items: jsonb("items").notNull(),
  openDate: timestamp("open_date").notNull(),
  closeDate: timestamp("close_date").notNull(),
  status: rfqStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rfqsSavy = pgTable("rfqs_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  senderAddress: text("sender_address").notNull(),
  items: jsonb("items").notNull(),
  openDate: timestamp("open_date").notNull(),
  closeDate: timestamp("close_date").notNull(),
  status: rfqStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rfqAssignments = pgTable("rfq_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
  assigneeId: uuid("assignee_id").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rfqAssignmentsSavy = pgTable("rfq_assignments_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  rfqId: uuid("rfq_id").notNull().references(() => rfqsSavy.id, { onDelete: "cascade" }),
  assigneeId: uuid("assignee_id").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
// Activity logs / Audit trail
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // create, update, delete, approve, etc.
  entityType: varchar("entity_type", { length: 50 }).notNull(), // supplier, material, quotation, etc.
  entityId: uuid("entity_id"),
  description: text("description"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogsSavy = pgTable("activity_logs_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // create, update, delete, approve, etc.
  entityType: varchar("entity_type", { length: 50 }).notNull(), // supplier, material, quotation, etc.
  entityId: uuid("entity_id"),
  description: text("description"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notification read status (tracks which users have read which activity logs)
export const notificationReadStatus = pgTable("notification_read_status", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityLogId: uuid("activity_log_id").notNull().references(() => activityLogs.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationReadStatusSavy = pgTable("notification_read_status_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityLogId: uuid("activity_log_id").notNull().references(() => activityLogsSavy.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  quotations: many(quotations),
  materialRequests: many(materialRequests),
  activityLogs: many(activityLogs),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  documents: many(supplierDocuments),
  materials: many(materials),
  materialSuppliers: many(materialSuppliers),
  priceHistory: many(priceHistory),
  purchaseOrders: many(purchaseOrders),
}));

export const suppliersSavyRelations = relations(suppliersSavy, ({ many }) => ({
  documents: many(supplierDocumentsSavy),
  materials: many(materialsSavy),
  materialSuppliers: many(materialSuppliersSavy),
  priceHistory: many(priceHistorySavy),
  purchaseOrders: many(purchaseOrdersSavy),
}));

export const materialsRelations = relations(materials, ({ many, one }) => ({
  defaultSupplier: one(suppliers, {
    fields: [materials.defaultSupplierId],
    references: [suppliers.id],
  }),
  materialSuppliers: many(materialSuppliers),
  priceHistory: many(priceHistory),
  documents: many(materialDocuments),
}));

export const materialsSavyRelations = relations(materialsSavy, ({ many, one }) => ({
  defaultSupplier: one(suppliersSavy, {
    fields: [materialsSavy.defaultSupplierId],
    references: [suppliersSavy.id],
  }),
  materialSuppliers: many(materialSuppliersSavy),
  priceHistory: many(priceHistorySavy),
  documents: many(materialDocumentsSavy),
}));

export const materialRequestsRelations = relations(materialRequests, ({ many }) => ({
  documents: many(materialRequestDocuments),
}));

export const materialRequestsSavyRelations = relations(materialRequestsSavy, ({ many }) => ({
  documents: many(materialRequestDocumentsSavy),
}));

export const materialRequestDocumentsRelations = relations(materialRequestDocuments, ({ one }) => ({
  materialRequest: one(materialRequests, {
    fields: [materialRequestDocuments.requestId],
    references: [materialRequests.id],
  }),
}));

export const materialRequestDocumentsSavyRelations = relations(materialRequestDocumentsSavy, ({ one }) => ({
  materialRequest: one(materialRequestsSavy, {
    fields: [materialRequestDocumentsSavy.requestId],
    references: [materialRequestsSavy.id],
  }),
}));

export const materialDocumentsRelations = relations(materialDocuments, ({ one }) => ({
  material: one(materials, {
    fields: [materialDocuments.materialId],
    references: [materials.id],
  }),
}));

export const materialDocumentsSavyRelations = relations(materialDocumentsSavy, ({ one }) => ({
  material: one(materialsSavy, {
    fields: [materialDocumentsSavy.materialId],
    references: [materialsSavy.id],
  }),
}));

export const tendersRelations = relations(tenders, ({ many, one }) => ({
  tasks: many(tenderTasks),
  createdByUser: one(users, {
    fields: [tenders.createdBy],
    references: [users.id],
  }),
}));

export const tendersSavyRelations = relations(tendersSavy, ({ many, one }) => ({
  tasks: many(tenderTasksSavy),
  createdByUser: one(users, {
    fields: [tendersSavy.createdBy],
    references: [users.id],
  }),
}));

export const tenderTasksRelations = relations(tenderTasks, ({ one }) => ({
  tender: one(tenders, {
    fields: [tenderTasks.tenderId],
    references: [tenders.id],
  }),
  assignee: one(users, {
    fields: [tenderTasks.assigneeId],
    references: [users.id],
  }),
}));

export const tenderTasksSavyRelations = relations(tenderTasksSavy, ({ one }) => ({
  tender: one(tendersSavy, {
    fields: [tenderTasksSavy.tenderId],
    references: [tendersSavy.id],
  }),
  assignee: one(users, {
    fields: [tenderTasksSavy.assigneeId],
    references: [users.id],
  }),
}));

export const mailMessagesRelations = relations(mailMessages, ({ many, one }) => ({
  recipients: many(mailRecipients),
  attachments: many(mailAttachments),
  sender: one(users, {
    fields: [mailMessages.senderId],
    references: [users.id],
  }),
}));

export const mailMessagesSavyRelations = relations(mailMessagesSavy, ({ many, one }) => ({
  recipients: many(mailRecipientsSavy),
  attachments: many(mailAttachmentsSavy),
  sender: one(users, {
    fields: [mailMessagesSavy.senderId],
    references: [users.id],
  }),
}));

export const mailRecipientsRelations = relations(mailRecipients, ({ one }) => ({
  message: one(mailMessages, {
    fields: [mailRecipients.messageId],
    references: [mailMessages.id],
  }),
  user: one(users, {
    fields: [mailRecipients.userId],
    references: [users.id],
  }),
}));

export const mailRecipientsSavyRelations = relations(mailRecipientsSavy, ({ one }) => ({
  message: one(mailMessagesSavy, {
    fields: [mailRecipientsSavy.messageId],
    references: [mailMessagesSavy.id],
  }),
  user: one(users, {
    fields: [mailRecipientsSavy.userId],
    references: [users.id],
  }),
}));

export const mailAttachmentsRelations = relations(mailAttachments, ({ one }) => ({
  message: one(mailMessages, {
    fields: [mailAttachments.messageId],
    references: [mailMessages.id],
  }),
  uploadedByUser: one(users, {
    fields: [mailAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const mailAttachmentsSavyRelations = relations(mailAttachmentsSavy, ({ one }) => ({
  message: one(mailMessagesSavy, {
    fields: [mailAttachmentsSavy.messageId],
    references: [mailMessagesSavy.id],
  }),
  uploadedByUser: one(users, {
    fields: [mailAttachmentsSavy.uploadedBy],
    references: [users.id],
  }),
}));

// Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  quotationNumber: varchar("quotation_number", { length: 50 }),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientAddress: text("client_address"),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  baseInvoiceId: varchar("base_invoice_id", { length: 100 }),
  pricingRuleSnapshot: jsonb("pricing_rule_snapshot"),
  companyProfileSnapshot: jsonb("company_profile_snapshot"),
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  pdfPath: varchar("pdf_path", { length: 500 }),
  status: varchar("status", { length: 50 }).default("generated"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const invoicesSavy = pgTable("invoices_savy", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  quotationNumber: varchar("quotation_number", { length: 50 }),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientAddress: text("client_address"),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 50 }),
  baseInvoiceId: varchar("base_invoice_id", { length: 100 }),
  pricingRuleSnapshot: jsonb("pricing_rule_snapshot"),
  companyProfileSnapshot: jsonb("company_profile_snapshot"),
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  pdfPath: varchar("pdf_path", { length: 500 }),
  status: varchar("status", { length: 50 }).default("generated"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Invoice Relations
export const invoicesRelations = relations(invoices, ({ one }) => ({
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
}));

export const invoicesSavyRelations = relations(invoicesSavy, ({ one }) => ({
  creator: one(users, {
    fields: [invoicesSavy.createdBy],
    references: [users.id],
  }),
}));
