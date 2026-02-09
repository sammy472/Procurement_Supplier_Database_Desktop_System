import { PricingRule } from '../types/invoice';

export const KNOWN_HEADERS = {
  description: ["description", "item", "name", "product", "service"],
  quantity: ["quantity", "qty", "qtty", "count", "units"],
  unitPrice: ["unitprice", "unit_price", "price", "unit cost", "cost"],
  unit: ["unit", "uom", "measure", "measurement"]
};

export const normalizeKey = (k: any): string =>
  String(k || "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "")
    .trim();

export const parseNum = (v: any): number => {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const s = String(v).replace(/[^0-9\.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
};

export const parseNumOrZero = (v: any): number => {
  const n = parseNum(v);
  return isNaN(n) ? 0 : n;
};

export const transformUnit = (val: number, rule: PricingRule): number => {
  let price = val;
  price = price * (1 + (rule.marginPercent / 100));
  price = price * (1 - (rule.discountPercent || 0) / 100);
  price = price + (rule.fixedMarkup || 0);
  return Math.round(price * 100) / 100;
};

export const calculateRowTotal = (
  row: any,
  headers: string[],
  pricingRule: PricingRule,
  priceColumnName: string,
  totalColumnName: string,
  columnName: string,
  isLastCol: boolean = false
): number | string => {
  const hNorm = normalizeKey(columnName);
  const priceKeyNorm = normalizeKey(priceColumnName);
  const totalKeyNorm = normalizeKey(totalColumnName);
  const rawVal = row[columnName];

  if (hNorm === priceKeyNorm) {
    return transformUnit(parseNumOrZero(rawVal), pricingRule);
  }

  // Check if it's the total column or the last column (heuristic from original code)
  if (isLastCol || hNorm === totalKeyNorm) {
    const qtyHeader = headers.find(h => KNOWN_HEADERS.quantity.includes(normalizeKey(h)));
    const priceHeaderName = headers.find(bh => normalizeKey(bh) === priceKeyNorm);
    const qty = qtyHeader ? parseNumOrZero(row[qtyHeader]) : 1;
    
    let unitSource = 0;
    if (priceHeaderName) {
      unitSource = parseNumOrZero(row[priceHeaderName]);
    } else {
      const totalRaw = parseNumOrZero(row[columnName]);
      unitSource = qty ? (totalRaw / qty) : totalRaw;
    }
    
    const unit = transformUnit(unitSource, pricingRule);
    return Math.round(unit * qty * 100) / 100;
  }

  const numVal = parseNum(rawVal);
  if (!isNaN(numVal)) {
    // Check if it's a quantity column
    const qtyHeader = headers.find(h => KNOWN_HEADERS.quantity.includes(normalizeKey(h)));
    if (qtyHeader && hNorm === normalizeKey(qtyHeader)) {
      return numVal;
    }

    const isPriceLike = (hNorm === priceKeyNorm) || hNorm.includes('price') || hNorm.includes('cost') || hNorm.includes('amount');
    if (isPriceLike) {
       return Math.round(transformUnit(numVal, pricingRule) * 100) / 100;
    }
    return Math.round(numVal * 100) / 100;
  }
  
  return String(rawVal ?? '');
};
