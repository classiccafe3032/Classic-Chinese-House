// GST-compliant PDF invoice generator using jsPDF

import { roundCurrency } from "./billing";
import type { ReceiptData } from "./receiptGenerator";

function fmt(v: number): string {
  return `₹${roundCurrency(v).toFixed(2)}`;
}

export async function downloadInvoicePdf(data: ReceiptData) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = W - margin * 2;
  let y = margin;

  const restaurantName =
    data.business?.restaurantName || "The Chinese House";
  const gstin = data.business?.gstin;
  const address = data.business?.address;

  // ─── Header ───
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(restaurantName, W / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  if (gstin) {
    doc.text(`GSTIN: ${gstin}`, W / 2, y, { align: "center" });
    y += 5;
  }
  if (address) {
    doc.text(address, W / 2, y, { align: "center" });
    y += 5;
  }
  y += 2;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("TAX INVOICE", W / 2, y, { align: "center" });
  y += 8;

  // ─── Invoice meta ───
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);

  const invoiceNo = `INV-${data.token.toString().padStart(5, "0")}`;
  const dateStr = new Date(data.createdAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  doc.text(`Invoice No: ${invoiceNo}`, margin, y);
  doc.text(`Date: ${dateStr}`, W - margin, y, { align: "right" });
  y += 5;
  doc.text(`Token: #${data.token}`, margin, y);
  if (data.orderType) {
    const typeLabel = data.orderType === "dine-in" ? "Dine-in" : data.orderType === "takeaway" ? "Takeaway" : "Delivery";
    doc.text(`Order Type: ${typeLabel}`, W - margin, y, { align: "right" });
  }
  y += 5;
  doc.text(`Customer: ${data.customerName}`, margin, y);
  doc.text(`Phone: ${data.customerPhone}`, W - margin, y, { align: "right" });
  y += 5;

  if (data.specialInstructions) {
    doc.setTextColor(100);
    doc.setFontSize(9);
    const instrLines = doc.splitTextToSize(`Special Instructions: ${data.specialInstructions}`, contentW);
    doc.text(instrLines, margin, y);
    y += instrLines.length * 4 + 2;
    doc.setTextColor(60);
    doc.setFontSize(10);
  }

  y += 2;

  doc.line(margin, y, W - margin, y);
  y += 6;

  // ─── Items table header ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text("#", margin, y);
  doc.text("Item", margin + 8, y);
  doc.text("Qty", margin + contentW * 0.6, y, { align: "center" });
  doc.text("Rate", margin + contentW * 0.75, y, { align: "right" });
  doc.text("Amount", W - margin, y, { align: "right" });
  y += 4;
  doc.line(margin, y, W - margin, y);
  y += 5;

  // ─── Items ───
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);
  data.items.forEach((item, i) => {
    const amount = item.price * item.quantity;

    // Wrap long item names
    const maxNameW = contentW * 0.5;
    const nameLines = doc.splitTextToSize(item.name, maxNameW);

    doc.text(`${i + 1}`, margin, y);
    doc.text(nameLines, margin + 8, y);
    doc.text(`${item.quantity}`, margin + contentW * 0.6, y, {
      align: "center",
    });
    doc.text(fmt(item.price), margin + contentW * 0.75, y, { align: "right" });
    doc.text(fmt(amount), W - margin, y, { align: "right" });
    y += Math.max(nameLines.length, 1) * 5 + 2;

    if (y > 260) {
      doc.addPage();
      y = margin;
    }
  });

  y += 2;
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ─── Totals ───
  const totalsX = margin + contentW * 0.55;
  const valX = W - margin;

  const drawTotalRow = (
    label: string,
    value: string,
    bold = false,
    color: [number, number, number] = [30, 30, 30],
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 10);
    doc.setTextColor(...color);
    doc.text(label, totalsX, y);
    doc.text(value, valX, y, { align: "right" });
    y += 6;
  };

  drawTotalRow("Subtotal", fmt(data.subtotal ?? data.total));

  if ((data.discount ?? 0) > 0) {
    const discountLabel = data.couponCode
      ? `Discount (${data.couponCode})`
      : "Discount";
    drawTotalRow(discountLabel, `-${fmt(data.discount!)}`, false, [5, 150, 105]);
  }

  const cgst = data.cgst ?? 0;
  const sgst = data.sgst ?? 0;
  if (cgst + sgst > 0) {
    const cgstPct = data.cgstRate ?? 2.5;
    const sgstPct = data.sgstRate ?? 2.5;
    drawTotalRow(`CGST @ ${cgstPct}%`, fmt(cgst));
    drawTotalRow(`SGST @ ${sgstPct}%`, fmt(sgst));
  }

  y += 2;
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, W - margin, y);
  y += 6;

  drawTotalRow("Total", fmt(data.total), true);

  // ─── Payment info ───
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const payLabel =
    data.paymentMethod === "counter" ? "Pay at Counter" : "Paid Online";
  doc.text(`Payment Method: ${payLabel}`, margin, y);

  const paidAmt = data.paidAmount ?? data.total;
  if (paidAmt < data.total) {
    const due = roundCurrency(data.total - paidAmt);
    doc.text(`Amount Due: ${fmt(due)}`, W - margin, y, { align: "right" });
  }
  y += 10;

  // ─── Footer ───
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Thank you for your order!", W / 2, y, { align: "center" });
  y += 4;
  doc.text("This is a computer-generated invoice.", W / 2, y, {
    align: "center",
  });

  doc.save(`invoice-${invoiceNo}.pdf`);
}
