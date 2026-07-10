import { useRef } from "react";
import { Printer, Download } from "lucide-react";

export interface BillItem {
  name: string;
  quantity: number;
  price: number;
  totalPrice?: number;
}

export interface BillOrder {
  token: number;
  status: string;
  items: BillItem[];
  total: string | number;
}

export interface BillData {
  sessionId?: string;
  tableNumber?: string | null;
  customerName?: string;
  customerPhone?: string;
  orders: BillOrder[];
  itemized: BillItem[];
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  isFullyPaid: boolean;
  sessionDetails?: {
    subtotal: number;
    discount: number;
    couponCode?: string;
    cgst: number;
    sgst: number;
    gstTotal: number;
  };
}

export interface BusinessInfo {
  restaurantName?: string;
  gstin?: string | null;
  address?: string;
  phone?: string;
  isGstEnabled?: boolean;
  cgstRate?: number;
  sgstRate?: number;
}

interface BillDocumentProps {
  bill: BillData;
  business?: BusinessInfo;
  showDownloadButton?: boolean;
  compact?: boolean;
}

export interface KOTData {
  token: number | string;
  tableNumber?: string | null;
  orderType?: string;
  specialInstructions?: string;
  items: { name: string; quantity: number; note?: string }[];
  date?: string;
  billDetails?: {
    total: number;
    paymentStatus: string;
  };
}

export function downloadKOTPrint(kotData: KOTData) {
  const printWindow = window.open("", "_blank", "width=420,height=700");
  if (!printWindow) return;

  const date = kotData.date || new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const itemRows = kotData.items
    .map(item => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #000;font-size:16px;font-weight:bold;">${item.name}</td>
        <td style="text-align:right;padding:6px 0;border-bottom:1px solid #000;font-size:18px;font-weight:900;">x${item.quantity}</td>
      </tr>
      ${item.note ? `<tr><td colspan="2" style="padding:2px 0 6px 0;border-bottom:1px solid #000;font-size:13px;font-weight:bold;font-style:italic;">* Note: ${item.note}</td></tr>` : ""}
    `)
    .join("");

  printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <title>KOT - Token ${kotData.token}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 14px; color: #000; background: white; padding: 10px; max-width: 380px; margin: auto; }
    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
    .header h1 { font-size: 36px; font-weight: 900; letter-spacing: 1px; margin-bottom: 5px; }
    .header h2 { font-size: 26px; font-weight: bold; margin-bottom: 5px; }
    .header p { font-size: 14px; font-weight: bold; margin-top: 5px; border: 2px solid #000; display: inline-block; padding: 4px 10px; }
    .meta { margin-bottom: 10px; font-size: 15px; font-weight: bold; line-height: 1.5; border-bottom: 2px dashed #000; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    @media print { body { padding: 0; } }
  </style>
</head><body>
  <div class="header">
    <h1>TOKEN #${kotData.token}</h1>
    ${kotData.tableNumber ? `<h2>TABLE ${kotData.tableNumber}</h2>` : ""}
    <p>KOT - KITCHEN COPY</p>
  </div>

  <div class="meta">
    ${kotData.orderType ? `<div style="font-size: 20px; text-transform: uppercase;">TYPE: ${kotData.orderType}</div>` : ""}
    <div>TIME: ${date}</div>
  </div>

  ${kotData.specialInstructions ? `<div style="padding: 10px; border: 2px solid #000; font-size: 15px; font-weight: bold; margin-bottom: 10px;">NOTE: ${kotData.specialInstructions}</div>` : ""}

  <table>
    <tbody>${itemRows}</tbody>
  </table>

  ${kotData.billDetails ? `
  <div style="margin-top:15px; border-top:2px dashed #000; padding-top:10px;">
    <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:900;">
      <span>TOTAL:</span>
      <span>₹${kotData.billDetails.total.toFixed(2)}</span>
    </div>
    <div style="text-align:center; margin-top:10px;">
      <span style="font-size:20px; font-weight:bold; padding:4px 12px; border:2px solid #000; display:inline-block; text-transform:uppercase;">
        ${kotData.billDetails.paymentStatus}
      </span>
    </div>
  </div>
  ` : ""}

  <div style="text-align:center;margin-top:20px;font-size:12px;border-top:1px dashed #000;padding-top:10px;">
    - END OF KOT -
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body></html>`);
  printWindow.document.close();
}

export function downloadBillPrint(bill: BillData, business?: BusinessInfo) {
  const printWindow = window.open("", "_blank", "width=420,height=700");
  if (!printWindow) return;

  // GST logic
  const isGstEnabled = business?.isGstEnabled;
  const subtotal = isGstEnabled && bill.sessionDetails 
    ? bill.sessionDetails.subtotal - bill.sessionDetails.discount 
    : bill.totalAmount;
  
  const cgst = isGstEnabled && bill.sessionDetails ? bill.sessionDetails.cgst : 0;
  const sgst = isGstEnabled && bill.sessionDetails ? bill.sessionDetails.sgst : 0;
  const cgstRate = business?.cgstRate ?? 2.5;
  const sgstRate = business?.sgstRate ?? 2.5;

  const date = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const itemRows = bill.itemized
    .map(item => `
      <tr>
        <td style="padding:4px 0;border-bottom:1px dashed #ddd;">${item.name}</td>
        <td style="text-align:center;padding:4px;border-bottom:1px dashed #ddd;">${item.quantity}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px dashed #ddd;">₹${(item.price).toFixed(2)}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px dashed #ddd;">₹${(item.totalPrice ?? item.price * item.quantity).toFixed(2)}</td>
      </tr>`)
    .join("");

  printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <title>Bill - ${business?.restaurantName ?? "Restaurant"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; background: white; padding: 20px; max-width: 380px; margin: auto; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
    .header h1 { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
    .header p { font-size: 11px; color: #555; margin-top: 2px; }
    .meta { margin-bottom: 12px; font-size: 12px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    thead th { font-size: 11px; text-transform: uppercase; color: #777; padding-bottom: 6px; border-bottom: 2px solid #333; }
    .totals { margin-top: 10px; border-top: 2px dashed #333; padding-top: 10px; }
    .totals div { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
    .totals .grand { font-weight: 900; font-size: 16px; border-top: 1px solid #333; margin-top: 6px; padding-top: 6px; }
    .paid { color: #16a34a; }
    .due { color: #dc2626; }
    .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #333; padding-top: 14px; font-size: 12px; color: #555; line-height: 1.8; }
    .status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 8px;
      ${bill.totalDue < 0.01 ? "background:#dcfce7;color:#15803d;" : "background:#fee2e2;color:#b91c1c;"} }
    @media print { body { padding: 0; } button { display: none !important; } }
  </style>
</head><body>
  <div class="header">
    <h1>${business?.restaurantName ?? "Restaurant"}</h1>
    ${business?.address ? `<p>${business.address}</p>` : ""}
    ${business?.phone ? `<p>📞 ${business.phone}</p>` : ""}
    ${isGstEnabled && business?.gstin ? `<p>GSTIN: ${business.gstin}</p>` : ""}
    <p style="margin-top:6px;font-weight:bold;">${isGstEnabled ? "TAX INVOICE" : "INVOICE"}</p>
  </div>

  <div class="meta">
    ${bill.tableNumber ? `<div><b>Table:</b> ${bill.tableNumber}</div>` : ""}
    ${bill.customerName ? `<div><b>Customer:</b> ${bill.customerName}</div>` : ""}
    ${bill.customerPhone ? `<div><b>Phone:</b> ${bill.customerPhone}</div>` : ""}
    <div><b>Date:</b> ${date}</div>
    ${bill.sessionId ? `<div><b>Ref:</b> ${bill.sessionId.slice(0, 8).toUpperCase()}</div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    ${isGstEnabled ? `
      <div><span>Subtotal (excl. tax)</span><span>₹${subtotal.toFixed(2)}</span></div>
      <div><span>CGST (${cgstRate}%)</span><span>₹${cgst.toFixed(2)}</span></div>
      <div><span>SGST (${sgstRate}%)</span><span>₹${sgst.toFixed(2)}</span></div>
    ` : ''}
    <div class="grand"><span>GRAND TOTAL</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
    ${bill.totalPaid > 0 ? `<div class="paid"><span>Amount Paid</span><span>₹${bill.totalPaid.toFixed(2)}</span></div>` : ""}
    <div class="${bill.totalDue > 0 ? "due" : "paid"}">
      <span>${bill.totalDue > 0 ? "Amount Due" : "Fully Paid ✓"}</span>
      <span>₹${bill.totalDue.toFixed(2)}</span>
    </div>
    <div style="text-align:center;margin-top:8px;">
      <span class="status-badge">${bill.totalDue < 0.01 ? "✓ PAID" : "⚠ PAYMENT PENDING"}</span>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for dining with us!</p>
    <p>We hope to see you again soon 🙏</p>
    <p style="margin-top:8px;font-size:11px;color:#999;">This is a computer-generated bill and does not require signature.</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body></html>`);
  printWindow.document.close();
}

export default function BillDocument({ bill, business, showDownloadButton = true, compact = false }: BillDocumentProps) {
  const date = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center pb-3 border-b border-dashed border-border">
        <h2 className="text-lg font-black tracking-wide">{business?.restaurantName ?? "Restaurant"}</h2>
        {business?.address && <p className="text-xs text-muted-foreground">{business.address}</p>}
        {business?.isGstEnabled && business?.gstin && <p className="text-xs text-muted-foreground">GSTIN: {business.gstin}</p>}
        <p className="text-xs font-bold mt-1 text-primary">{business?.isGstEnabled ? "TAX INVOICE" : "INVOICE"}</p>
      </div>

      {/* Meta */}
      <div className="text-xs space-y-0.5 text-muted-foreground">
        {bill.tableNumber && <div><span className="font-semibold text-foreground">Table:</span> {bill.tableNumber}</div>}
        {bill.customerName && <div><span className="font-semibold text-foreground">Customer:</span> {bill.customerName}</div>}
        <div><span className="font-semibold text-foreground">Date:</span> {date}</div>
        {bill.sessionId && <div><span className="font-semibold text-foreground">Ref:</span> {bill.sessionId.slice(0, 8).toUpperCase()}</div>}
      </div>

      {/* Items */}
      <div>
        <div className="grid grid-cols-4 text-xs font-bold uppercase text-muted-foreground pb-1 border-b border-border">
          <span className="col-span-2">Item</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Total</span>
        </div>
        <div className="space-y-1 mt-2">
          {bill.itemized.map((item, i) => (
            <div key={i} className="grid grid-cols-4 text-sm">
              <span className="col-span-2 truncate">{item.name}</span>
              <span className="text-center text-muted-foreground">{item.quantity}</span>
              <span className="text-right font-medium">₹{(item.totalPrice ?? item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-border pt-3 space-y-1">
        {business?.isGstEnabled && bill.sessionDetails && (
          <>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal (excl. GST)</span>
              <span>₹{(bill.sessionDetails.subtotal - bill.sessionDetails.discount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>CGST ({business.cgstRate ?? 2.5}%)</span>
              <span>₹{(bill.sessionDetails.cgst).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>SGST ({business.sgstRate ?? 2.5}%)</span>
              <span>₹{(bill.sessionDetails.sgst).toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-black text-base border-t border-border pt-2 mt-1">
          <span>Grand Total</span>
          <span className="text-primary">₹{bill.totalAmount.toFixed(2)}</span>
        </div>
        {bill.totalPaid > 0 && (
          <div className="flex justify-between text-sm text-emerald-600 font-semibold">
            <span>Paid</span>
            <span>-₹{bill.totalPaid.toFixed(2)}</span>
          </div>
        )}
        <div className={`flex justify-between text-sm font-bold ${bill.totalDue > 0.01 ? "text-destructive" : "text-emerald-600"}`}>
          <span>{bill.totalDue > 0.01 ? "Amount Due" : "✓ Fully Paid"}</span>
          <span>₹{bill.totalDue.toFixed(2)}</span>
        </div>
      </div>

      {/* Download Button */}
      {showDownloadButton && (
        <button
          onClick={() => downloadBillPrint(bill, business)}
          className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground border border-border py-2.5 rounded-xl text-sm font-bold transition-all"
        >
          <Printer size={16} /> Download / Print Bill
        </button>
      )}

      <div className="text-center text-xs text-muted-foreground pb-1">
        Thank you for dining with us! 🙏
      </div>
    </div>
  );
}
