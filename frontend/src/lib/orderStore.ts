// Simple localStorage-based order store with cross-tab sync via storage events.
// Replace this with your own backend API calls when deploying.

import {
  calculateOrderPricing,
  type BusinessSettings as StoredBusinessSettings,
} from "./billing";

export interface OrderItem {
  id: string | number; // menu_item_id or menu_item_id-variant_name
  name: string;
  price: number;
  priceLabel: string;
  quantity: number;
  image: string;
  note?: string;
  category?: string;
}

export interface Order {
  id: string;
  token: number;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal?: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  gst?: number;
  gstRate?: number;
  couponCode?: string | null;
  business?: {
    restaurantName?: string;
    gstin?: string | null;
    address?: string;
  };
  total: number;
  paymentMethod: "counter" | "online";
  paymentStatus: "pending" | "paid";
  paidAmount: number;
  status: "new" | "preparing" | "ready" | "completed" | "cancelled";
  createdAt: string;
  orderType?: "dine-in" | "takeaway" | "delivery";
  specialInstructions?: string;
  orderSource?: "counter" | "table";
  tableSessionId?: string | null;
  tableNumber?: string;
  waiterId?: string | null;
  waiterName?: string | null;
}

const ORDERS_KEY = "chinese_house_orders";
const TOKEN_KEY = "chinese_house_next_token";
const BUSINESS_SETTINGS_KEY = "chinese_house_business_settings";

const DEFAULT_BUSINESS_SETTINGS: StoredBusinessSettings = {
  restaurantName: "Classic Chinese",
  gstin: null,
  address: "",
  phone: "",
  email: "",
  isGstEnabled: true,
  cgstRate: 2.5,
  sgstRate: 2.5,
};

function getOrders(): Order[] {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  // Dispatch a custom event for same-tab reactivity
  window.dispatchEvent(new Event("orders-updated"));
}

export function getBusinessSettings(): StoredBusinessSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(BUSINESS_SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_BUSINESS_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_BUSINESS_SETTINGS;
  }
}

export function updateBusinessSettings(
  next: Partial<StoredBusinessSettings>,
): StoredBusinessSettings {
  const current = getBusinessSettings();
  const merged: StoredBusinessSettings = {
    ...current,
    ...next,
    gstin: next.gstin === undefined ? current.gstin : next.gstin,
  };
  localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

function getNextToken(): number {
  const today = new Date().toDateString();
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        const next = parsed.token + 1;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ date: today, token: next }));
        return next;
      }
    } catch { /* reset */ }
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ date: today, token: 1 }));
  return 1;
}

export function placeOrder(
  customerName: string,
  customerPhone: string,
  items: OrderItem[],
  paymentMethod: "counter" | "online",
  couponCode?: string,
  orderType?: "dine-in" | "takeaway" | "delivery",
  specialInstructions?: string,
  orderSource?: "counter" | "table",
  tableSessionId?: string | null
): Order {
  const token = getNextToken();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const businessSettings = getBusinessSettings();
  const pricing = calculateOrderPricing(subtotal, 0, businessSettings);
  const order: Order = {
    id: crypto.randomUUID(),
    token,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    items,
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    cgst: pricing.cgst,
    sgst: pricing.sgst,
    gstRate: pricing.cgstRate + pricing.sgstRate,
    business: {
      restaurantName: businessSettings.restaurantName,
      gstin: businessSettings.gstin,
      address: businessSettings.address,
    },
    total: pricing.total,
    paymentMethod,
    paymentStatus: paymentMethod === "online" ? "paid" : "pending",
    paidAmount: paymentMethod === "online" ? pricing.total : 0,
    status: "new",
    createdAt: new Date().toISOString(),
    orderType: orderType || "dine-in",
    couponCode: couponCode || null,
    specialInstructions: specialInstructions || "",
    orderSource: orderSource || "counter",
    tableSessionId: tableSessionId || null,
  };
  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
  return order;
}

export function getAllOrders(): Order[] {
  return getOrders().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTodayOrders(): Order[] {
  const today = new Date().toDateString();
  return getAllOrders().filter(
    (o) => new Date(o.createdAt).toDateString() === today
  );
}

export function updateOrderStatus(orderId: string, status: Order["status"]) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = status;
    if (status === "completed" && orders[idx].paymentMethod === "counter") {
      orders[idx].paymentStatus = "paid";
    }
    saveOrders(orders);
  }
}

export function updatePaymentStatus(orderId: string, paymentStatus: Order["paymentStatus"]) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    orders[idx].paymentStatus = paymentStatus;
    saveOrders(orders);
  }
}

// Hook helper for listening to order changes across tabs
export function subscribeToOrders(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === ORDERS_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener("orders-updated", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("orders-updated", onCustom);
  };
}

// ─── Reviews (localStorage fallback) ──────────────────────

export interface Review {
  id: number;
  itemName: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  createdAt: string;
}

export interface ReviewSummary {
  reviewCount: number;
  avgRating: number;
}

const REVIEWS_KEY = "chinese_house_reviews";
let reviewIdCounter = 0;

function getReviews(): Review[] {
  try {
    const reviews = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]");
    if (reviews.length > 0) {
      reviewIdCounter = Math.max(...reviews.map((r: Review) => r.id));
    }
    return reviews;
  } catch {
    return [];
  }
}

function saveReviews(reviews: Review[]) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  window.dispatchEvent(new Event("reviews-updated"));
}

export function addReview(
  itemName: string,
  reviewerName: string,
  rating: number,
  reviewText: string
): Review {
  const reviews = getReviews();
  reviewIdCounter++;
  const review: Review = {
    id: reviewIdCounter,
    itemName,
    reviewerName: reviewerName.trim(),
    rating,
    reviewText: reviewText.trim(),
    createdAt: new Date().toISOString(),
  };
  reviews.push(review);
  saveReviews(reviews);
  return review;
}

export function getItemReviews(
  itemName: string,
  limit = 3,
  offset = 0
): { reviews: Review[]; summary: ReviewSummary } {
  const all = getReviews()
    .filter((r) => r.itemName === itemName)
    .sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const avg = all.length > 0 ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
  return {
    reviews: all.slice(offset, offset + limit),
    summary: {
      reviewCount: all.length,
      avgRating: parseFloat(avg.toFixed(1)),
    },
  };
}

export function getReviewSummary(): Record<string, ReviewSummary> {
  const all = getReviews();
  const map: Record<string, { sum: number; count: number }> = {};
  for (const r of all) {
    if (!map[r.itemName]) map[r.itemName] = { sum: 0, count: 0 };
    map[r.itemName].sum += r.rating;
    map[r.itemName].count++;
  }
  const result: Record<string, ReviewSummary> = {};
  for (const [name, data] of Object.entries(map)) {
    result[name] = {
      reviewCount: data.count,
      avgRating: parseFloat((data.sum / data.count).toFixed(1)),
    };
  }
  return result;
}
