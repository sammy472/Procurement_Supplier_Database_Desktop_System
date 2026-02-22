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
  shippingMethod?: string;
  shippingService?: string;
  createdAt: string;
}

const COMPANY_NAME = "ONK GROUP LTD";
const COMPANY_ADDRESS = "SUITE 3001-2, FORICO MALL,\nMISSION STREET, OSU\nACCRA, GHANA";
const COMPANY_PHONE = "+233302799514";
const COMPANY_EMAIL = "info@onkgroup.co.uk";

function resolveAssetPath(
  asset: "logo" | "banner" | "stamp" | "po_banner",
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
    margin: 0,
    size: "A4",
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename=purchase-order-${po.poNumber}.pdf`
  );

  doc.pipe(res);

  doc.registerFont("Helvetica", "Helvetica");
  doc.registerFont("Helvetica-Bold", "Helvetica-Bold");
  doc.registerFont("Times-Roman", "Times-Roman");
  doc.registerFont("Times-Bold", "Times-Bold");

  const logoPath = resolveAssetPath("logo", company);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const leftBandWidth = 40;
  const contentLeft = leftBandWidth + 20;
  const contentRight = pageWidth - 30;
  const contentWidth = contentRight - contentLeft;

  const dark = "#ffffff";
  const sideGreen = "#0d0d0cff";
  const headerGreen = "#6e7f3a";
  const textColor = "#202020";
  doc.rect(0, 0, pageWidth, pageHeight).fill(dark);
  doc.fillColor(textColor);
  doc.rect(0, 0, leftBandWidth, pageHeight).fill(sideGreen);
  doc.fillColor(textColor);
  doc.strokeColor(textColor);

  let currentY = 40;

  try {
    const logoWidth = 140;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.image(logoPath, logoX, currentY, { width: logoWidth });
    currentY += 90;
  } catch {
    currentY += 40;
  }

  doc.fontSize(22).font("Helvetica-Bold").text("PURCHASE ORDER", contentLeft, currentY, {
    align: "left",
  });
  const titleBottomY = doc.y + 2;
  doc.moveTo(contentLeft, titleBottomY).lineTo(contentLeft + 220, titleBottomY).stroke();
  currentY = titleBottomY + 20;

  const poBoxWidth = 260;
  const poBoxHeight = 40;
  const poBoxX = contentRight - poBoxWidth;
  const poBoxY = currentY - 10;

  doc.fillColor(headerGreen).rect(poBoxX, poBoxY, poBoxWidth, poBoxHeight).fill();
  doc.strokeColor(textColor).rect(poBoxX, poBoxY, poBoxWidth, poBoxHeight).stroke();
  doc.moveTo(poBoxX + poBoxWidth / 2, poBoxY)
    .lineTo(poBoxX + poBoxWidth / 2, poBoxY + poBoxHeight)
    .stroke();
  doc.moveTo(poBoxX, poBoxY + poBoxHeight / 2)
    .lineTo(poBoxX + poBoxWidth, poBoxY + poBoxHeight / 2)
    .stroke();

  const orderDateText = new Date(po.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9);
  doc.text("P.O. #", poBoxX + 8, poBoxY + 4);
  doc.text("ORDER DATE", poBoxX + poBoxWidth / 2 + 8, poBoxY + 4);
  doc.font("Helvetica").fontSize(10);
  doc.text(po.poNumber, poBoxX + 8, poBoxY + poBoxHeight / 2 + 4);
  doc.text(orderDateText, poBoxX + poBoxWidth / 2 + 8, poBoxY + poBoxHeight / 2 + 4);

  const separatorY = poBoxY + poBoxHeight + 18;
  doc.moveTo(contentLeft, separatorY).lineTo(contentRight, separatorY).stroke();
  currentY = separatorY + 18;

  const vendorHeaderHeight = 24;
  const vendorBodyHeight = 80;
  const vendorBoxY = currentY;

  doc.fillColor(headerGreen).rect(contentLeft, vendorBoxY, contentWidth, vendorHeaderHeight).fill();
  doc.strokeColor(textColor)
    .rect(contentLeft, vendorBoxY, contentWidth, vendorHeaderHeight + vendorBodyHeight)
    .stroke();
  const vendorMidX = contentLeft + contentWidth / 2;
  doc.moveTo(vendorMidX, vendorBoxY)
    .lineTo(vendorMidX, vendorBoxY + vendorHeaderHeight + vendorBodyHeight)
    .stroke();

  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(10);
  doc.text("VENDOR", contentLeft + 8, vendorBoxY + 6);
  doc.text("SHIP TO", vendorMidX + 8, vendorBoxY + 6);

  const vendorBodyY = vendorBoxY + vendorHeaderHeight + 6;
  const vendorTextWidth = contentWidth / 2 - 16;

  const vendorLines: string[] = [];
  if (po.supplierName) vendorLines.push(po.supplierName);
  if (po.supplierAddress) {
    vendorLines.push(
      ...po.supplierAddress
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    );
  }
  if (po.supplierEmail) vendorLines.push(po.supplierEmail);
  if (po.supplierPhone) vendorLines.push(po.supplierPhone);

  const shipToLines: string[] = [];
  shipToLines.push(COMPANY_NAME);
  COMPANY_ADDRESS.split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l) => shipToLines.push(l));

  doc.font("Helvetica").fontSize(9);
  doc.text(vendorLines.join("\n"), contentLeft + 8, vendorBodyY, {
    width: vendorTextWidth,
    lineGap: 2,
  });
  doc.text(shipToLines.join("\n"), vendorMidX + 8, vendorBodyY, {
    width: vendorTextWidth,
    lineGap: 2,
  });

  currentY = vendorBoxY + vendorHeaderHeight + vendorBodyHeight + 30;

  const shippingHeaderHeight = 24;
  const shippingBodyHeight = 30;
  const shippingBoxY = currentY;
  const shippingColWidth = contentWidth / 3;

  doc.fillColor(headerGreen)
    .rect(contentLeft, shippingBoxY, shippingColWidth, shippingHeaderHeight)
    .rect(contentLeft + shippingColWidth, shippingBoxY, shippingColWidth, shippingHeaderHeight)
    .rect(contentLeft + shippingColWidth * 2, shippingBoxY, shippingColWidth, shippingHeaderHeight)
    .fill();

  doc.strokeColor(textColor)
    .rect(contentLeft, shippingBoxY, contentWidth, shippingHeaderHeight + shippingBodyHeight)
    .stroke();

  doc.moveTo(contentLeft + shippingColWidth, shippingBoxY)
    .lineTo(contentLeft + shippingColWidth, shippingBoxY + shippingHeaderHeight + shippingBodyHeight)
    .stroke();
  doc.moveTo(contentLeft + shippingColWidth * 2, shippingBoxY)
    .lineTo(
      contentLeft + shippingColWidth * 2,
      shippingBoxY + shippingHeaderHeight + shippingBodyHeight
    )
    .stroke();
  doc.moveTo(contentLeft, shippingBoxY + shippingHeaderHeight)
    .lineTo(contentRight, shippingBoxY + shippingHeaderHeight)
    .stroke();

  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(10);
  doc.text("SHIPPING SERVICE", contentLeft + 8, shippingBoxY + 6);
  doc.text("SHIPPING METHOD", contentLeft + shippingColWidth + 8, shippingBoxY + 6);
  doc.text("DELIVERY PERIOD", contentLeft + shippingColWidth * 2 + 8, shippingBoxY + 6);

  const shippingBodyY = shippingBoxY + shippingHeaderHeight + 6;
  doc.font("Helvetica").fontSize(9);

  const shippingServiceText = po.shippingService || "";
  const shippingMethodText = po.shippingMethod || "";
  let deliveryText = "";
  if (po.expectedDeliveryDate) {
    deliveryText = new Date(po.expectedDeliveryDate).toLocaleDateString();
  }

  doc.text(shippingServiceText, contentLeft + 8, shippingBodyY, {
    width: shippingColWidth - 16,
    align: "center",
  });
  doc.text(shippingMethodText, contentLeft + shippingColWidth + 8, shippingBodyY, {
    width: shippingColWidth - 16,
    align: "center",
  });
  doc.text(deliveryText, contentLeft + shippingColWidth * 2 + 8, shippingBodyY, {
    width: shippingColWidth - 16,
    align: "center",
  });

  currentY = shippingBoxY + shippingHeaderHeight + shippingBodyHeight + 30;

  if (currentY > pageHeight - 260) {
    doc.addPage();
    doc.rect(0, 0, pageWidth, pageHeight).fill(dark);
    doc.fillColor(textColor);
    doc.rect(0, 0, leftBandWidth, pageHeight).fill(sideGreen);
    doc.fillColor(textColor);
    doc.strokeColor(textColor);
    currentY = 40;
  }

  const itemHeight = 30;
  const tableWidth = contentWidth;
  const currency = po as any;
  const ccy = currency.currency || "GHC";
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
      formatNum(qty),
      formatNum(unit.toFixed(2)),
      formatNum(tot.toFixed(2)),
    ];
  });
  if (lineItems.length > 0) {
    const renderHeader = () => {
      doc.fillColor(textColor).font("Helvetica-Bold").fontSize(10);
      doc.x = contentLeft;
      doc.y = currentY;
      doc.table({
        columnStyles: (i: number) =>
          [tableWidth * 0.1, tableWidth * 0.5, tableWidth * 0.12, tableWidth * 0.14, tableWidth * 0.14][i],
        rowStyles: {
          minHeight: itemHeight - 5,
          padding: 5,
          align: { x: "center", y: "bottom" },
          backgroundColor: headerGreen,
        },
      }).row(["No.", "Description", "Qty", `Unit Price (${ccy})`, `Total (${ccy})`]);
      currentY = doc.y;
    };
    renderHeader();
    lineItems.forEach((row) => {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.rect(0, 0, pageWidth, pageHeight).fill(dark);
        doc.fillColor(textColor);
        doc.rect(0, 0, leftBandWidth, pageHeight).fill(sideGreen);
        doc.fillColor(textColor);
        doc.strokeColor(textColor);
        currentY = 40;
        renderHeader();
      }
      doc.fillColor(textColor).font("Helvetica").fontSize(9);
      doc.x = contentLeft;
      doc.table({
        columnStyles: [
          tableWidth * 0.1,
          tableWidth * 0.5,
          tableWidth * 0.12,
          tableWidth * 0.14,
          tableWidth * 0.14,
        ],
        rowStyles: {
          minHeight: itemHeight - 5,
          padding: 5,
          align: { x: "center", y: "bottom" },
        },
      }).row(row as any);
      currentY = doc.y;
    });
    currentY = doc.y + 20;
  }

  const subtotal = toNum(po.subtotal);
  const discountAmount = toNum(po.discount);
  const vatRate = toNum(po.vatRate);
  const taxable = Math.max(subtotal - discountAmount, 0);
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
    doc.rect(0, 0, pageWidth, pageHeight).fill(dark);
    doc.fillColor(textColor);
    doc.rect(0, 0, leftBandWidth, pageHeight).fill(sideGreen);
    doc.fillColor(textColor);
    doc.strokeColor(textColor);
    currentY = 40;
  }
  const totals: Array<{ label: string; value: string }> = [
    { label: `SUBTOTAL (${ccy})`, value: formatNum(subtotal.toFixed(2)) },
    { label: `DISCOUNT (${ccy})`, value: formatNum(discountAmount.toFixed(2)) },
    { label: `TAXABLE AMOUNT (${ccy})`, value: formatNum(taxable.toFixed(2)) },
    { label: `VAT (${vatRate.toFixed(2)}%)`, value: formatNum(toNum(po.vatAmount).toFixed(2)) },
    { label: `TOTAL (${ccy})`, value: formatNum(toNum(po.total).toFixed(2)) },
  ];

  doc.fontSize(12).font("Times-Bold");
  doc.fillColor(textColor);
  totals.forEach((t) => {
    const isTotal = t.label.startsWith("TOTAL");
    const bg = isTotal ? headerGreen : "#333333";
    doc.x = contentLeft;
    doc.table({
      columnStyles: (i: number) => [tableWidth * 0.7, tableWidth * 0.3][i],
      rowStyles: {
        minHeight: itemHeight - 5,
        padding: 5,
        align: { x: "center", y: "bottom" },
        backgroundColor: bg,
      },
    }).row([t.label.trim(), t.value]);
  });

  currentY = doc.y + 20;
  if(po.paymentTerms){
    doc.fontSize(10).font("Helvetica").fillColor(textColor).text(po.paymentTerms, contentLeft, currentY);
    currentY = doc.y + 20;
  }

  if (currentY > pageHeight - 100) {
    doc.addPage();
    doc.rect(0, 0, pageWidth, pageHeight).fill(dark);
    doc.fillColor(textColor);
    doc.rect(0, 0, leftBandWidth, pageHeight).fill(sideGreen);
    doc.fillColor(textColor);
    doc.strokeColor(textColor);
    currentY = pageHeight - 80;
  }

  const signatureY = doc.y + 20;
  doc.fontSize(10).font("Helvetica").fillColor(textColor).text("signature:", contentLeft, signatureY);
  doc.moveTo(contentLeft + 70, signatureY + 12)
    .lineTo(contentLeft + 270, signatureY + 12)
    .stroke();

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
  if (currentY > doc.page.height - 220) {
    doc.addPage();
    currentY = 20;
  }
  // First Line Items Table (Summary Table)
  const itemHeight = 35;
  const pageWidth = doc.page.width-4;

  let testLineItems: any[] = parseLineItems(quotation.lineItems);
  testLineItems = testLineItems.map(item => [item.description, item.quantity, formatNum(parseFloat(item.unitPrice?.toString()).toFixed(2)), formatNum(parseFloat(item.total?.toString()).toFixed(2))]);

  const renderHeader = () => {
    doc.table({
      columnStyles: (i)=>{
        return [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15][i];
      },
      rowStyles:{
        backgroundColor: '#6e7f3a',
        height: itemHeight + 30,
        padding: 5,
        align:{x: 'center', y: 'top' },
      }
    }).row(['No.', 'MATERIAL', 'QTY', `UNIT PRICE\n(${quotation.currency})`, `TOTAL\n(${quotation.currency})`]);
  };
  renderHeader();

  doc.fontSize(12).font('Times-Roman');
  testLineItems.forEach((item, index) => {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
      renderHeader();
    }
    doc.table({
      columnStyles: [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15],
      rowStyles:{
        minHeight: itemHeight,
        padding: 5,
        align:{x: 'right', y: 'bottom' }
      }
    }).row([index + 1, ...item]);
  });

  //Taxation and Total Amount
  currentY = doc.y + 20;
  if (currentY > doc.page.height - 220) {
    doc.addPage();
    currentY = 20;
  }
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
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }
  additionalInfoArray.forEach(info => {
    doc.table({
      columnStyles: [pageWidth * 0.85, pageWidth * 0.15],
      rowStyles:{
        minHeight: itemHeight-5,
        padding: 5,
        align:{x: 'center', y: 'bottom' },
        backgroundColor: '#333333',
      }
    }).row([info.label.trim(), info.value as string]);
  });

  doc.end();
};

export const generateQuotationPDFBuffer = (quotation: QuotationData, company: string): Promise<Buffer> => {
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
  if (currentY > doc.page.height - 220) {
    doc.addPage();
    currentY = 20;
  }
  // First Line Items Table (Summary Table)
  const itemHeight = 35;
  const pageWidth = doc.page.width-4;

  let testLineItems: any[] = parseLineItems(quotation.lineItems);
  testLineItems = testLineItems.map(item => [item.description, item.quantity, formatNum(parseFloat(item.unitPrice?.toString()).toFixed(2)), formatNum(parseFloat(item.total?.toString()).toFixed(2))]);

  const renderHeader = () => {
    doc.table({
      columnStyles: (i)=>{
        return [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15][i];
      },
      rowStyles:{
        backgroundColor: '#6e7f3a',
        height: itemHeight + 30,
        padding: 5,
        align:{x: 'center', y: 'top' },
      }
    }).row(['No.', 'MATERIAL', 'QTY', `UNIT PRICE\n(${quotation.currency})`, `TOTAL\n(${quotation.currency})`]);
  };
  renderHeader();

  doc.fontSize(12).font('Times-Roman');
  testLineItems.forEach((item, index) => {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
      renderHeader();
    }
    doc.table({
      columnStyles: [pageWidth * 0.10, pageWidth * 0.35, pageWidth * 0.15, pageWidth * 0.25, pageWidth * 0.15],
      rowStyles:{
        minHeight: itemHeight,
        padding: 5,
        align:{x: 'right', y: 'bottom' }
      }
    }).row([index + 1, ...item]);
  });

  //Taxation and Total Amount
  currentY = doc.y + 20;
  if (currentY > doc.page.height - 220) {
    doc.addPage();
    currentY = 20;
  }
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
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }
  additionalInfoArray.forEach(info => {
    doc.table({
      columnStyles: [pageWidth * 0.85, pageWidth * 0.15],
      rowStyles:{
        minHeight: itemHeight-5,
        padding: 5,
        align:{x: 'center', y: 'bottom' },
        backgroundColor: '#333333',
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
