export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  code?: string;
}

export interface BaseInvoice {
  items: InvoiceItem[];
  metadata?: Record<string, any>;
}

export type RoundingRule = 'UP' | 'DOWN' | 'NEAREST';

export interface PricingRule {
  marginPercent: number; // e.g., 20 for 20%
  discountPercent?: number; // e.g., 5 for 5%
  fixedMarkup?: number; // e.g., 100 added to total or item? Usually item.
  roundingRule: RoundingRule;
  varianceRangePercent?: number; // e.g., 2 for +/- 2% random variance
}

export interface CompanyProfile {
  id: string;
  name: string;
  address: string;
  logoBase64?: string; // or path
  footerNotes?: string;
  currency: string;
  email?: string;
  phone?: string;
  primaryColor?: string;
  secondaryColor?: string;
  layoutStyle?: 'modern' | 'classic' | 'minimal';
  fontFamily?: 'Helvetica' | 'Arial' | 'Georgia' | 'Times New Roman' | 'Trebuchet MS';
  fontSize?: number;
  termsAndConditions?: string;
  deliveryTerms?: string;
  validityPeriod?: string;
  paymentTerms?: string;
  priceColumnName?: string;
  totalColumnName?: string;
}

export interface InvoiceVariant {
  id: string;
  baseInvoiceId: string;
  companyProfile: CompanyProfile;
  items: InvoiceItem[]; // Transformed items
  subtotal: number;
  taxTotal: number;
  total: number;
  pricingRuleUsed: PricingRule;
  generatedAt: string; // ISO date
  pdfPath?: string;
}

export interface GenerationRequest {
  baseInvoice: BaseInvoice;
  variants: {
    companyProfile: CompanyProfile;
    pricingRule: PricingRule;
    count: number; // How many variants to generate for this profile (usually 1, but maybe multiple with variance)
  }[];
}

export interface GenerationResult {
  success: boolean;
  variants: InvoiceVariant[];
  zipPath?: string;
  errors?: string[];
}
