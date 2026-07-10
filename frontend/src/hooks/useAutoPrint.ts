import { useEffect, useRef, useCallback, useState } from "react";
import { socket } from "@/lib/socket";
import { printQueue, isAutoPrintSupported } from "@/lib/printQueue";
import type { ReceiptData } from "@/lib/receiptGenerator";
import type { Order } from "@/lib/apiClient";

/** Convert an Order object to ReceiptData */
function orderToReceiptData(order: Order): ReceiptData {
  return {
    token: order.token,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    items: order.items.map((i) => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    cgst: order.cgst,
    sgst: order.sgst,
    cgstRate: (order as any).cgstRate ?? (order.gstRate ? order.gstRate / 2 : 2.5),
    sgstRate: (order as any).sgstRate ?? (order.gstRate ? order.gstRate / 2 : 2.5),
    gst: order.gst,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paidAmount: order.paidAmount,
    createdAt: order.createdAt,
    business: order.business,
    tableNumber: order.tableNumber,
  } as any;
}

/**
 * Hook: auto-prints receipts via a sequential queue in Electron.
 * Tracks printed IDs to prevent duplicates across re-renders/reconnects.
 */
export function useAutoPrint(orders: Order[]) {
  const printedNewRef = useRef<Set<string>>(new Set());
  const printedPaidRef = useRef<Set<string>>(new Set());
  const prevOrderMapRef = useRef<Map<string, Order>>(new Map());
  const initialLoadRef = useRef(true);

  // Expose queue state for optional UI indicator
  const [queueState, setQueueState] = useState(printQueue.state);

  useEffect(() => {
    return printQueue.subscribe(setQueueState);
  }, []);

  const buildOrderMap = useCallback((list: Order[]) => {
    const map = new Map<string, Order>();
    for (const o of list) map.set(o.id, o);
    return map;
  }, []);

  // Auto-print new orders via queue
  useEffect(() => {
    if (!isAutoPrintSupported()) return;

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      for (const o of orders) printedNewRef.current.add(o.id);
      prevOrderMapRef.current = buildOrderMap(orders);
      return;
    }

    for (const order of orders) {
      if (!printedNewRef.current.has(order.id)) {
        printedNewRef.current.add(order.id);
        printQueue.enqueue(`new:${order.id}`, "kot", orderToReceiptData(order));
      }
    }

    prevOrderMapRef.current = buildOrderMap(orders);
  }, [orders, buildOrderMap]);

  // Auto-print when due payment is completed via queue
  useEffect(() => {
    if (!isAutoPrintSupported()) return;
    if (initialLoadRef.current) return;

    const prevMap = prevOrderMapRef.current;

    for (const order of orders) {
      if (printedPaidRef.current.has(order.id)) continue;

      const prev = prevMap.get(order.id);
      if (prev && prev.paymentStatus === "pending" && order.paymentStatus === "paid") {
        printedPaidRef.current.add(order.id);
        printQueue.enqueue(`paid:${order.id}`, "receipt", orderToReceiptData(order));
      }
    }
  }, [orders]);

  // Socket listener (no-op handler, orders refresh triggers diff logic above)
  useEffect(() => {
    if (!isAutoPrintSupported()) return;
    const noop = () => {};
    socket.on("payment-updated", noop);
    return () => { socket.off("payment-updated", noop); };
  }, []);

  return queueState;
}
