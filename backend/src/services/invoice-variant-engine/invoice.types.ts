export type MarginType = 'percentage' | 'fixed';

export interface BaseInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface NormalizedInvoice {
  items: BaseInvoiceItem[];
}

export interface CompanyProfile {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  currency?: string;
  logoBase64?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
}

export interface BuyerProfile {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface InvoiceMeta {
  taxPercent?: number;
  currency?: string;
  companyProfile?: CompanyProfile;
  footerNotes?: string;
  terms?: string;
  deliveryPeriod?: string;
  invoiceNumber?: string;
  quotationNumber?: string;
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
}

export interface GenerateVariantsPayload {
  baseInvoiceFile?: string;
  numberOfVariants: number;
  marginType: MarginType;
  marginValue: number;
  fluctuationRange: number;
  discountPercent?: number;
  fixedMarkup?: number;
  roundingRule?: 'UP' | 'DOWN' | 'NEAREST';
  invoiceMeta?: InvoiceMeta;
  buyerProfiles?: BuyerProfile[];
  logos?: string[];
  baseInvoice?: NormalizedInvoice;
}

export interface GeneratedInvoice {
  invoiceNumber: string;
  date: Date;
  items: BaseInvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  companyProfile?: CompanyProfile;
  buyerProfile?: BuyerProfile;
  footerNotes?: string;
  terms?: string;
  deliveryPeriod?: string;
  pdfPath?: string;
}

export function formatMoney(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value || 0)).toFixed(2)}`;
  }
}
