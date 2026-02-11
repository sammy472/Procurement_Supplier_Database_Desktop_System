import { useState, ChangeEvent, useMemo, useRef } from 'react';
import { read, utils } from 'xlsx';
import { BaseInvoice, InvoiceItem, PricingRule, CompanyProfile } from '../types/invoice';
import { invoiceVariantsApi } from '../api/invoiceVariants';
import { API_URL } from '../api/client';
import { toast } from 'react-toastify';
import { MdCloudUpload, MdSave, MdAdd, MdDelete } from 'react-icons/md';
import { 
  normalizeKey, 
  parseNum, 
  parseNumOrZero, 
  transformUnit, 
  KNOWN_HEADERS,
  calculateRowTotal
} from '../utils/invoiceUtils';

const API_ORIGIN_LOCAL = API_URL.replace(/\/api\/?$/, "");
export default function InvoiceGenerator() {
  const [baseInvoice, setBaseInvoice] = useState<BaseInvoice | null>(null);
  const [company, setCompany] = useState<CompanyProfile>({
    id: '1',
    name: 'My Company',
    address: '123 Business Rd, Tech City',
    currency: 'USD',
    footerNotes: 'Thank you for your business!',
    primaryColor: '#2d6cdf',
    secondaryColor: '#333',
    layoutStyle: 'modern',
    fontFamily: 'Helvetica',
    fontSize: 14,
  });
  const [rule, setRule] = useState<PricingRule>({
    marginPercent: 20,
    discountPercent: 0,
    fixedMarkup: 0,
    roundingRule: 'NEAREST',
    varianceRangePercent: 0
  });
  const [variantCount, setVariantCount] = useState(1);
  const [clientName, setClientName] = useState("Walk-in Client");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [quotationNumber, setQuotationNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputLocation, setOutputLocation] = useState<string | null>(null);
  const [generatedUrls, setGeneratedUrls] = useState<Array<{ inline: string; download: string }>>([]);
  const [baseHeaders, setBaseHeaders] = useState<string[]>([]);
  const [baseRows, setBaseRows] = useState<any[]>([]);
  const [visibleHeaders, setVisibleHeaders] = useState<string[]>([]);
  const [variantsQueue, setVariantsQueue] = useState<Array<{ companyProfile: CompanyProfile; pricingRule: PricingRule; count: number }>>([]);
  const [priceColumnName, setPriceColumnName] = useState<string>("UNIT SELLING PRICE");
  const [totalColumnName, setTotalColumnName] = useState<string>("SELLING PRICE");
  // IPC availability handled at call sites

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      let rows: any[] = [];
      let displayHeadersOut: string[] = [];
      let displayRowsOut: any[] = [];
      const rowsAoA: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
      
      if (Array.isArray(rowsAoA) && rowsAoA.length > 0) {
        const headerRow = rowsAoA.find(r => Array.isArray(r) && r.some(cell => {
          const nk = normalizeKey(cell);
          return [...KNOWN_HEADERS.description, ...KNOWN_HEADERS.quantity, ...KNOWN_HEADERS.unitPrice, ...KNOWN_HEADERS.unit].includes(nk);
        })) || rowsAoA[0];
        
        const headers = headerRow.map(h => normalizeKey(h));
        const displayHeaders = headerRow.map(h => String(h || "").toString().trim());
        setBaseHeaders(displayHeaders);
        setVisibleHeaders(displayHeaders);
        
        const startIndex = rowsAoA.indexOf(headerRow) + 1;
        const displayRows: any[] = [];
        
        for (let i = startIndex; i < rowsAoA.length; i++) {
          const arr = rowsAoA[i];
          if (!Array.isArray(arr)) continue;
          const obj: any = {};
          for (let c = 0; c < headers.length; c++) {
            obj[headers[c]] = arr[c];
          }
          const disp: any = {};
          for (let c = 0; c < displayHeaders.length; c++) {
            const hdr = displayHeaders[c];
            disp[hdr] = arr[c];
          }
          displayRows.push(disp);
          rows.push(obj);
        }
        setBaseRows(displayRows);
        displayHeadersOut = displayHeaders;
        displayRowsOut = displayRows;
      } else {
        const parsed = utils.sheet_to_json<any>(sheet, { defval: null });
        rows = parsed.map((r: any) => {
          const o: any = {};
          Object.keys(r).forEach(k => {
            o[normalizeKey(k)] = r[k];
          });
          return o;
        });
        const allHeaders = Object.keys(parsed[0] || {}).map(k => String(k));
        setBaseHeaders(allHeaders);
        setVisibleHeaders(allHeaders);
        const filteredRows = parsed.map((r: any) => {
          const disp: any = {};
          allHeaders.forEach((h) => disp[h] = r[h]);
          return disp;
        });
        setBaseRows(filteredRows);
        displayHeadersOut = allHeaders;
        displayRowsOut = filteredRows;
      }

      const items: InvoiceItem[] = rows.map(r => {
        const keys = Object.keys(r);
        const findVal = (group: string[]) => {
          for (const g of group) {
            if (keys.includes(g)) return r[g];
          }
          return null;
        };
        const desc = findVal(KNOWN_HEADERS.description) || "Item";
        const qty = parseNum(findVal(KNOWN_HEADERS.quantity) ?? 1);
        const price = parseNum(findVal(KNOWN_HEADERS.unitPrice) ?? 0);
        const unitVal = findVal(KNOWN_HEADERS.unit) || "ea";
        return {
          description: String(desc),
          quantity: isNaN(qty) ? 1 : qty,
          unitPrice: isNaN(price) ? 0 : price,
          unit: String(unitVal)
        };
      }).filter(i => i.description && !isNaN(i.unitPrice) && !isNaN(i.quantity));

      setBaseInvoice({ items, metadata: { filename: file.name, displayHeaders: displayHeadersOut, displayRows: displayRowsOut } });
      toast.success(`Loaded ${items.length} items`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to parse file');
    }
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCompany(prev => ({ ...prev, logoBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const previewRef = useRef<HTMLDivElement | null>(null);


  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const serializeWithInlineStyles = (root: HTMLElement) => {
        const cloneElement = (el: HTMLElement): HTMLElement => {
          const cloned = el.cloneNode(false) as HTMLElement;
          const cs = window.getComputedStyle(el);
          const styleText = Array.from(cs).map((p) => `${p}:${cs.getPropertyValue(p)};`).join("");
          if (styleText) cloned.setAttribute("style", styleText);
          for (const attr of el.getAttributeNames()) {
            if (attr !== "style") {
              const val = el.getAttribute(attr);
              if (val != null) cloned.setAttribute(attr, val);
            }
          }
          for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE) {
              cloned.appendChild(cloneElement(child as HTMLElement));
            } else {
              cloned.appendChild(child.cloneNode(true));
            }
          }
          return cloned;
        };
        const clonedRoot = cloneElement(root);
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;padding:0;background:#ffffff}</style></head><body>${clonedRoot.outerHTML}</body></html>`;
      };

      const invoiceMeta = {
        taxPercent: 0,
        currency: company.currency,
        companyProfile: {
          name: company.name,
          address: company.address,
          email: "",
          phone: "",
          currency: company.currency,
          logoBase64: company.logoBase64,
          primaryColor: company.primaryColor,
          secondaryColor: company.secondaryColor,
          fontFamily: company.fontFamily,
        },
        footerNotes: company.footerNotes,
        quotationNumber,
        invoiceNumber,
        terms: company.paymentTerms || company.termsAndConditions || "",
        deliveryPeriod: company.deliveryTerms || "",
        subtotal: grandTotal,
        taxTotal: 0,
        total: grandTotal,
      };
      const buyerProfiles = [
        {
          name: clientName,
          address: clientAddress,
          email: clientEmail,
          phone: clientPhone,
        },
      ];
      let html = "";
      const container = previewRef.current;
      if (container) {
        html = serializeWithInlineStyles(container);
      } else {
        throw new Error("Preview container not available");
      }
      const lastHeader = headersForDisplay[headersForDisplay.length - 1];
      const qtyHeader = headersForDisplay.find(h => KNOWN_HEADERS.quantity.includes(normalizeKey(h)));
      const descHeader = headersForDisplay.find(h => KNOWN_HEADERS.description.includes(normalizeKey(h))) || headersForDisplay[0];
      const itemsSnapshot = baseRows.map((row) => {
        const qty = qtyHeader ? parseNumOrZero(row[qtyHeader]) : 1;
        const val = calculateRowTotal(row, headersForDisplay, rule, priceColumnName, totalColumnName, lastHeader, true);
        const totalNum = typeof val === 'number' ? val : parseNum(val);
        const unitPrice = qty > 0 ? Math.round((Number(totalNum) / qty) * 100) / 100 : Math.round(Number(totalNum) * 100) / 100;
        const desc = String(row[descHeader] ?? "Item");
        return {
          description: desc,
          quantity: isNaN(qty) ? 1 : qty,
          unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
        };
      }).filter(i => i.description && !isNaN(i.unitPrice) && !isNaN(i.quantity));
      // Generate client-side PDF via Puppeteer in Electron main
      const gen: { base64: string; size: number } = await (window as any).api.invoke("pdf:generateWithPuppeteer", html, {});
      const filename = (invoiceNumber ? `invoice-${invoiceNumber}.pdf` : `invoice-${Date.now()}.pdf`);
      // Convert base64 to Blob
      const byteChars = atob(gen.base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      // Upload to server-side for Supabase persistence
      const result = await invoiceVariantsApi.uploadClientPdf(blob, filename, invoiceMeta, buyerProfiles, itemsSnapshot);
      if (result.success && result.generatedFiles?.length) {
        toast.success(`Generated ${result.generatedFiles.length} invoice PDF(s)`);
        const first = result.generatedFiles[0];
        const folder = first.replace(/[\\/][^\\/]+$/, "");
        setOutputLocation(folder);
        setGeneratedUrls(result.generatedUrls || []);
        setVariantsQueue([]);
      } else {
        toast.error("Generation failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate invoices");
    } finally {
      setIsGenerating(false);
    }
  };

  const resolveUrl = (u: string) => {
    return /^https?:\/\//i.test(u) ? u : `${API_ORIGIN_LOCAL}${u}`;
  };

  const headersForDisplay = useMemo(() => {
    const rawHeaders = (visibleHeaders.length > 0 ? visibleHeaders : baseHeaders);
    if (rawHeaders.length === 0) return [];
    
    const totalKeyNorm = normalizeKey(totalColumnName);
    const arr = [...rawHeaders];
    const idx = arr.findIndex(h => normalizeKey(h) === totalKeyNorm);
    if (idx >= 0) {
      const [th] = arr.splice(idx, 1);
      arr.push(th);
    }
    return arr;
  }, [visibleHeaders, baseHeaders, totalColumnName]);

  const grandTotal = useMemo(() => {
    if (headersForDisplay.length === 0 || baseRows.length === 0) return 0;
    
    const lastHeader = headersForDisplay[headersForDisplay.length - 1];

    const sum = baseRows.reduce((acc, row) => {
      // Pass true for isLastCol to ensure we treat the last column as a calculated total
      // matching the render logic behavior
      const val = calculateRowTotal(
        row, 
        headersForDisplay, 
        rule, 
        priceColumnName, 
        totalColumnName, 
        lastHeader, 
        true
      );
      
      const num = typeof val === 'number' ? val : parseNum(val);
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
    
    return Math.round(sum * 100) / 100;
  }, [headersForDisplay, baseRows, priceColumnName, totalColumnName, rule]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Left Panel: Config */}
      <div className="w-1/3 p-6 overflow-y-auto border-r dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Invoice Configuration</h2>
        
        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Base Invoice (XLSX/JSON)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input type="file" onChange={handleFileUpload} accept=".xlsx,.xls,.csv,.json" className="hidden" id="invoice-upload" />
            <label htmlFor="invoice-upload" className="cursor-pointer flex flex-col items-center">
              <MdCloudUpload className="text-4xl text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Click to upload base invoice</span>
            </label>
          </div>
          {baseInvoice && <p className="mt-2 text-sm text-green-600">Loaded: {baseInvoice.metadata?.filename}</p>}
        </div>

        {/* Invoice Details */}
        <div className="mb-6 space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Invoice Details</h3>
          <input 
            type="text" 
            placeholder="Client Name"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
          />
          <textarea 
            placeholder="Client Address"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={clientAddress}
            onChange={e => setClientAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="email" 
              placeholder="Client Email"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="Client Phone"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="text" 
              placeholder="Quotation Number"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={quotationNumber}
              onChange={e => setQuotationNumber(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="Invoice Number"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
            />
          </div>
        </div>

        {/* Company Profile */}
        <div className="mb-6 space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Company Profile</h3>
          <input 
            type="text" 
            placeholder="Company Name"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={company.name}
            onChange={e => setCompany({...company, name: e.target.value})}
          />
          <textarea 
            placeholder="Address"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={company.address}
            onChange={e => setCompany({...company, address: e.target.value})}
          />
          <div className="flex gap-2">
            <select
              className="w-1/3 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={company.currency}
              onChange={e => setCompany({...company, currency: e.target.value})}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="NGN">NGN</option>
              <option value="GHS">GHS</option>
              <option value="KES">KES</option>
              <option value="ZAR">ZAR</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="JPY">JPY</option>
              <option value="CNY">CNY</option>
            </select>
            <input 
              type="file"
              accept="image/*"
              className="w-2/3 text-sm"
              onChange={handleLogoUpload}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1">Primary Color</label>
              <input
                type="color"
                className="w-full h-10 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={company.primaryColor || '#2d6cdf'}
                onChange={e => setCompany({ ...company, primaryColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Secondary Color</label>
              <input
                type="color"
                className="w-full h-10 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={company.secondaryColor || '#333333'}
                onChange={e => setCompany({ ...company, secondaryColor: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs mb-1">Layout Style</label>
              <select
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={company.layoutStyle || 'modern'}
                onChange={e => setCompany({ ...company, layoutStyle: e.target.value as any })}
              >
                <option value="modern">Modern</option>
                <option value="classic">Classic</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Font Family</label>
              <select
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={company.fontFamily || 'Helvetica'}
                onChange={e => setCompany({ ...company, fontFamily: e.target.value as any })}
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Font Size</label>
              <input
                type="number"
                min={10}
                max={22}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={company.fontSize || 14}
                onChange={e => setCompany({ ...company, fontSize: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="block text-xs mb-1">Terms & Conditions</label>
            <textarea
              placeholder="Add general terms and conditions"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={company.termsAndConditions || ''}
              onChange={e => setCompany({ ...company, termsAndConditions: e.target.value })}
            />
            <label className="block text-xs mb-1">Delivery Terms</label>
            <input
              type="text"
              placeholder="e.g., Delivery within 14 days after order confirmation"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={company.deliveryTerms || ''}
              onChange={e => setCompany({ ...company, deliveryTerms: e.target.value })}
            />
            <label className="block text-xs mb-1">Validity Period</label>
            <input
              type="text"
              placeholder="e.g., Quote valid for 30 days"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={company.validityPeriod || ''}
              onChange={e => setCompany({ ...company, validityPeriod: e.target.value })}
            />
            <label className="block text-xs mb-1">Payment Terms</label>
            <input
              type="text"
              placeholder="e.g., 50% advance, 50% on delivery"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={company.paymentTerms || ''}
              onChange={e => setCompany({ ...company, paymentTerms: e.target.value })}
            />
          </div>
        </div>

        {/* Pricing Rules */}
        <div className="mb-6 space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Pricing Rules</h3>
          <div>
            <label className="block text-xs mb-1">Margin (%)</label>
            <input 
              type="number" 
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={rule.marginPercent}
              onChange={e => setRule({...rule, marginPercent: Number(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Discount (%)</label>
            <input 
              type="number" 
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={rule.discountPercent}
              onChange={e => setRule({...rule, discountPercent: Number(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Variance (+/- %)</label>
            <input 
              type="number" 
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={rule.varianceRangePercent}
              onChange={e => setRule({...rule, varianceRangePercent: Number(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Quantity (Batch Size)</label>
            <input 
              type="number" 
              min="1"
              max="100"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={variantCount}
              onChange={e => setVariantCount(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Column Mapping */}
        <div className="mb-6 space-y-3">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Column Mapping</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1">Price Column Name</label>
              <input
                type="text"
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={priceColumnName}
                onChange={(e) => setPriceColumnName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Total Column Name</label>
              <input
                type="text"
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={totalColumnName}
                onChange={(e) => setTotalColumnName(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Unit price and cost price columns are ignored automatically.</p>
        </div>

        {/* Columns */}
        <div className="mb-6 space-y-3">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Columns</h3>
          <div className="flex flex-wrap gap-2">
            {visibleHeaders.map((h) => (
              <div key={h} className="flex items-center gap-2 px-2 py-1 border rounded dark:border-gray-600">
                <span className="text-sm dark:text-white">{h}</span>
                <button
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded"
                  onClick={() => setVisibleHeaders(prev => prev.filter(x => x !== h))}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              className="px-3 py-2 bg-gray-200 rounded dark:bg-gray-700 dark:text-white"
              onClick={() => setVisibleHeaders(baseHeaders)}
            >
              Reset Columns
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <button
            onClick={() => setVariantsQueue(prev => [...prev, { companyProfile: company, pricingRule: rule, count: variantCount }])}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white p-3 rounded flex items-center justify-center gap-2"
          >
            <MdAdd /> Add Company Variant
          </button>
          {variantsQueue.length > 0 && (
            <div className="border rounded p-3 dark:border-gray-600">
              <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Queued Variants</div>
              <ul className="space-y-2">
                {variantsQueue.map((v, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 dark:text-gray-200">{v.companyProfile.name} • {v.pricingRule.marginPercent}% margin • x{v.count}</span>
                    <button
                      onClick={() => setVariantsQueue(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                      title="Remove"
                    >
                      <MdDelete />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!baseInvoice || isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : <><MdSave /> Generate Invoices</>}
        </button>

        {outputLocation && (
          <button
            onClick={() => window.api.invoke('open-folder', outputLocation)}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white p-3 rounded flex items-center justify-center gap-2"
          >
            Open Output Location
          </button>
        )}
        {generatedUrls.length > 0 && (
          <div className="mt-4 border rounded p-3 dark:border-gray-600">
            <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Generated PDFs</div>
            <div className="flex flex-wrap gap-2">
              {generatedUrls.map((u, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <a
                    href={resolveUrl(u.inline)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 border rounded text-sm dark:border-gray-600 dark:text-white"
                  >
                    View {idx + 1}
                  </a>
                  <a
                    href={resolveUrl(u.download)}
                    download
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Download {idx + 1}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      

      {/* Right Panel: Preview */}
      <div className="w-2/3 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div
          ref={previewRef}
          className="max-w-4xl mx-auto bg-white text-gray-900 shadow-lg p-8 min-h-[800px]"
          style={{ fontFamily: company.fontFamily || 'Helvetica', fontSize: (company.fontSize || 14) + 'px' }}
        >
          {(() => {
            const primary = company.primaryColor || '#2d6cdf';
            const secondary = company.secondaryColor || '#333';
            const style = company.layoutStyle || 'modern';
            const headerBorder = style === 'classic' ? `2px solid ${secondary}` : style === 'minimal' ? `1px solid ${secondary}55` : `4px solid ${primary}`;
            const titleClasses = style === 'minimal' ? 'text-2xl tracking-wide font-semibold' : 'text-2xl font-bold';
            const theadBg = style === 'classic' ? '#f0f0f0' : style === 'minimal' ? `${primary}10` : `${primary}15`;
            const stripe = style === 'classic' ? '#fafafa' : style === 'minimal' ? '#fcfcfc' : '#f9fbff';
            
            const priceKeyNorm = normalizeKey(priceColumnName);
            const totalKeyNorm = normalizeKey(totalColumnName);
            const qtyHeader = headersForDisplay.find(h => KNOWN_HEADERS.quantity.includes(normalizeKey(h)));

            return (
              <>
                <div className="flex justify-between mb-8 pb-4" style={{ borderBottom: headerBorder }}>
                  <div>
                    {company.logoBase64 ? 
                      <img src={company.logoBase64} alt="Logo" className="h-16 object-contain" /> : 
                      <h1 className="text-3xl font-bold" style={{ color: secondary }}>{company.name}</h1>
                    }
                  </div>
                  <div className="text-right" style={{ color: secondary }}>
                    <h2 className={titleClasses}>{company.name}</h2>
                    <div className="whitespace-pre-wrap">{company.address}</div>
                    {(quotationNumber || invoiceNumber) && (
                      <div className="mt-2 text-sm">
                        {quotationNumber && <div>Quotation No: {quotationNumber}</div>}
                        {invoiceNumber && <div>Invoice No: {invoiceNumber}</div>}
                      </div>
                    )}
                  </div>
                </div>
                {(clientName || clientAddress || clientEmail || clientPhone) && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold" style={{ color: secondary }}>Bill To</h3>
                    <div className="text-sm">
                      {clientName && <div><span className="font-semibold">Client:</span> {clientName}</div>}
                      {clientAddress && <div className="whitespace-pre-wrap"><span className="font-semibold">Address:</span> {clientAddress}</div>}
                      <div className="flex gap-6">
                        {clientEmail && <div><span className="font-semibold">Email:</span> {clientEmail}</div>}
                        {clientPhone && <div><span className="font-semibold">Phone:</span> {clientPhone}</div>}
                      </div>
                    </div>
                  </div>
                )}
                <table className="w-full mb-8">
                  <thead>
                    <tr style={{ background: theadBg, borderBottom: `2px solid ${primary}`, color: secondary }}>
                      {headersForDisplay.length > 0 ? (
                        <>
                          <th className="text-left p-3">No.</th>
                          {headersForDisplay.map((h) => {
                            const hNorm = normalizeKey(h);
                            const label = hNorm === priceKeyNorm ? priceColumnName : hNorm === totalKeyNorm ? totalColumnName : h;
                            return (
                              <th key={h} className="text-left p-3">{label}</th>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <th className="text-left p-3">No.</th>
                          <th className="text-left p-3">Description</th>
                          <th className="text-right p-3">Qty</th>
                          <th className="text-right p-3">Unit Price</th>
                          <th className="text-right p-3">Total</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(baseRows.length > 0 && (visibleHeaders.length > 0 || baseHeaders.length > 0)) ? (
                      baseRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b"
                          style={{ background: idx % 2 === 0 ? stripe : 'transparent', borderColor: `${secondary}22` }}
                        >
                          <td className="p-3">{idx + 1}</td>
                          {headersForDisplay.map((h, colIdx) => {
                            const hNorm = normalizeKey(h);
                            const rawVal = row[h];
                            const isLastCol = colIdx === headersForDisplay.length - 1;
                            
                            if (hNorm === priceKeyNorm) {
                              const unit = transformUnit(parseNumOrZero(rawVal), rule);
                              return (
                              <td key={h} className="text-right p-3">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: company.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(unit)}
                                </td>
                              );
                            }
                            
                            if (isLastCol || hNorm === totalKeyNorm) {
                              const total = calculateRowTotal(row, headersForDisplay, rule, priceColumnName, totalColumnName, h, isLastCol);
                              return (
                                <td key={h} className="text-right p-3">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: company.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(total))}
                                </td>
                              );
                            }
                            
                            return (
                              <td key={h} className="p-3">
                                {
                                  (() => {
                                    if (rawVal == null) return '';
                                    if (typeof rawVal === 'object') return '';
                                    const numVal = parseNum(rawVal);
                                    
                                    const isDescriptionHeader = KNOWN_HEADERS.description.includes(hNorm);
                                    if (isDescriptionHeader) {
                                      return String(rawVal);
                                    }
                                    
                                    if (!isNaN(numVal)) {
                                      if (qtyHeader && hNorm === normalizeKey(qtyHeader)) {
                                        return numVal;
                                      }
                                      const isPriceLike = (hNorm === priceKeyNorm) || hNorm.includes('price') || hNorm.includes('cost') || hNorm.includes('amount');
                                      const value = isPriceLike ? Math.round(transformUnit(numVal, rule) * 100) / 100 : Math.round(numVal * 100) / 100;
                                      if (isPriceLike) {
                                        return new Intl.NumberFormat('en-US', { style: 'currency', currency: company.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
                                      }
                                      return value.toFixed(2);
                                    }
                                    return String(rawVal);
                                  })()
                                }
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={1 + (headersForDisplay.length > 0 ? headersForDisplay.length : 4)}
                          className="text-center p-8 text-gray-400"
                        >
                          Upload an invoice to see preview
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(company.termsAndConditions || company.deliveryTerms || company.validityPeriod || company.paymentTerms) && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold" style={{ color: secondary }}>Terms & Conditions</h3>
                    {company.termsAndConditions && (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {company.termsAndConditions}
                      </div>
                    )}
                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      {company.deliveryTerms && (
                        <div>
                          <span className="font-semibold">Delivery:</span> {company.deliveryTerms}
                        </div>
                      )}
                      {company.validityPeriod && (
                        <div>
                          <span className="font-semibold">Validity:</span> {company.validityPeriod}
                        </div>
                      )}
                      {company.paymentTerms && (
                        <div>
                          <span className="font-semibold">Payment:</span> {company.paymentTerms}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2 border-t border-black font-bold text-lg">
                <span>Total:</span>
                <span>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: company.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-4 border-t text-center text-gray-500 text-sm">
            {company.footerNotes}
          </div>
        </div>
      </div>
    </div>
  );
}
