import PDFDocument from "pdfkit";
import { Response } from "express";
import path from "path";
import fs from "fs";
import { ToWords } from 'to-words';
import formatNum from "format-num"
const ToWordsConverter = new ToWords({localeCode: 'en-US',});

// Render runs from project root
const baseDir = path.join(process.cwd(),"dist","utils","assets");

//Help function to get major currency unit
type CurrencyCode = "GHC" | "USD" | "EUR" | "GBP" | "CAD" | "NGN";
const currencyMajorUnits: Record<CurrencyCode, string> = {
  GHC: "Cedis",
  USD: "American Dollars",
  EUR: "Euros",
  GBP: "Pounds Sterling",
  CAD: "Canadian Dollars",
  NGN: "Naira",
};

export function getMajorCurrencyUnit(currency: CurrencyCode): string {
  return currencyMajorUnits[currency];
}

//Help function to get minor currency unit
type CurrencyCodeMinorUnit = "GHC" | "USD" | "EUR" | "GBP" | "CAD" | "NGN";

type MinorUnit = {
  singular: string;
  plural: string;
};

const currencyMinorUnits: Record<CurrencyCodeMinorUnit, MinorUnit> = {
  GHC: { singular: "Pesewa", plural: "Pesewas" },
  USD: { singular: "Cent", plural: "Cents" },
  EUR: { singular: "Cent", plural: "Cents" },
  GBP: { singular: "Penny", plural: "Pence" },
  CAD: { singular: "Cent", plural: "Cents" },
  NGN: { singular: "Kobo", plural: "Kobo" }, // invariant plural
};

function getMinorCurrencyUnit(
  currency: CurrencyCodeMinorUnit,
  amount: number
): string {
  const unit = currencyMinorUnits[currency];

  // Treat absolute value 1 as singular, everything else as plural
  return Math.abs(amount) === 1 ? unit.singular : unit.plural;
}


interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuotationData {
  quotationNumber: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectTitle?: string;
  projectReference?: string;
  currency: string;
  lineItems: LineItem[] | string;
  subtotal: string;
  nhilRate?: string;
  getfundRate?: string;
  covidRate?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  deliveryPeriod?: string;
  validityPeriod?: number;
  termsAndConditions?: string;
  createdAt: string;
}

interface PurchaseOrderData {
  poNumber: string;
  supplierName: string;
  supplierAddress?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  lineItems: LineItem[] | string;
  subtotal: string;
  discount: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  createdAt: string;
}

const COMPANY_NAME = "ONK Group Limited";
const COMPANY_ADDRESS = "123 Business Street\nIndustrial Area\nCity, Country";
const COMPANY_PHONE = "+1234567890";
const COMPANY_EMAIL = "info@onkgroup.com";

export const generatePurchaseOrderPDF = (
  po: PurchaseOrderData,
  res: Response,
  inline: boolean = false
) => {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  
  if (inline) {
    // For viewing in browser
    res.setHeader(
      "Content-Disposition",
      `inline; filename=purchase-order-${po.poNumber}.pdf`
    );
  } else {
    // For downloading
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=purchase-order-${po.poNumber}.pdf`
    );
  }

  doc.pipe(res);

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text(COMPANY_NAME, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text(COMPANY_ADDRESS, { align: "center" });
  doc.fontSize(10).text(`Phone: ${COMPANY_PHONE} | Email: ${COMPANY_EMAIL}`, {
    align: "center",
  });
  doc.moveDown(1);

  // Title
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("PURCHASE ORDER", { align: "center", underline: true });
  doc.moveDown(1);

  // PO Details
  doc.fontSize(10).font("Helvetica");
  doc.text(`PO Number: ${po.poNumber}`, 50, doc.y);
  doc.text(
    `Date: ${new Date(po.createdAt).toLocaleDateString()}`,
    350,
    doc.y - 15
  );
  doc.moveDown(1);

  // Supplier Details
  doc.fontSize(12).font("Helvetica-Bold").text("To:", 50, doc.y);
  doc.fontSize(10).font("Helvetica");
  doc.text(po.supplierName);
  if (po.supplierAddress) {
    doc.text(po.supplierAddress);
  }
  if (po.supplierEmail) {
    doc.text(`Email: ${po.supplierEmail}`);
  }
  if (po.supplierPhone) {
    doc.text(`Phone: ${po.supplierPhone}`);
  }
  doc.moveDown(1.5);

  // Line Items Table
  const tableTop = doc.y;
  const itemHeight = 25;
  const pageWidth = doc.page.width - 100;
  const columns = {
    description: { x: 50, width: pageWidth * 0.5 },
    quantity: { x: 50 + pageWidth * 0.5, width: pageWidth * 0.15 },
    unitPrice: { x: 50 + pageWidth * 0.65, width: pageWidth * 0.15 },
    total: { x: 50 + pageWidth * 0.8, width: pageWidth * 0.2 },
  };

  // Table Header
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Description", columns.description.x, tableTop);
  doc.text("Qty", columns.quantity.x, tableTop, { width: columns.quantity.width, align: "right" });
  doc.text("Unit Price", columns.unitPrice.x, tableTop, { width: columns.unitPrice.width, align: "right" });
  doc.text("Total", columns.total.x, tableTop, { width: columns.total.width, align: "right" });

  // Draw line under header
  doc
    .moveTo(50, tableTop + 15)
    .lineTo(pageWidth + 50, tableTop + 15)
    .stroke();

  // Parse line items
  let lineItems: LineItem[] = [];
  if (typeof po.lineItems === "string") {
    try {
      lineItems = JSON.parse(po.lineItems);
    } catch (e) {
      lineItems = [];
    }
  } else {
    lineItems = po.lineItems;
  }

  // Table Rows
  doc.fontSize(9).font("Helvetica");
  let currentY = tableTop + 25;
  lineItems.forEach((item) => {
    if (currentY > doc.page.height - 150) {
      doc.addPage();
      currentY = 50;
    }

    doc.text(item.description || "", columns.description.x, currentY, {
      width: columns.description.width,
    });
    doc.text(
      item.quantity?.toString() || "0",
      columns.quantity.x,
      currentY,
      { width: columns.quantity.width, align: "right" }
    );
    doc.text(
      `$${parseFloat(item.unitPrice?.toString() || "0").toFixed(2)}`,
      columns.unitPrice.x,
      currentY,
      { width: columns.unitPrice.width, align: "right" }
    );
    doc.text(
      `$${parseFloat(item.total?.toString() || "0").toFixed(2)}`,
      columns.total.x,
      currentY,
      { width: columns.total.width, align: "right" }
    );

    currentY += itemHeight;
  });

  // Draw line after items
  doc.moveTo(50, currentY - 10).lineTo(pageWidth + 50, currentY - 10).stroke();
  doc.moveDown(1);

  // Totals
  const totalsY = Math.max(currentY, doc.page.height - 200);
  doc.fontSize(10).font("Helvetica");

  doc.text("Subtotal:", pageWidth - 150, totalsY, { align: "right" });
  doc.text(
    `$${parseFloat(po.subtotal || "0").toFixed(2)}`,
    pageWidth + 50,
    totalsY,
    { align: "right" }
  );

  if (parseFloat(po.discount || "0") > 0) {
    doc.text("Discount:", pageWidth - 150, totalsY + 15, { align: "right" });
    doc.text(
      `-$${parseFloat(po.discount || "0").toFixed(2)}`,
      pageWidth + 50,
      totalsY + 15,
      { align: "right" }
    );
  }

  if (parseFloat(po.vatRate || "0") > 0) {
    doc.text(`VAT (${po.vatRate}%):`, pageWidth - 150, totalsY + 30, {
      align: "right",
    });
    doc.text(
      `$${parseFloat(po.vatAmount || "0").toFixed(2)}`,
      pageWidth + 50,
      totalsY + 30,
      { align: "right" }
    );
  }

  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Total:", pageWidth - 150, totalsY + 50, { align: "right" });
  doc.text(
    `$${parseFloat(po.total || "0").toFixed(2)}`,
    pageWidth + 50,
    totalsY + 50,
    { align: "right" }
  );

  doc.moveDown(2);

  // Additional Information
  doc.fontSize(9).font("Helvetica");
  if (po.expectedDeliveryDate) {
    doc.text(
      `Expected Delivery Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}`
    );
  }
  doc.moveDown(1);

  if (po.paymentTerms) {
    doc.fontSize(9).font("Helvetica-Bold").text("Payment Terms:");
    doc.fontSize(8).font("Helvetica").text(po.paymentTerms, {
      width: pageWidth,
    });
  }

  doc.end();
};

function resolveAssetPath(
  asset: "logo" | "banner" | "stamp",
  company?: string | null
) {
  const defaults: Record<string, string> = {
    logo: path.join(baseDir, "logo.png"),
    banner: path.join(baseDir, "banner.jpg"),
    stamp: path.join(baseDir, "stamp.png"),
  };

  if (company) {
    const candidates = [
      path.join(baseDir, `${company.toLowerCase()}-${asset}.png`),
      path.join(baseDir, `${company.toLowerCase()}-${asset}.jpg`),
      path.join(baseDir, `${company.toLowerCase()}_${asset}.png`),
      path.join(baseDir, `${company.toLowerCase()}_${asset}.jpg`),
    ];

    for (const p of candidates) {
      console.log(`Checking path: ${p}`);
      if (fs.existsSync(p)) return p;
    }
  }

  console.log(`Default path: ${defaults[asset]}`);
  return defaults[asset];
}

export const generatePurchaseOrderPDFNEW = (
  po: PurchaseOrderData & { currency?: string },
  company: string | null | undefined,
  res: Response,
  inline: boolean = false
) => {
  const doc = new PDFDocument({
    margin: 20,
    size: "A4",
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename=purchase-order-${po.poNumber}.pdf`
  );

  doc.pipe(res);

  // Fonts
  doc.registerFont("Helvetica", "Helvetica");
  doc.registerFont("Helvetica-Bold", "Helvetica-Bold");
  doc.registerFont("Times-Roman", "Times-Roman");
  doc.registerFont("Times-Bold", "Times-Bold");

  const bannerPath = resolveAssetPath("banner", company);
  const stampPath = resolveAssetPath("stamp", company);
  const logoPath = resolveAssetPath("logo", company);

  let currentY = 0;

  // Banner
  try {
    doc.image(bannerPath, 0, 0, { width: doc.page.width, height: 100 });
    currentY += 110;
  } catch {
    currentY += 10;
  }

  // Date
  doc
    .fontSize(10)
    .font("Times-Bold")
    .text(
      new Date(po.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      2,
      currentY,
      { align: "left" }
    );
  currentY = doc.y + 20;

  // Supplier block
  doc.fontSize(11).font("Times-Bold").text("Supplier:", 2, currentY);
  currentY += 15;
  doc.fontSize(10).font("Times-Roman");
  doc.text(po.supplierName || "", 2, currentY);
  currentY += 15;
  if (po.supplierAddress) {
    (po.supplierAddress.split("\n")).forEach((line) => {
      doc.text(line.trim(), 2, currentY);
      currentY += 15;
    });
  }
  if (po.supplierEmail) {
    doc.text(`Email: ${po.supplierEmail}`, 2, currentY);
    currentY += 15;
  }
  if (po.supplierPhone) {
    doc.text(`Phone: ${po.supplierPhone}`, 2, currentY);
    currentY += 15;
  }
  currentY = doc.y + 10;

  // Subject
  doc.fontSize(16).font("Times-Bold").text("PURCHASE ORDER", 2, currentY);
  currentY = doc.y + 20;
  doc.fontSize(11).font("Times-Roman").text(`PO Number: ${po.poNumber}`, 2, currentY);
  currentY = doc.y + 20;

  // Logo
  try {
    doc.image(logoPath, doc.page.width - 120, 120, { width: 100 });
  } catch {}

  // Table
  const itemHeight = 30;
  const pageWidth = doc.page.width - 4;
  const toNum = (v: any) => {
    const n = parseFloat(String(v ?? "0").replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const lineItems = parseLineItems(po.lineItems).map((li, idx) => {
    const qty = toNum(li.quantity);
    const unit = toNum(li.unitPrice);
    const tot = li.total != null ? toNum(li.total) : qty * unit;
    return [
      idx + 1,
      li.description,
      qty,
      unit.toFixed(2),
      tot.toFixed(2),
    ];
  });
  if (lineItems.length > 0) {
    doc.table({
      columnStyles: (i: number) =>
        [pageWidth * 0.10, pageWidth * 0.45, pageWidth * 0.15, pageWidth * 0.15, pageWidth * 0.15][i],
      rowStyles: {
        minHeight: itemHeight - 5,
        padding: 5,
        align: { x: "center", y: "bottom" },
        backgroundColor: "#F8F8F8",
      },
    }).row(["No.", "Description", "Qty", "Unit Price", "Total"]);
    lineItems.forEach((row) => {
      doc.table({
        columnStyles: [pageWidth * 0.10, pageWidth * 0.45, pageWidth * 0.15, pageWidth * 0.15, pageWidth * 0.15],
        rowStyles: {
          minHeight: itemHeight - 5,
          padding: 5,
          align: { x: "center", y: "bottom" },
        },
      }).row(row as any);
    });
    currentY = doc.y + 10;
  }

  // Totals
  const currency = po as any;
  const ccy = currency.currency || "GHC";
  const subtotal = toNum(po.subtotal);
  const discountAmount = toNum(po.discount);
  const vatRate = toNum(po.vatRate);
  const taxable = Math.max(subtotal - discountAmount, 0);
  const totals: Array<{ label: string; value: string }> = [
    { label: `SUBTOTAL (${ccy})`, value: subtotal.toFixed(2) },
    { label: `DISCOUNT (${ccy})`, value: discountAmount.toFixed(2) },
    { label: `TAXABLE AMOUNT (${ccy})`, value: taxable.toFixed(2) },
    { label: `VAT (${vatRate.toFixed(2)}%)`, value: toNum(po.vatAmount).toFixed(2) },
    { label: `TOTAL (${ccy})`, value: toNum(po.total).toFixed(2) },
  ];

  doc.fontSize(12).font("Times-Bold");
  totals.forEach((t) => {
    doc.table({
      columnStyles: (i: number) => [pageWidth * 0.85, pageWidth * 0.15][i],
      rowStyles: {
        minHeight: itemHeight - 5,
        padding: 5,
        align: { x: "center", y: "bottom" },
        backgroundColor: "#F0F0F0",
      },
    }).row([t.label.trim(), t.value]);
  });

  currentY = doc.y + 20;

  // Payment terms and expected delivery
  doc.fontSize(10).font("Times-Bold").text("Payment Terms:", 2, currentY);
  currentY += 15;
  doc.fontSize(10).font("Times-Roman").text(po.paymentTerms || "N/A", 2, currentY, {
    width: pageWidth * 0.9,
  });
  currentY += 20;
  if (po.expectedDeliveryDate) {
    doc
      .fontSize(10)
      .font("Times-Bold")
      .text(
        `Expected Delivery Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}`,
        2,
        currentY
      );
    currentY += 20;
  }

  // Stamp
  try {
    doc.image(stampPath, 2, currentY, { width: 150, height: 100 });
  } catch {}

  doc.end();
};

export const generateQuotationPDFNEW = (quotation: QuotationData, res: Response, inline: boolean = false,company:string) => {
  const doc = new PDFDocument({ 
    margin: 20,
    size: 'A4',
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  
  if (inline) {
    res.setHeader(
      "Content-Disposition",
      `inline; filename=quotation-${quotation.quotationNumber}.pdf`
    );
  } else {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=quotation-${quotation.quotationNumber}.pdf`
    );
  }

  doc.pipe(res);

  // Font setup
  doc.registerFont('Helvetica', 'Helvetica');
  doc.registerFont('Helvetica-Bold', 'Helvetica-Bold');
  //new times roman
  doc.registerFont('Times-Roman', 'Times-Roman');
  doc.registerFont('Times-Bold', 'Times-Bold');

  const bannerPath = resolveAssetPath("banner",company);
  const stampPath = resolveAssetPath("stamp",company);
  const logoPath = resolveAssetPath("logo",company);

  // Starting position
  let currentY = 0;

  // Banner Image - Check if file exists or handle gracefully
  try {
    doc.image(bannerPath, 0, 0, { width: doc.page.width, height: 100 });
    currentY += 110;
  } catch (error) {
    console.warn('Banner image not found, continuing without it');
    currentY += 10;
  }

  // Date - Top left corner
  doc.fontSize(10).font('Times-Bold')
    .text(new Date(quotation.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),2, currentY, { align: 'left' });
  
  currentY = 20 + doc.y;

  // Client Details - Left side (like in template)
  doc.fontSize(11).font('Times-Bold').text(quotation.clientName.split('\n')[0] || quotation.clientName, 2, currentY);
  
  currentY = doc.y + 10;
  
  // Process multi-line address
  const clientLines = quotation.clientAddress?.split('\n') || [];
  doc.fontSize(10).font('Times-Bold');
  clientLines.forEach(line => {
    doc.text(line.trim(), 2, currentY);
    currentY += 10;
  });

  currentY = doc.y + 20;

  // Salutation
  doc.fontSize(11).font('Times-Roman').text('Dear Sir/Madam,', 2, currentY);
  
  currentY = doc.y + 30;

  // Subject/Reference
  const subjectText = quotation.projectTitle 
    ? `RE: ${quotation.projectTitle.toUpperCase().trim()}`
    : 'RE: QUOTATION';
  
  doc.fontSize(12).font('Times-Bold')
    .text(subjectText, 2, currentY);
  
  currentY = doc.y + 10;

  // Body text
  //split total amount
  const [whole, fraction] = quotation.total.split('.');
  let lineItemsArray = parseLineItems(quotation.lineItems);
  const lineItemDescriptions = lineItemsArray.map(item => item.description);
  let bodyText = `In relation to the above subject matter, we the undersigned offer to supply the following item${lineItemDescriptions.length > 1 ? 's' : ''}, ${lineItemDescriptions.join(", ")} in accordance to your Request with tender number: ${quotation.projectReference || quotation.quotationNumber}.We hereby, humbly submit our quotation for your perusal. Our quotation is binding upon us.Our offer is in the sum of ${ToWordsConverter.convert(parseInt(whole))} ${getMajorCurrencyUnit(quotation.currency as CurrencyCode)} and ${ToWordsConverter.convert(parseInt(fraction))} ${getMinorCurrencyUnit(quotation.currency as CurrencyCode,parseInt(fraction))} inclusive of all taxes.`;
  doc.fontSize(11).font('Times-Roman').text(bodyText, 2, currentY, {
    width: 500,
    lineGap: 5,
    align: 'justify'
  });
  
  currentY = doc.y + 40;

  // Delivery period
  doc.fontSize(12).font('Times-Bold').text('- Delivery Period', 2, currentY);
  currentY = doc.y + 10;
  doc.fontSize(11).font('Times-Roman')
    .text(`Delivery shall be made within ${quotation.deliveryPeriod || '1 week'} after receipt of a Confirmed Purchase Order.`, 5);
  doc.moveDown();
  currentY = doc.y + 15;

  // Delivery Terms
  doc.fontSize(12).font('Times-Bold').text('- Delivery Terms', 2, currentY);
  currentY = doc.y + 10;
  doc.fontSize(11).font('Times-Roman').text(quotation.deliveryTerms || 'NA', 2, currentY);
  doc.moveDown();
  currentY = doc.y + 15;

  // Tender Validity
  doc.fontSize(12).font('Times-Bold').text('- Tender Validity', 2, currentY);
  currentY = doc.y + 10;
  doc.fontSize(11).font('Times-Roman').text(`Our price contained in our tender submission shall be valid for a period of ${quotation.validityPeriod || 60} days.`, 2, currentY);
  doc.moveDown();
  currentY = doc.y + 15;

  // Terms of Payment
  doc.fontSize(12).font('Times-Bold').text('- Terms of Payment', 2, currentY);
  currentY = doc.y + 10;
  doc.fontSize(11).font('Times-Roman').text(quotation.paymentTerms || '45 days after delivery of invoices', 2, currentY);
  currentY = doc.y + 15;

  // Closing remarks
  doc.fontSize(11).font('Times-Roman').text('I look forward to building a mutually beneficial business relationship with you.', 2, currentY);
  currentY = doc.y + 20;
  doc.text('Thank you.', 2, currentY);
  currentY = doc.y + 35;
  //Insert Stamp Image
  try {
    doc.image(stampPath, 2, currentY, { width: 150, height: 100 });
  } catch (error) {
    console.warn('Stamp image not found, continuing without it');
  }  
  
  currentY = doc.y + 60;

  // Check if we need a new page for PROFORMA INVOICE
  if (currentY + doc.y > doc.page.height) {
    doc.addPage();
    currentY = 10;
  }

  //Insert Logo Image
  try {
    doc.image(logoPath, 2, currentY, { width: 100 ,height: 50});
  } catch (error) {
    console.warn('Logo image not found, continuing without it');
  }

  // PROFORMA INVOICE Section
  doc.fontSize(35).font('Times-Bold').text('PROFORMA INVOICE', doc.page.width*0.25, currentY+30, { align: 'left' });
  
  currentY = doc.y + 30;

  const before = doc.y;
  // Bill To section
  doc.fontSize(14).font('Times-Bold').fillColor("red").text('BILL TO:', 2, currentY, { align: 'right' });
  currentY = doc.y + 10;
  doc.fontSize(12).font('Times-Bold').fillColor("black").text((quotation.clientAddress!.split("\n")).join("\n").trim(), 2, currentY,{align: 'right'});
  
  const after = doc.y;

  currentY = doc.y - (after - before) - 10;
  // Supplier Info (ONK GROUP LIMITED)
  doc.fontSize(14).font('Times-Bold').fillColor("red").text('BILL FROM:', 2, currentY, { align: 'left' });
  currentY = doc.y + 5;
  doc.fontSize(12).font('Times-Bold').fillColor("black").text('ONK GROUP LIMITED', 2, currentY, { align: 'left' });
  currentY = doc.y + 5;
  doc.fontSize(12).font('Times-Bold').text('SUITE 3001-2 FORICO MALL  1986 188', 2, currentY, { align: 'left' });
  currentY = doc.y + 5;
  doc.text('MISSION STREET OSU, ACCRA', 2, currentY, { align: 'left' });
  currentY = doc.y + 5;
  doc.text('030 279 9514 / 053 1986 188', 2, currentY, { align: 'left' });
  currentY = doc.y + 10;

  // Date - Top right corner
  doc.fontSize(12).font('Times-Bold')
    .text(new Date(quotation.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),2, currentY, { align: 'left' });
  
  currentY = doc.y + 30;
  
  currentY = doc.y + 25;
  // First Line Items Table (Summary Table)
  const itemHeight = 35;
  const pageWidth = doc.page.width-4;

  let testLineItems: any[] = parseLineItems(quotation.lineItems);
  testLineItems = testLineItems.map(item => [item.description, item.quantity, formatNum(parseFloat(item.unitPrice?.toString()).toFixed(2)), formatNum(parseFloat(item.total?.toString()).toFixed(2))]);

  doc.table({
    columnStyles: (i)=>{
      return [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15][i];
    },
    rowStyles:{
      backgroundColor: '#D3D3D3',
      height: itemHeight + 30,
      padding: 5,
      align:{x: 'center', y: 'top' },
    }
  }).row(['No.', 'MATERIAL', 'QTY', `UNIT PRICE\n(${quotation.currency})`, `TOTAL\n(${quotation.currency})`]);

  doc.fontSize(12).font('Times-Roman');
  //doc.table({columnStyles: {textOptions: {align: 'right'}}}); 
  testLineItems.forEach((item, index) => {
    doc.table({
      columnStyles: [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15],
      rowStyles:{
        minHeight: itemHeight,
        padding: 5,
        align:{x: 'right', y: 'bottom' }
      }
    }).row([index, ...item]);
  });

  //Taxation and Total Amount
  currentY = doc.y + (testLineItems.length + 1) * itemHeight + 20;
  doc.fontSize(12).font('Times-Bold');
  const taxableAmount = (parseFloat(quotation.subtotal) + parseFloat(quotation.nhilRate!) + parseFloat(quotation.getfundRate || '0') + parseFloat(quotation.covidRate || '0'));
  const additionalInfoArray = [
    { label: `SUBTOTAL (${quotation.currency})`, value: formatNum(quotation.subtotal) },
    {label:`NHIL (${quotation.nhilRate || '0.00'})%`, value: formatNum((parseFloat(quotation.nhilRate!)*parseFloat(quotation.subtotal!)/100).toFixed(2)) || '0.00'},
    {label:`GETFUND (${quotation.getfundRate || '0.00'})%` , value: formatNum((parseFloat(quotation.getfundRate!)*parseFloat(quotation.subtotal!)/100).toFixed(2)) || '0.00'},
    {label:`TAXABLE AMOUNT (${quotation.currency})`, value: formatNum(taxableAmount.toFixed(2))},
    {label:`VAT AMOUNT (${quotation.currency})`, value: formatNum(quotation.vatAmount)},
    { label: `TOTAL AMOUNT (${quotation.currency})`, value: formatNum(quotation.total) }
  ];


  doc.fontSize(12).font('Times-Bold');
  additionalInfoArray.forEach(info => {
    doc.table({
      columnStyles: [pageWidth * 0.85, pageWidth * 0.15],
      rowStyles:{
        minHeight: itemHeight-5,
        padding: 5,
        align:{x: 'center', y: 'bottom' },
        backgroundColor: '#F0F0F0',
      }
    }).row([info.label.trim(), info.value as string]);
  });

  doc.end();
};

export const generateQuotationPDFBuffer = (quotation: QuotationData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 0,
      size: 'A4',
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Uint8Array) => buffers.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Font setup
    doc.registerFont('Helvetica', 'Helvetica');
    doc.registerFont('Helvetica-Bold', 'Helvetica-Bold');
    doc.registerFont('Times-Roman', 'Times-Roman');
    doc.registerFont('Times-Bold', 'Times-Bold');

    const bannerPath = resolveAssetPath("banner");
    const stampPath = resolveAssetPath("stamp"); 
    const logoPath = resolveAssetPath("logo");

    let currentY = 0;

    // Banner Image
    try {
      doc.image(bannerPath, 0, 0, { width: doc.page.width, height: 100 });
      currentY += 110;
    } catch (error) {
      console.warn('Banner image not found, continuing without it');
      currentY += 10;
    }

    // Date
    doc.fontSize(10).font('Times-Bold')
      .text(new Date(quotation.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),2, currentY, { align: 'left' });
    
    currentY = doc.y + 20;

    // Client Details
    doc.fontSize(11).font('Times-Bold')
      .text(quotation.clientName.split('\n')[0] || quotation.clientName, 2, currentY);
    
    currentY = doc.y + 15;  
    
    // Process multi-line address
    const clientLines = quotation.clientAddress?.split('\n') || [];
    doc.fontSize(10).font('Times-Bold');
    clientLines.forEach(line => {
      doc.text(line.trim(), 2, currentY);
      currentY += 15;
    });

    currentY = doc.y + 20; 

    // Salutation
    doc.fontSize(11).font('Times-Roman')
      .text('Dear Sir/Madam,', 2, currentY);
    
    currentY = doc.y + 30;

    // Subject/Reference
    const subjectText = quotation.projectTitle 
      ? `RE: ${quotation.projectTitle.toUpperCase().trim()}`
      : 'RE: QUOTATION';
    
    doc.fontSize(12).font('Times-Bold')
      .text(subjectText, 2, currentY);
    
    currentY = doc.y + 10;

    // Body text
    const [whole, fraction] = quotation.total.split('.');
    let lineItemsArray = parseLineItems(quotation.lineItems);
    const lineItemDescriptions = lineItemsArray.map(item => item.description);
    let bodyText = `In relation to the above subject matter, we the undersigned offer to supply the following item${lineItemDescriptions.length > 1 ? 's' : ''}, ${lineItemDescriptions.join(", ")} in accordance to your Request with tender number: ${quotation.projectReference || quotation.quotationNumber}.We hereby, humbly submit our quotation for your perusal. Our quotation is binding upon us.Our offer is in the sum of ${ToWordsConverter.convert(parseInt(whole))} ${getMajorCurrencyUnit(quotation.currency as CurrencyCode)} and ${ToWordsConverter.convert(parseInt(fraction))} ${getMinorCurrencyUnit(quotation.currency as CurrencyCode,parseInt(fraction))} inclusive of all taxes.`;
    doc.fontSize(11).font('Times-Roman').text(bodyText, 2, currentY, {
      width: 500,
      lineGap: 5,
      align: 'justify'
    });
    
    currentY = doc.y + 80; 

    // Delivery period
    doc.fontSize(12).font('Times-Bold').text('- Delivery Period', 2, currentY);
    currentY = doc.y + 10;
    doc.fontSize(11).font('Times-Roman')
      .text(`Delivery shall be made within ${quotation.deliveryPeriod || '1 week'} after receipt of a Confirmed Purchase Order.`, 5);
    
    currentY = doc.y + 15;

    // Delivery Terms
    doc.fontSize(12).font('Times-Bold').text('- Delivery Terms', 2, currentY);
    currentY = doc.y + 10; 
    doc.fontSize(11).font('Times-Roman').text(quotation.deliveryTerms || 'NA', 2, currentY);
    
    currentY = doc.y + 15;

    // Tender Validity
    doc.fontSize(12).font('Times-Bold').text('- Tender Validity', 2, currentY);
    currentY = doc.y + 10;
    doc.fontSize(11).font('Times-Roman').text(`Our price contained in our tender submission shall be valid for a period of ${quotation.validityPeriod || 60} days.`, 2, currentY);
    
    currentY = doc.y + 15;

    // Terms of Payment
    doc.fontSize(12).font('Times-Bold').text('- Terms of Payment', 2, currentY);
    currentY = doc.y + 10;
    doc.fontSize(11).font('Times-Roman').text(quotation.paymentTerms || '45 days after delivery of invoices', 2, currentY);
    
    currentY = doc.y + 15;

    // Closing remarks
    doc.fontSize(11).font('Times-Roman').text('I look forward to building a mutually beneficial business relationship with you.', 2, currentY);
    doc.moveDown(20);
    doc.text('Thank you.', 2, currentY+20);
    currentY = doc.y + 50;

    // Stamp
    try {
      doc.image(stampPath, 2, currentY, { width: 150, height: 100 });
    } catch (error) {
      console.warn('Stamp image not found, continuing without it');
    }  
    
    currentY = doc.y + 60;

    // PROFORMA INVOICE Check
    if (currentY + doc.y > doc.page.height) {
      doc.addPage();
      currentY = 10;
    }

    // Logo
    try {
      doc.image(logoPath, 2, currentY, { width: 100 });
    } catch (error) {
      console.warn('Logo image not found, continuing without it');
    }

    // PROFORMA INVOICE Section
    doc.fontSize(35).font('Times-Bold').text('PROFORMA INVOICE', doc.page.width*0.25, currentY+30, { align: 'left' });
    
    currentY = doc.y + 90;

    // Supplier Info
    doc.fontSize(12).font('Times-Bold').text('ONK GROUP LIMITED', 2, currentY, { align: 'left' });
    currentY = doc.y + 15;
    
    doc.fontSize(12).font('Times-Bold').text('SUITE 3001-2 FORICO MALL  1986 188', 2, currentY, { align: 'left' });
    currentY = doc.y + 15;
    doc.text('MISSION STREET OSU, ACCRA', 2, currentY, { align: 'left' });
    currentY = doc.y + 15;    
    doc.text('030 279 9514 / 053 1986 188', 2, currentY, { align: 'left' });
    currentY = doc.y + 15; 

    // Date
    doc.fontSize(12).font('Times-Bold')
      .text(new Date(quotation.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),2, currentY, { align: 'left' });
    
    currentY = doc.y + 30;

    // Bill To section
    doc.fontSize(12).font('Times-Bold').text((quotation.clientAddress!.split("\n")).join("\n").trim(), 2, currentY);
    
    currentY = doc.y + 15;
    doc.moveDown(2);

    // Summary Table
    const itemHeight = 35;
    const pageWidth = doc.page.width-4;

    let testLineItems: any[] = parseLineItems(quotation.lineItems);
    testLineItems = testLineItems.map(item => [item.description, item.quantity, formatNum(parseFloat(item.unitPrice?.toString()).toFixed(2)), formatNum(parseFloat(item.total?.toString()).toFixed(2))]);

    doc.table({
      columnStyles: (i)=>{
        return [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15][i];
      },
      rowStyles:{
        backgroundColor: '#D3D3D3',
        height: itemHeight + 30,
        padding: 5,
        align:{x: 'center', y: 'top' },
      }
    }).row(['No.', 'MATERIAL', 'QTY', `UNIT PRICE\n(${quotation.currency})`, `TOTAL\n(${quotation.currency})`]);

    doc.fontSize(12).font('Times-Roman');
    testLineItems.forEach((item, index) => {
      doc.table({
        columnStyles: [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15],
        rowStyles:{
          minHeight: itemHeight,
          padding: 5,
          align:{x: 'right', y: 'bottom' }
        }
      }).row([index, ...item]);
    });

    // Taxation and Total Amount
    currentY += (testLineItems.length + 1) * itemHeight + 20;
    doc.fontSize(12).font('Times-Bold');
    const taxableAmount = (parseFloat(quotation.subtotal) + parseFloat(quotation.nhilRate!) + parseFloat(quotation.getfundRate || '0') + parseFloat(quotation.covidRate || '0'));
    const additionalInfoArray = [
      { label: `SUBTOTAL (${quotation.currency})`, value: quotation.subtotal },
      {label:`NHIL (${quotation.nhilRate || '0.00'})%`, value: formatNum((parseFloat(quotation.nhilRate!)*parseFloat(quotation.subtotal!)/100).toFixed(2)) || '0.00'},
      {label:`GETFUND (${quotation.getfundRate || '0.00'})%` , value: formatNum((parseFloat(quotation.getfundRate!)*parseFloat(quotation.subtotal!)/100).toFixed(2)) || '0.00'},
      {label:`COVID-19 (${quotation.covidRate || '0.00'})%` , value: formatNum((parseFloat(quotation.covidRate!)*parseFloat(quotation.subtotal!)/100).toFixed(2)) || '0.00'},
      {label:`TAXABLE AMOUNT (${quotation.currency})`, value: formatNum(taxableAmount.toFixed(2))},
      {label:`VAT AMOUNT (${quotation.currency})`, value: formatNum(quotation.vatAmount)},
      { label: `TOTAL AMOUNT (${quotation.currency})`, value: formatNum(quotation.total) }
    ];

    additionalInfoArray.forEach(info => {
      doc.table({
        columnStyles: [pageWidth * 0.85, pageWidth * 0.15],
        rowStyles:{
          minHeight: itemHeight-5,
          padding: 5,
          align:{x: 'center', y: 'bottom' },
          backgroundColor: '#F0F0F0',
        }
      }).row([info.label.trim(), info.value as string]);
    });

    doc.end();
  });
};

// Helper function to parse line items
function parseLineItems(lineItems: LineItem[] | string): LineItem[] {
  if (typeof lineItems === 'string') {
    try {
      return JSON.parse(lineItems);
    } catch (e) {
      return [];
    }
  }
  return lineItems;
}

interface TenderSummary {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: string;
  createdAt: string;
}

interface TenderTaskSummary {
  title: string | null;
  description: string | null;
  status: string;
  submittedAt: Date | null;
  fileName: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
}

export const generateTenderPdf = async (
  tender: TenderSummary,
  tasks: TenderTaskSummary[],
  res: Response
) => {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=tender-${tender.title.replace(/\s+/g, "-").toLowerCase()}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(20).font("Helvetica-Bold").text(COMPANY_NAME, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text(COMPANY_ADDRESS, { align: "center" });
  doc
    .fontSize(10)
    .text(`Phone: ${COMPANY_PHONE} | Email: ${COMPANY_EMAIL}`, {
      align: "center",
    });
  doc.moveDown(1.5);

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("TENDER SUMMARY", { align: "center" });
  doc.moveDown(1);

  doc.fontSize(11).font("Helvetica-Bold").text("Title:");
  doc.fontSize(11).font("Helvetica").text(tender.title);
  doc.moveDown(0.5);

  if (tender.description) {
    doc.fontSize(11).font("Helvetica-Bold").text("Description:");
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(tender.description, { width: 500 });
    doc.moveDown(0.5);
  }

  doc.fontSize(11).font("Helvetica-Bold").text("Deadline:");
  doc
    .fontSize(11)
    .font("Helvetica")
    .text(new Date(tender.deadline).toLocaleString());
  doc.moveDown(0.5);

  doc.fontSize(11).font("Helvetica-Bold").text("Status:");
  doc.fontSize(11).font("Helvetica").text(tender.status.toUpperCase());
  doc.moveDown(1.5);

  doc.fontSize(13).font("Helvetica-Bold").text("Tasks");
  doc.moveDown(0.5);

  if (tasks.length === 0) {
    doc.fontSize(11).font("Helvetica").text("No tasks defined for this tender.");
    doc.end();
    return;
  }

  const pageWidth = doc.page.width - 100;
  const columns = {
    title: { x: 50, width: pageWidth * 0.25 },
    assignee: { x: 50 + pageWidth * 0.25, width: pageWidth * 0.2 },
    status: { x: 50 + pageWidth * 0.45, width: pageWidth * 0.15 },
    submittedAt: { x: 50 + pageWidth * 0.6, width: pageWidth * 0.2 },
    fileName: { x: 50 + pageWidth * 0.8, width: pageWidth * 0.2 },
  };

  const tableTop = doc.y;

  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Task", columns.title.x, tableTop, {
    width: columns.title.width,
  });
  doc.text("Assignee", columns.assignee.x, tableTop, {
    width: columns.assignee.width,
  });
  doc.text("Status", columns.status.x, tableTop, {
    width: columns.status.width,
  });
  doc.text("Submitted At", columns.submittedAt.x, tableTop, {
    width: columns.submittedAt.width,
  });
  doc.text("File", columns.fileName.x, tableTop, {
    width: columns.fileName.width,
  });

  doc
    .moveTo(50, tableTop + 15)
    .lineTo(pageWidth + 50, tableTop + 15)
    .stroke();

  doc.fontSize(9).font("Helvetica");
  let currentY = tableTop + 25;

  tasks.forEach((task, index) => {
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 50;
      doc.fontSize(9).font("Helvetica");
    }

    const assigneeName = task.assigneeFirstName
      ? `${task.assigneeFirstName} ${task.assigneeLastName || ""}`.trim()
      : "Unassigned";

    doc.text(task.title || `Task ${index + 1}`, columns.title.x, currentY, {
      width: columns.title.width,
    });
    doc.text(assigneeName, columns.assignee.x, currentY, {
      width: columns.assignee.width,
    });
    doc.text(task.status.toUpperCase(), columns.status.x, currentY, {
      width: columns.status.width,
    });
    doc.text(
      task.submittedAt
        ? new Date(task.submittedAt).toLocaleString()
        : "-",
      columns.submittedAt.x,
      currentY,
      {
        width: columns.submittedAt.width,
      }
    );
    doc.text(task.fileName || "-", columns.fileName.x, currentY, {
      width: columns.fileName.width,
    });

    currentY += 20;
  });

  doc.end();
};
