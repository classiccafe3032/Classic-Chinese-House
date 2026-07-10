// Generates a receipt as a downloadable image using Canvas API
// Optimized for thermal printer width (80mm ≈ 420px)

import { roundCurrency } from "./billing";

export interface ReceiptData {
  token: number;
  customerName: string;
  customerPhone: string;
  items: { name: string; price: number; quantity: number }[];
  subtotal?: number;
  discount?: number;
  couponCode?: string | null;
  cgst?: number;
  sgst?: number;
  cgstRate?: number;
  sgstRate?: number;
  gst?: number;
  total: number;
  paymentMethod: "counter" | "online";
  paymentStatus?: string;
  paidAmount?: number;
  createdAt: string;
  business?: {
    restaurantName?: string;
    gstin?: string | null;
    address?: string;
  };
  orderType?: string;
  specialInstructions?: string;
  tableSessionId?: string | null;
}

export interface ZReportData {
  label: string;
  totalOrders: number;
  totalRevenue: number;
  paidRevenue?: number;
  pendingRevenue?: number;
  business?: {
    restaurantName?: string;
    address?: string;
  };
}

const W = 420;
const PAD = 24;
const LINE_H = 22;
const FONT = "'Segoe UI', system-ui, sans-serif";

function fmt(v: number): string {
  return `₹${roundCurrency(v).toFixed(2)}`;
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
) {
  ctx.beginPath();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Wrap text that exceeds maxWidth, returns lines */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

/** Build receipt canvas and return the canvas element */
export function buildReceiptCanvas(data: ReceiptData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const businessLines = [
    data.business?.restaurantName || "The Chinese House",
    data.business?.gstin ? `GSTIN: ${data.business.gstin}` : null,
    data.business?.address || null,
  ].filter(Boolean) as string[];

  const hasDiscount = (data.discount ?? 0) > 0;
  const cgst = data.cgst ?? 0;
  const sgst = data.sgst ?? 0;
  const hasGst = cgst + sgst > 0;
  const hasDue = (data.paidAmount ?? data.total) < data.total;

  // Pre-calculate height - items may wrap
  canvas.width = W;
  canvas.height = 800; // temporary for measurement
  ctx.font = `13px ${FONT}`;
  const maxItemTextW = W - PAD * 2 - 80; // leave room for amount

  let itemTotalLines = 0;
  const wrappedItems: { lines: string[]; amount: string }[] = [];
  for (const item of data.items) {
    const label = `${item.name} × ${item.quantity}`;
    const lines = wrapText(ctx, label, maxItemTextW);
    wrappedItems.push({ lines, amount: fmt(item.price * item.quantity) });
    itemTotalLines += lines.length;
  }

  const hasOrderType = !!data.orderType;
  const instrLines2 = data.specialInstructions ? wrapText(ctx, `Note: ${data.specialInstructions}`, W - PAD * 2) : [];

  let H =
    360 +
    itemTotalLines * LINE_H +
    businessLines.length * 16 +
    (hasDiscount ? LINE_H : 0) +
    (hasGst ? LINE_H * 2 : 0) +
    (hasDue ? LINE_H : 0) +
    (hasOrderType ? 18 : 0) +
    instrLines2.length * 16;
  H = Math.max(H, 430);

  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  let y = PAD;

  // ─── Business header ───
  ctx.fillStyle = "#111827";
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(businessLines[0], W / 2, y + 4);
  y += 24;

  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#6b7280";
  for (const line of businessLines.slice(1)) {
    ctx.fillText(line, W / 2, y);
    y += 16;
  }

  ctx.fillText("Tax Invoice / Receipt", W / 2, y + 4);
  y += 24;

  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 16;

  // ─── Token + date ───
  ctx.textAlign = "left";
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillStyle = "#111827";
  ctx.fillText(`Token #${data.token}`, PAD, y);
  ctx.textAlign = "right";
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = "#6b7280";
  ctx.fillText(
    new Date(data.createdAt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    W - PAD,
    y,
  );
  y += 24;

  // ─── Customer ───
  ctx.textAlign = "left";
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = "#374151";
  ctx.fillText(`${data.customerName}  •  ${data.customerPhone}`, PAD, y);
  y += 20;

  // ─── Order Type ───
  if (data.orderType) {
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = "#374151";
    const typeLabel = data.orderType === "dine-in" ? "Dine-in" : data.orderType === "takeaway" ? "Takeaway" : "Delivery";
    ctx.fillText(`Order Type: ${typeLabel}`, PAD, y);
    y += 18;
  }

  // ─── Special Instructions ───
  if (data.specialInstructions) {
    ctx.font = `italic 11px ${FONT}`;
    ctx.fillStyle = "#6b7280";
    const instrLines = wrapText(ctx, `Note: ${data.specialInstructions}`, W - PAD * 2);
    for (const line of instrLines) {
      ctx.fillText(line, PAD, y);
      y += 16;
    }
  }

  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 16;

  // ─── Column headers ───
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = "#6b7280";
  ctx.textAlign = "left";
  ctx.fillText("ITEM", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText("AMOUNT", W - PAD, y);
  y += LINE_H;

  // ─── Items with wrapping ───
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = "#111827";
  for (const { lines, amount } of wrappedItems) {
    for (let i = 0; i < lines.length; i++) {
      ctx.textAlign = "left";
      ctx.fillText(lines[i], PAD, y);
      if (i === 0) {
        ctx.textAlign = "right";
        ctx.fillText(amount, W - PAD, y);
      }
      y += LINE_H;
    }
  }

  y += 4;
  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 16;

  // ─── Totals section ───
  const drawRow = (
    label: string,
    value: string,
    color = "#111827",
    bold = false,
  ) => {
    ctx.textAlign = "left";
    ctx.font = bold ? `bold 14px ${FONT}` : `13px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(label, PAD, y);
    ctx.textAlign = "right";
    ctx.fillText(value, W - PAD, y);
    y += LINE_H;
  };

  drawRow("Subtotal", fmt(data.subtotal ?? data.total));

  if (hasDiscount) {
    drawRow(
      `Discount${data.couponCode ? ` (${data.couponCode})` : ""}`,
      `-${fmt(data.discount!)}`,
      "#059669",
    );
  }

  if (hasGst) {
    const cgstPct = data.cgstRate ?? 2.5;
    const sgstPct = data.sgstRate ?? 2.5;
    drawRow(`CGST @ ${cgstPct}%`, fmt(cgst), "#374151");
    drawRow(`SGST @ ${sgstPct}%`, fmt(sgst), "#374151");
  }

  // Total
  ctx.textAlign = "left";
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillStyle = "#111827";
  ctx.fillText("Total", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(fmt(data.total), W - PAD, y);
  y += LINE_H + 4;

  // ─── Payment info ───
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#6b7280";
  ctx.textAlign = "left";
  const payLabel =
    data.paymentMethod === "counter" ? "Pay at Counter" : "Paid Online";
  ctx.fillText(`Payment: ${payLabel}`, PAD, y);

  if (hasDue) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#dc2626";
    const due = data.total - (data.paidAmount ?? 0);
    ctx.fillText(`Due: ${fmt(due)}`, W - PAD, y);
  }
  y += 24;

  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 18;
  ctx.textAlign = "center";
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = "#9ca3af";
  ctx.fillText("Thank you for your order!", W / 2, y);

  return canvas;
}

/** Download receipt as PNG */
export function downloadReceipt(data: ReceiptData) {
  const canvas = buildReceiptCanvas(data);
  const link = document.createElement("a");
  link.download = `receipt-token-${data.token}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** Open receipt in a new window and trigger print dialog */
export function printReceipt(data: ReceiptData) {
  const canvas = buildReceiptCanvas(data);
  const dataUrl = canvas.toDataURL("image/png");

  // 🖥️ ELECTRON → silent print
  if (window.electronAPI) {
    window.electronAPI.printReceipt(dataUrl);
    return;
  }

  // 🌐 fallback (browser)
  const printWindow = window.open("", "_blank", "width=500,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
    <body style="margin:0;display:flex;justify-content:center;">
      <img src="${dataUrl}" style="width:80mm" 
        onload="window.print();window.close();" />
    </body>
    </html>
  `);

  printWindow.document.close();
}

/** Build KOT (Kitchen Order Ticket) canvas */
export function buildKotCanvas(data: ReceiptData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = W;
  canvas.height = 800;
  ctx.font = `bold 18px ${FONT}`;
  const maxItemTextW = W - PAD * 2 - 40; // leave room for quantity

  let itemTotalLines = 0;
  const wrappedItems: { lines: string[]; qty: string }[] = [];
  for (const item of data.items) {
    const lines = wrapText(ctx, item.name, maxItemTextW);
    wrappedItems.push({ lines, qty: `x${item.quantity}` });
    itemTotalLines += lines.length;
  }

  const instrLines = data.specialInstructions ? wrapText(ctx, `NOTE: ${data.specialInstructions}`, W - PAD * 2) : [];
  
  let H = 200 + itemTotalLines * 30 + instrLines.length * 20 + 80;
  canvas.height = Math.max(H, 300);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, canvas.height - 8);

  let y = PAD + 10;

  // Header
  ctx.fillStyle = "#000000";
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("KOT", W / 2, y);
  y += 20;

  ctx.font = `14px ${FONT}`;
  const time = new Date(data.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  ctx.fillText(time, W / 2, y);
  y += 24;

  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 24;

  // Token and Type
  ctx.textAlign = "left";
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(`TOKEN #${data.token}`, PAD, y);

  if (data.orderType) {
    ctx.textAlign = "right";
    const typeLabel = data.orderType === "dine-in" ? "DINE-IN" : data.orderType === "takeaway" ? "TAKEAWAY" : "DELIVERY";
    ctx.fillText(typeLabel, W - PAD, y);
  }
  y += 30;

  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 24;

  // Items
  ctx.fillStyle = "#000000";
  ctx.font = `bold 18px ${FONT}`;
  for (const { lines, qty } of wrappedItems) {
    for (let i = 0; i < lines.length; i++) {
      ctx.textAlign = "left";
      ctx.fillText(lines[i], PAD, y);
      if (i === 0) {
        ctx.textAlign = "right";
        ctx.fillText(qty, W - PAD, y);
      }
      y += 30;
    }
  }

  y += 10;

  // Instructions
  if (data.specialInstructions) {
    drawDashedLine(ctx, PAD, y, W - PAD);
    y += 24;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = "left";
    for (const line of instrLines) {
      ctx.fillText(line, PAD, y);
      y += 20;
    }
  }

  return canvas;
}

/** Build Z-Report canvas */
export function buildZReportCanvas(data: ZReportData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  let expectedHeight = PAD + 10 + 24 + 20 + 24 + 24 + 28 + 28 + 34 + 20 + PAD;
  if (data.paidRevenue !== undefined) expectedHeight += 28;
  if (data.pendingRevenue !== undefined) expectedHeight += 28;

  canvas.width = W;
  canvas.height = expectedHeight;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, expectedHeight);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, expectedHeight - 8);

  let y = PAD + 10;

  // Header
  ctx.fillStyle = "#111827";
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(data.business?.restaurantName || "The Chinese House", W / 2, y);
  y += 24;

  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText("END OF DAY SUMMARY", W / 2, y);
  y += 20;

  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = "#6b7280";
  ctx.fillText(data.label, W / 2, y);
  y += 24;

  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 24;

  // Metrics
  const drawRow = (label: string, value: string, bold = false) => {
    ctx.textAlign = "left";
    ctx.font = bold ? `bold 16px ${FONT}` : `14px ${FONT}`;
    ctx.fillStyle = "#111827";
    ctx.fillText(label, PAD, y);
    ctx.textAlign = "right";
    ctx.fillText(value, W - PAD, y);
    y += 28;
  };

  drawRow("Total Orders:", String(data.totalOrders), true);
  drawRow("Total Revenue:", fmt(data.totalRevenue), true);
  
  y += 10;
  drawDashedLine(ctx, PAD, y, W - PAD);
  y += 24;

  if (data.paidRevenue !== undefined) {
    drawRow("Paid Revenue:", fmt(data.paidRevenue));
  }
  if (data.pendingRevenue !== undefined) {
    drawRow("Pending Dues:", fmt(data.pendingRevenue));
  }

  y += 20;
  ctx.textAlign = "center";
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#9ca3af";
  ctx.fillText("Generated from POS", W / 2, y);

  return canvas;
}

/** Open Z-Report in a new window and trigger print dialog */
export function printZReport(data: ZReportData) {
  const canvas = buildZReportCanvas(data);
  const dataUrl = canvas.toDataURL("image/png");

  if (window.electronAPI) {
    window.electronAPI.printReceipt(dataUrl);
    return;
  }

  const printWindow = window.open("", "_blank", "width=500,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
    <head><title>Print Z-Report</title></head>
    <body style="margin:0; display:flex; justify-content:center; align-items:flex-start; padding-top: 20px;">
      <img src="${dataUrl}" style="width: 80mm; max-width: 100%; height: auto; object-fit: contain;" onload="window.print();window.close();" />
    </body>
    </html>
  `);
  printWindow.document.close();
}

/** Open KOT in a new window and trigger print dialog */
export function printKot(data: ReceiptData) {
  const canvas = buildKotCanvas(data);
  const dataUrl = canvas.toDataURL("image/png");

  if (window.electronAPI) {
    window.electronAPI.printReceipt(dataUrl);
    return;
  }

  const printWindow = window.open("", "_blank", "width=500,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
    <head><title>Print KOT</title></head>
    <body style="margin:0; display:flex; justify-content:center; align-items:flex-start; padding-top: 20px;">
      <img src="${dataUrl}" style="width: 80mm; max-width: 100%; height: auto; object-fit: contain;" onload="window.print();window.close();" />
    </body>
    </html>
  `);
  printWindow.document.close();
}