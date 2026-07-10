import { Capacitor } from "@capacitor/core";
import { BluetoothPrinter } from "@candraadiw/capacitor-bluetooth-printer";
import type { Order, OrderItem } from "./orderStore";

// ESC/POS Commands
const ESC = "\x1B";
const GS = "\x1D";

const INIT = ESC + "@";
const ALIGN_LEFT = ESC + "a0";
const ALIGN_CENTER = ESC + "a1";
const ALIGN_RIGHT = ESC + "a2";
const BOLD_ON = ESC + "E1";
const BOLD_OFF = ESC + "E0";
const TEXT_NORMAL = ESC + "!\x00";
const TEXT_DOUBLE_HEIGHT = ESC + "!\x10";
const TEXT_DOUBLE_WIDTH = ESC + "!\x20";
const TEXT_DOUBLE_BOTH = ESC + "!\x30";
const CUT_PAPER = GS + "V1";

export async function printReceiptNative(
  order: Order,
  business: { restaurantName: string; address?: string; phone?: string; gstin?: string | null },
  printerWidth: string = "58mm",
  isKOT: boolean = false
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("Native printing is not available in browser.");
    return false;
  }

  // 32 chars for 58mm, 48 chars for 80mm
  const lineLength = printerWidth === "80mm" ? 48 : 32;

  let receipt = INIT;

  // Helper to pad strings for alignment
  const padRight = (str: string, len: number) => str.padEnd(len, " ").substring(0, len);
  const padLeft = (str: string, len: number) => str.padStart(len, " ").substring(0, len);
  const padBetween = (left: string, right: string, len: number) => {
    const spaces = len - left.length - right.length;
    return left + (spaces > 0 ? " ".repeat(spaces) : " ") + right;
  };
  const separator = "-".repeat(lineLength) + "\n";
  const thickSeparator = "=".repeat(lineLength) + "\n";

  if (isKOT) {
    receipt += ALIGN_CENTER + BOLD_ON + TEXT_DOUBLE_BOTH + "K.O.T\n\n" + TEXT_NORMAL + BOLD_OFF;
    receipt += ALIGN_LEFT;
    const orderRef = order.token ? String(order.token).toUpperCase() : (order.id ? String(order.id).split('-')[0] : "NEW");
    receipt += `Order #: ${orderRef}\n`;
    receipt += `Time: ${new Date(order.createdAt).toLocaleTimeString()}\n`;
    receipt += `Type: ${order.orderType?.toUpperCase() || "DINE-IN"}\n`;
    if ((order as any).tableNumber) {
      receipt += `Table: ${(order as any).tableNumber}\n`;
    } else if (order.tableSessionId) {
      receipt += `Table: ${order.tableSessionId.split("-")[0]}\n`;
    }
    receipt += thickSeparator;
    
    receipt += BOLD_ON;
    receipt += padBetween("ITEM", "QTY", lineLength) + "\n";
    receipt += BOLD_OFF;
    receipt += separator;

    order.items.forEach(item => {
      let itemName = item.name.substring(0, lineLength - 8);
      receipt += padBetween(itemName, item.quantity.toString(), lineLength) + "\n";
    });

    receipt += thickSeparator;
    if (order.specialInstructions) {
      receipt += `Notes: ${order.specialInstructions}\n`;
    }
  } else {
    // BILL
    receipt += ALIGN_CENTER + BOLD_ON + TEXT_DOUBLE_HEIGHT + business.restaurantName + "\n\n" + TEXT_NORMAL + BOLD_OFF;
    if (business.address) {
      receipt += business.address + "\n";
    }
    if (business.phone) {
      receipt += "Ph: " + business.phone + "\n";
    }
    if (business.gstin) {
      receipt += "GSTIN: " + business.gstin + "\n";
    }
    let taxes = (order.cgst || 0) + (order.sgst || 0) + (order.gst || 0);
    if (taxes > 0) {
      receipt += "\nTAX INVOICE\n";
    } else {
      receipt += "\nINVOICE\n";
    }
    
    receipt += ALIGN_LEFT;
    receipt += separator;
    const orderRef = order.token ? String(order.token).toUpperCase() : (order.id ? String(order.id).split('-')[0] : "NEW");
    receipt += `Order #: ${orderRef}\n`;
    receipt += `Date: ${new Date(order.createdAt).toLocaleString()}\n`;
    receipt += `Customer: ${order.customerName || "Walk-in"}\n`;
    if (order.customerPhone && order.customerPhone !== "0000000000") {
      receipt += `Phone: ${order.customerPhone}\n`;
    }
    receipt += separator;

    receipt += BOLD_ON;
    receipt += padBetween("ITEM x QTY", "AMOUNT", lineLength) + "\n";
    receipt += BOLD_OFF;
    receipt += separator;

    let subtotal = 0;
    order.items.forEach(item => {
      let lineTotal = item.price * item.quantity;
      subtotal += lineTotal;
      let itemName = item.name.substring(0, lineLength - 10);
      let left = `${itemName} x${item.quantity}`;
      receipt += padBetween(left, lineTotal.toFixed(2), lineLength) + "\n";
    });

    receipt += separator;
    receipt += ALIGN_RIGHT;
    receipt += padBetween("Subtotal:", subtotal.toFixed(2), lineLength) + "\n";
    
    if (taxes > 0) {
      receipt += padBetween("Taxes:", taxes.toFixed(2), lineLength) + "\n";
    }
    if (order.discount && order.discount > 0) {
      receipt += padBetween("Discount:", "-" + order.discount.toFixed(2), lineLength) + "\n";
    }

    receipt += thickSeparator;
    receipt += BOLD_ON;
    receipt += padBetween("TOTAL:", (order.total || subtotal).toFixed(2), lineLength) + "\n";
    receipt += BOLD_OFF;
    receipt += thickSeparator;
    
    receipt += ALIGN_CENTER;
    receipt += "Thank you for dining with us!\n";
    receipt += "Please visit again\n";
  }

  // Feed paper & Cut
  receipt += "\n\n\n\n\n";
  receipt += CUT_PAPER;

  try {
    // Before printing, we need to ensure we are connected to a printer.
    // The UI should have handled this, but we'll try to just print.
    // The plugin might automatically use the last connected printer,
    // or we might need to connect first. We will assume the UI connects it.
    await BluetoothPrinter.print({ data: receipt });
    return true;
  } catch (err) {
    console.error("Bluetooth print failed:", err);
    return false;
  }
}

export async function printZReportNative(
  report: import("./receiptGenerator").ZReportData,
  business: { restaurantName: string; address?: string; phone?: string; gstin?: string | null },
  printerWidth: string = "58mm"
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const lineLength = printerWidth === "80mm" ? 48 : 32;
  let receipt = INIT;

  const padRight = (str: string, len: number) => str.padEnd(len, " ").substring(0, len);
  const padLeft = (str: string, len: number) => str.padStart(len, " ").substring(0, len);
  const padBetween = (left: string, right: string, len: number) => {
    const space = len - left.length - right.length;
    if (space <= 0) return left + " " + right;
    return left + " ".repeat(space) + right;
  };

  const separator = "-".repeat(lineLength) + "\n";
  const thickSeparator = "=".repeat(lineLength) + "\n";

  // Header
  receipt += ALIGN_CENTER;
  receipt += BOLD_ON + TEXT_DOUBLE_HEIGHT + business.restaurantName + BOLD_OFF + TEXT_NORMAL + "\n";
  
  if (business.address) {
    receipt += business.address + "\n";
  }
  if (business.phone) {
    receipt += "Phone: " + business.phone + "\n";
  }
  if (business.gstin) {
    receipt += "GSTIN: " + business.gstin + "\n";
  }
  
  receipt += separator;
  receipt += BOLD_ON + TEXT_DOUBLE_WIDTH + "Z-REPORT" + TEXT_NORMAL + BOLD_OFF + "\n";
  receipt += report.label + "\n";
  receipt += separator;

  // Body
  receipt += ALIGN_LEFT;
  receipt += padBetween("Total Orders:", `${report.totalOrders}`, lineLength) + "\n";
  receipt += padBetween("Total Revenue:", `Rs.${(report.totalRevenue || 0).toFixed(2)}`, lineLength) + "\n";
  
  if (report.paidRevenue !== undefined) {
    receipt += padBetween("Paid:", `Rs.${report.paidRevenue.toFixed(2)}`, lineLength) + "\n";
  }
  if (report.pendingRevenue !== undefined) {
    receipt += padBetween("Pending:", `Rs.${report.pendingRevenue.toFixed(2)}`, lineLength) + "\n";
  }
  
  receipt += thickSeparator;
  receipt += ALIGN_CENTER;
  receipt += "End of Report\n";

  // Feed & Cut
  receipt += "\n\n\n\n\n";
  receipt += CUT_PAPER;

  try {
    await BluetoothPrinter.print({ data: receipt });
    return true;
  } catch (err) {
    console.error("Bluetooth Z-Report print failed:", err);
    return false;
  }
}

export async function printQRCodeNative(
  url: string,
  label: string
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const dataLen = url.length + 3;
  const pL = String.fromCharCode(dataLen % 256);
  const pH = String.fromCharCode(Math.floor(dataLen / 256));
  
  let receipt = INIT;
  receipt += ALIGN_CENTER;
  
  receipt += BOLD_ON + TEXT_DOUBLE_HEIGHT + label + BOLD_OFF + TEXT_NORMAL + "\n\n";
  receipt += "Scan to view menu & order!\n\n";

  receipt += '\x1d\x28\x6b\x04\x00\x31\x41\x32\x00'; 
  receipt += '\x1d\x28\x6b\x03\x00\x31\x43\x08'; 
  receipt += '\x1d\x28\x6b\x03\x00\x31\x45\x30'; 
  receipt += '\x1d\x28\x6b' + pL + pH + '\x31\x50\x30' + url; 
  receipt += '\x1d\x28\x6b\x03\x00\x31\x51\x30'; 
  
  receipt += "\n\n\n\n";
  receipt += CUT_PAPER;

  try {
    await BluetoothPrinter.print({ data: receipt });
    return true;
  } catch (err) {
    console.error("Bluetooth QR print failed:", err);
    return false;
  }
}
