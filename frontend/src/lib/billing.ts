// Centralized billing utility - single source of truth for all pricing calculations

export interface BillingInput {
  items: { price: number; quantity: number }[];
  discount?: number;
  gstEnabled?: boolean;
  cgstRate?: number; // percentage e.g. 2.5
  sgstRate?: number; // percentage e.g. 2.5
}

export interface BillingResult {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  cgst: number;
  sgst: number;
  gstTotal: number;
  total: number;
  isGstEnabled: boolean;
}

export interface BusinessSettings {
  restaurantName: string;
  gstin: string | null;
  address: string;
  phone?: string;
  email?: string;
  isGstEnabled: boolean;
  cgstRate: number;
  sgstRate: number;
}

export interface OrderPricing {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  gst: number;
  total: number;
  cgstRate: number;
  sgstRate: number;
  isGstEnabled: boolean;
}

const DEFAULT_CGST_RATE = 2.5;
const DEFAULT_SGST_RATE = 2.5;

/** Round to 2 decimal places - avoids floating point drift */
export function roundCurrency(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Format currency for display - Indian Rupee with 2 decimals */
export function formatINR(value: number): string {
  return `₹${roundCurrency(value).toFixed(2)}`;
}

/** Core billing calculation */
export function calculateBilling(input: BillingInput): BillingResult {
  const subtotal = roundCurrency(
    input.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  );
  const discount = roundCurrency(
    Math.min(Math.max(input.discount ?? 0, 0), subtotal),
  );
  const taxableAmount = roundCurrency(Math.max(subtotal - discount, 0));

  const isGstEnabled = input.gstEnabled !== false;
  const cgstRate = isGstEnabled
    ? Number((input.cgstRate ?? DEFAULT_CGST_RATE).toFixed(4))
    : 0;
  const sgstRate = isGstEnabled
    ? Number((input.sgstRate ?? DEFAULT_SGST_RATE).toFixed(4))
    : 0;

  const cgst = roundCurrency((taxableAmount * cgstRate) / 100);
  const sgst = roundCurrency((taxableAmount * sgstRate) / 100);
  const gstTotal = roundCurrency(cgst + sgst);
  const total = roundCurrency(taxableAmount + gstTotal);

  return {
    subtotal,
    discount,
    taxableAmount,
    cgstRate,
    sgstRate,
    cgst,
    sgst,
    gstTotal,
    total,
    isGstEnabled,
  };
}

/** Calculate order pricing from subtotal + discount + settings (compat wrapper) */
export function calculateOrderPricing(
  subtotal: number,
  discount = 0,
  businessSettings?: Partial<BusinessSettings> | null,
): OrderPricing {
  const safeSubtotal = roundCurrency(subtotal);
  const safeDiscount = roundCurrency(Math.min(Math.max(discount, 0), safeSubtotal));
  const taxableAmount = roundCurrency(Math.max(safeSubtotal - safeDiscount, 0));

  const gstEnabled = businessSettings?.isGstEnabled !== false;
  const cgstRate = gstEnabled
    ? Number((businessSettings?.cgstRate ?? DEFAULT_CGST_RATE).toFixed(4))
    : 0;
  const sgstRate = gstEnabled
    ? Number((businessSettings?.sgstRate ?? DEFAULT_SGST_RATE).toFixed(4))
    : 0;

  const cgst = roundCurrency((taxableAmount * cgstRate) / 100);
  const sgst = roundCurrency((taxableAmount * sgstRate) / 100);
  const gst = roundCurrency(cgst + sgst);
  const total = roundCurrency(taxableAmount + gst);

  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    taxableAmount,
    cgst,
    sgst,
    gst,
    total,
    cgstRate,
    sgstRate,
    isGstEnabled: gstEnabled,
  };
}
