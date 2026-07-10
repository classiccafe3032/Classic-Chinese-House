import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiGetTodayOrders,
  apiGetAllOrders,
  type Order,
} from "@/lib/apiClient";
import { socket } from "@/lib/socket";

export function useOrders(todayOnly = true) {
  const [orders, setOrders] = useState<Order[]>([]);

  // Track order IDs currently being optimistically updated
  const lockedIdsRef = useRef<Set<string>>(new Set());

  const refreshOrders = useCallback(async () => {
    try {
      const data = todayOnly
        ? await apiGetTodayOrders()
        : await apiGetAllOrders();

      setOrders((prev) => {
        // If no orders are locked, use server data directly
        if (lockedIdsRef.current.size === 0) return data;

        // Merge: keep optimistic version for locked orders, use server data for rest
        return data.map((serverOrder) => {
          if (lockedIdsRef.current.has(serverOrder.id)) {
            const optimistic = prev.find((o) => o.id === serverOrder.id);
            return optimistic ?? serverOrder;
          }
          return serverOrder;
        });
      });
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  }, [todayOnly]);

  /** Optimistically update a single order's status in React state */
  const optimisticUpdateStatus = useCallback(
    (orderId: string, newStatus: Order["status"]) => {
      lockedIdsRef.current.add(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
    },
    [],
  );

  /** Unlock an order so future server refreshes can overwrite it */
  const unlockOrder = useCallback((orderId: string) => {
    lockedIdsRef.current.delete(orderId);
  }, []);

  useEffect(() => {
    refreshOrders();

    socket.on("connect", refreshOrders);
    socket.on("new-order", refreshOrders);
    socket.on("order-updated", refreshOrders);
    socket.on("orders-updated", refreshOrders);
    socket.on("payment-updated", refreshOrders);

    return () => {
      socket.off("connect", refreshOrders);
      socket.off("new-order", refreshOrders);
      socket.off("order-updated", refreshOrders);
      socket.off("orders-updated", refreshOrders);
      socket.off("payment-updated", refreshOrders);
    };
  }, [refreshOrders]);

  return { orders, refreshOrders, optimisticUpdateStatus, unlockOrder };
}
