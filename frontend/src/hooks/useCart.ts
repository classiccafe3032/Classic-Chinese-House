import { useState, useCallback, useEffect } from "react";
import type { OrderItem } from "@/lib/orderStore";
import { getTenantSlug } from "@/lib/apiClient";

const BASE_CART_KEY = "hennys_cart";

export function useCart() {
  const slug = getTenantSlug() || "default";
  const CART_KEY = `${BASE_CART_KEY}_${slug}`;

  const [items, setItems] = useState<OrderItem[]>([]);

  // Load cart when slug changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      setItems(stored ? JSON.parse(stored) : []);
    } catch {
      setItems([]);
    }
  }, [CART_KEY]);

  // Save cart when items change
  useEffect(() => {
    if (items.length > 0 || localStorage.getItem(CART_KEY)) {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    }
  }, [items, CART_KEY]);

  const addItem = useCallback((item: Omit<OrderItem, "quantity"> & { quantity?: number }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const qtyToAdd = item.quantity || 1;
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + qtyToAdd } : i
        );
      }
      return [...prev, { ...item, quantity: qtyToAdd }];
    });
  }, []);

  const removeItem = useCallback((id: string | number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string | number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, total, count };
}
