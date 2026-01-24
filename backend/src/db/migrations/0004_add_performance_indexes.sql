-- Enable trigram extension for fast LIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON suppliers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_email_trgm ON suppliers USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_contact_person_trgm ON suppliers USING GIN (contact_person gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers (category);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers (created_at);

-- Materials
CREATE INDEX IF NOT EXISTS idx_materials_name_trgm ON materials USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materials_part_number_trgm ON materials USING GIN (part_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materials_description_trgm ON materials USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials (category);
CREATE INDEX IF NOT EXISTS idx_materials_brand ON materials (brand);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials (created_at);

-- Price History
CREATE INDEX IF NOT EXISTS idx_price_history_material_id ON price_history (material_id);
CREATE INDEX IF NOT EXISTS idx_price_history_supplier_id ON price_history (supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date_quoted ON price_history (date_quoted);

-- Quotations
CREATE INDEX IF NOT EXISTS idx_quotations_number_trgm ON quotations USING GIN (quotation_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_quotations_client_name_trgm ON quotations USING GIN (client_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_quotations_project_title_trgm ON quotations USING GIN (project_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_quotations_project_reference_trgm ON quotations USING GIN (project_reference gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations (status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations (created_at);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number_trgm ON purchase_orders USING GIN (po_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders (created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders (supplier_id);

-- Material Requests
CREATE INDEX IF NOT EXISTS idx_material_requests_number_trgm ON material_requests USING GIN (request_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_material_requests_project_trgm ON material_requests USING GIN (project gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_material_requests_department ON material_requests (department);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests (status);
CREATE INDEX IF NOT EXISTS idx_material_requests_created_at ON material_requests (created_at);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

-- Supplier Documents
CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents (supplier_id);

-- Material Documents
CREATE INDEX IF NOT EXISTS idx_material_documents_material_id ON material_documents (material_id);
