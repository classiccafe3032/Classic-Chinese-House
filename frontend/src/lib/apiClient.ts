// API client that uses REST API when VITE_API_URL is set, otherwise falls back to localStorage.

import {
  placeOrder as localPlaceOrder,
  getAllOrders as localGetAllOrders,
  getTodayOrders as localGetTodayOrders,
  updateOrderStatus as localUpdateOrderStatus,
  updatePaymentStatus as localUpdatePaymentStatus,
  subscribeToOrders as localSubscribeToOrders,
  addReview as localAddReview,
  getItemReviews as localGetItemReviews,
  getReviewSummary as localGetReviewSummary,
  getBusinessSettings as localGetBusinessSettings,
  updateBusinessSettings as localUpdateBusinessSettings,
  type Order,
  type OrderItem,
  type Review,
  type ReviewSummary,
} from "./orderStore";

export const API_URL = import.meta.env.VITE_API_URL as string | undefined;

function isApiMode(): boolean {
  return !!API_URL;
}

// ─── Admin Token Management ──────────────────────────────
const ADMIN_TOKEN_KEY = "admin_auth_token";
const STAFF_TOKEN_KEY = "staff_auth_token";

function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getStaffToken(): string | null {
  return localStorage.getItem(STAFF_TOKEN_KEY);
}

function setStaffToken(token: string): void {
  localStorage.setItem(STAFF_TOKEN_KEY, token);
}

function clearStaffToken(): void {
  localStorage.removeItem(STAFF_TOKEN_KEY);
}

function getActiveToken(): string | null {
  // If we are on the admin dashboard, strictly prefer the admin token.
  // Otherwise, staff token takes precedence for POS/Kitchen areas.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
    return getAdminToken() || getStaffToken();
  }
  return getStaffToken() || getAdminToken();
}

// ─── Refresh Token Logic ─────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/admin/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        clearAdminToken();
        return null;
      }
      const data = await res.json();
      if (data.token) {
        setAdminToken(data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Wrapper around fetch that auto-refreshes on 401 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, options);

  if (res.status === 401 && isApiMode()) {
    // If a staff token was being used and returned 401, it is expired/invalid. 
    // Staff tokens cannot be refreshed, so we must clear it to avoid a 401 loop.
    if (getStaffToken()) {
      clearStaffToken();
    }

    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with new token
      const newHeaders = new Headers(options.headers);
      newHeaders.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, { ...options, headers: newHeaders });
    }
  }

  return res;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const token = getActiveToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function dashHeaders(password?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (password) headers["x-dashboard-password"] = password;
  const token = getActiveToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Kept as no-op for compatibility with components that still call it
export function setTenantSlug(_slug: string | null) {}
export function getTenantSlug() {
  return null;
}

let dashboardPassword = "";
export function setDashboardPassword(pw: string) {
  dashboardPassword = pw;
}
export function getDashboardPassword() {
  return dashboardPassword;
}



// ─── Admin Auth APIs (Bearer token-based) ────────────────

export async function apiAdminLogin(username: string, password: string): Promise<{ message: string, user: AuthUser, features?: Record<string, any> }> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  if (data.token) setAdminToken(data.token);
  return data;
}

// ─── WebAuthn APIs ────────────────
export async function apiWebAuthnGenerateRegistration() {
  const res = await fetch(`${API_URL}/webauthn/generate-registration-options`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate registration options");
  return data;
}

export async function apiWebAuthnVerifyRegistration(response: any) {
  const res = await fetch(`${API_URL}/webauthn/verify-registration`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(response),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to verify registration");
  return data;
}

export async function apiWebAuthnGenerateAuthentication() {
  const res = await fetch(`${API_URL}/webauthn/generate-authentication-options`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate auth options");
  return data;
}

export async function apiWebAuthnVerifyAuthentication(body: any, authSessionId: string): Promise<{ message: string, user: AuthUser, features?: Record<string, any> }> {
  const res = await fetch(`${API_URL}/webauthn/verify-authentication`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body, authSessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Passkey login failed");
  if (data.token) setAdminToken(data.token);
  return data;
}

export interface AuthUser {
  name: string;
  role: "admin" | "manager" | "waiter" | "kitchen";
  phone?: string;
  features?: Record<string, any>;
  permissions?: {
    canClearTable?: boolean;
    canTransferTable?: boolean;
    canViewOrderStats?: boolean;
    tabs?: {
      orders?: boolean;
      tables?: boolean;
      sales?: boolean;
      analytics?: boolean;
      content?: boolean;
      management?: boolean;
      system?: boolean;
      staff?: boolean;
    };
    orders?: {
      active?: boolean;
      pos?: boolean;
      history?: boolean;
    };
  };
}

export async function apiAdminCheckAuth(): Promise<{ authenticated: boolean; user?: AuthUser }> {
  let token = getActiveToken();
  let refreshAttempted = false;

  if (!token) {
    if (isApiMode()) {
      token = await refreshAccessToken();
      refreshAttempted = true;
      if (!token) return { authenticated: false };
    } else {
      return { authenticated: false };
    }
  }

  try {
    const res = await fetch(`${API_URL}/admin/me`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) {
      if (!refreshAttempted) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          return apiAdminCheckAuth(); // Retry once with new token
        }
      }
      clearAdminToken();
      clearStaffToken();
      return { authenticated: false };
    }
    const data = await res.json();
    return { 
      authenticated: true, 
      user: {
        ...(data.user || { name: "Owner", role: "admin" }),
        features: data.features || {} 
      }
    };
  } catch {
    return { authenticated: false };
  }
}

export async function apiAdminLogout(): Promise<void> {
  // If we have a staff token, clear just that.
  if (getStaffToken()) {
    clearStaffToken();
    return;
  }

  // Otherwise treat as Owner (admin) logout
  const token = getAdminToken();
  clearAdminToken();
  try {
    await fetch(`${API_URL}/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
    });
  } catch { /* ignore */ }
}

export async function apiAdminRequestReset(username: string): Promise<{ message: string; mobile: string; email: string }> {
  const res = await fetch(`${API_URL}/admin/request-reset`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to request reset");
  return data;
}

export async function apiAdminResetPassword(username: string, otp: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/admin/reset-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username, otp, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Reset failed");
  clearAdminToken();
  return data;
}

// ─── Staff Auth APIs ─────────────────────────────────────

export async function apiStaffLogin(pin: string): Promise<{ message: string; user: AuthUser, features?: Record<string,any> }> {
  const res = await fetch(`${API_URL}/staff/login`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Staff login failed");
  if (data.token) setStaffToken(data.token);
  return data;
}

// ─── Admin Staff Management APIs ─────────────────────────

export interface StaffMember {
  id: string;
  name: string;
  role: "manager" | "waiter" | "kitchen";
  phone?: string;
  is_active: boolean;
  permissions?: Record<string, any>;
  created_at: string;
}

export interface StaffPerformance {
  id: string;
  name: string;
  totalSales: number;
  totalOrders: number;
}

export async function apiAdminListStaff(): Promise<StaffMember[]> {
  const res = await authFetch(`${API_URL}/staff`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch staff");
  return data;
}

export async function apiAdminCreateStaff(name: string, pin: string, role: string, phone?: string, permissions?: any): Promise<StaffMember> {
  const res = await authFetch(`${API_URL}/staff`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, pin, role, phone, permissions }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create staff");
  return data;
}

export async function apiAdminUpdateStaff(id: string, updates: { name?: string; pin?: string; role?: string; phone?: string; is_active?: boolean; permissions?: any }): Promise<StaffMember> {
  const res = await authFetch(`${API_URL}/staff/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update staff");
  return data;
}

export async function apiAdminDeleteStaff(id: string): Promise<{ message: string }> {
  const res = await authFetch(`${API_URL}/staff/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete staff");
  return data;
}

export async function apiGetStaffPerformance(): Promise<StaffPerformance[]> {
  const res = await authFetch(`${API_URL}/dashboard/staff/performance`, {
    headers: authHeaders(),
    cache: 'no-store'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch staff performance");
  return data;
}

// ─── Admin Settings APIs ─────────────────────────────────

export async function apiAdminRequestSettingsOtp(): Promise<{ message: string; mobile: string }> {
  const res = await authFetch(`${API_URL}/admin/request-settings-otp`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to request OTP");
  return data;
}

export async function apiAdminChangePassword(otp: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await authFetch(`${API_URL}/admin/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ otp, currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to change password");
  return data;
}

export async function apiAdminChangeMobile(otp: string, newMobile: string): Promise<{ message: string; mobile: string }> {
  const res = await authFetch(`${API_URL}/admin/change-mobile`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ otp, newMobile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to change mobile");
  return data;
}

export async function apiAdminChangeEmail(otp: string, newEmail: string): Promise<{ message: string; email: string }> {
  const res = await authFetch(`${API_URL}/admin/change-email`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ otp, newEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to change email");
  return data;
}


export async function apiAdminGetInfo(): Promise<{ mobile: string | null; email: string | null }> {
  const res = await authFetch(`${API_URL}/admin/info`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch admin info");
  return data;
}

export interface LandingPageContent {
  about_title: string;
  about_description: string;
  about_cards: { icon: string; title: string; desc: string }[];
  why_choose_us_title: string;
  why_choose_us_cards: { icon: string; title: string; desc: string }[];
  gallery_title: string;
  gift_voucher_title: string;
  gift_voucher_description: string;
  menu_title?: string;
  menu_main_title?: string;
  menu_description?: string;
}

export interface BusinessSettings {
  businessId?: string;
  slug?: string;
  features?: Record<string, any>;
  isActive?: boolean;
  restaurantName: string;
  gstin: string | null;
  address: string;
  phone?: string;
  email?: string;
  isGstEnabled: boolean;
  isOnlinePaymentEnabled?: boolean;
  cgstRate: number;
  sgstRate: number;
  kitchenPin?: string;
  theme?: string;
  layoutTheme?: string;
  orderWorkflow?: "multi-step" | "quick-complete";
  landingPageContent?: LandingPageContent;
  loyaltyEnabled?: boolean;
  loyaltyPointsPer100?: number;
  loyaltyDiscountPerPoint?: number;
  qrRoutingMode?: "claim" | "waiter_unlock";
  printerWidth?: string;
}

export async function apiAdminGetBusinessSettings(): Promise<BusinessSettings> {
  if (!isApiMode()) {
    return localGetBusinessSettings();
  }

  const res = await authFetch(`${API_URL}/admin/business-settings`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch business settings");
  return data;
}

export async function apiAdminUpdateBusinessSettings(
  payload: Partial<BusinessSettings>,
): Promise<BusinessSettings> {
  if (!isApiMode()) {
    return localUpdateBusinessSettings(payload);
  }

  const res = await authFetch(`${API_URL}/admin/business-settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update business settings");
  
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("business-settings-updated"));
  }
  
  return data;
}

export async function apiAdminFactoryReset(confirmText: string): Promise<{ message: string }> {
  if (!isApiMode()) {
    throw new Error("Factory reset is not available in local mode.");
  }

  const res = await authFetch(`${API_URL}/admin/business-settings/factory-reset`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirmText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to reset database");
  return data;
}


export async function apiGetBusinessSettings(): Promise<BusinessSettings> {
  if (!isApiMode()) {
    return localGetBusinessSettings();
  }

  const res = await fetch(`${API_URL}/business-settings`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch business settings");
  return data;
}

// ─── Typed Sales Report ──────────────────────────────────

export type SalesReportType = "daily" | "weekly" | "monthly" | "yearly" | "daywise";

export interface SalesReportDay {
  date: string;
  orders: number;
  revenue: number;
}

export interface SalesReportMonth {
  monthNumber: number;
  month: string;
  orders: number;
  revenue: number;
}

export interface SalesReportData {
  totalOrders: number;
  totalRevenue: number;
  // daily-specific
  paidRevenue?: number;
  pendingRevenue?: number;
  hourlyDistribution?: { hour: number; orders: number; revenue: number }[];
  paymentSplit?: { method: string; count: number; revenue: number }[];
  // weekly-specific
  weekStart?: string;
  weekEnd?: string;
  // monthly-specific
  month?: string;
  year?: string;
  // shared
  days?: SalesReportDay[];
  months?: SalesReportMonth[];
  // item popularity per period
  topItems?: { name: string; qty: number }[];
  leastItems?: { name: string; qty: number }[];
}

// ─── Typed Edit Items ────────────────────────────────────

export interface EditOrderItem {
  id: number | string; // menu_item_id or variant_id string
  name: string;
  price: number;
  priceLabel: string;
  quantity: number;
  image?: string;
}

// ─── Public APIs ──────────────────────────────────────────




export async function apiGetTableSessionBill(sessionId: string): Promise<SessionBill> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/bill`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch bill");
  return res.json();
}

export async function apiPlaceOrder(
  customerName: string,
  customerPhone: string,
  items: OrderItem[],
  paymentMethod: "counter" | "online" | "split",
  couponCode?: string,
  orderType?: "dine-in" | "takeaway" | "delivery",
  specialInstructions?: string,
  orderSource?: "counter" | "table",
  tableSessionId?: string | null,
  splitCash?: number,
  splitUpi?: number,
  paidAmount?: number,
  pointsRedeemed?: number
): Promise<Order> {
  if (!isApiMode()) {
    return localPlaceOrder(
      customerName, customerPhone, items, paymentMethod === "split" ? "counter" : paymentMethod, 
      couponCode, orderType, specialInstructions, orderSource, tableSessionId
    );
  }

  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      customerName, customerPhone, items, paymentMethod,
      couponCode: couponCode || undefined,
      orderType: orderType || "dine-in",
      specialInstructions: specialInstructions || "",
      orderSource: orderSource || "counter",
      tableSessionId: tableSessionId || null,
      splitCash,
      splitUpi,
      paidAmount,
      pointsRedeemed
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Failed to place order");
  return data;
}

export async function apiGetTokens(): Promise<{ id: string; token: number; status: string; customerName?: string }[]> {
  try {
    const res = await fetch(`${API_URL}/orders/tokens`, { 
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    
    interface TokenData {
      id: string | number;
      token: number;
      status: string;
      customerName?: string;
    }
    
    const data = await res.json();
    return data.map((t: TokenData) => ({
      id: String(t.id),
      token: t.token,
      status: t.status,
      customerName: t.customerName,
    }));
  } catch {
    return [];
  }
}

// ─── Reviews APIs ──────────────────────────────────────────

export async function apiGetItemReviews(
  itemName: string,
  limit = 20,
  offset = 0,
): Promise<{ reviews: Review[]; summary: ReviewSummary }> {
  if (!isApiMode()) {
    return localGetItemReviews(itemName, limit, offset);
  }

  const res = await fetch(
    `${API_URL}/reviews?item=${encodeURIComponent(itemName)}&limit=${limit}&offset=${offset}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

export async function apiGetReviewSummary(): Promise<Record<string, ReviewSummary>> {
  if (!isApiMode()) return localGetReviewSummary();

  const res = await fetch(`${API_URL}/reviews/summary`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch review summary");
  return res.json();
}

export async function apiAddReview(
  itemName: string,
  reviewerName: string,
  rating: number,
  reviewText: string,
): Promise<Review> {
  if (!isApiMode()) {
    return localAddReview(itemName, reviewerName, rating, reviewText);
  }

  const res = await fetch(`${API_URL}/reviews`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ itemName, reviewerName, rating, reviewText }),
  });
  if (!res.ok) throw new Error("Failed to add review");
  return res.json();
}

export async function apiAdminSearchReviews(
  query = "",
  limit = 20,
  offset = 0,
): Promise<{ reviews: Review[]; total: number }> {
  const res = await authFetch(
    `${API_URL}/reviews/admin-search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
    { headers: dashHeaders(dashboardPassword) },
  );
  if (!res.ok) throw new Error("Failed to search reviews");
  return res.json();
}

export async function apiGetLoginLogs(): Promise<
  { success: boolean; ip_address: string; user_agent: string; created_at: string }[]
> {
  const res = await authFetch(`${API_URL}/admin/login-logs`, {
    headers: dashHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch login logs");
  return res.json();
}

export async function apiAdminDeleteReview(reviewId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/reviews/${reviewId}`, {
    method: "DELETE",
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to delete review");
}

export async function apiAdminBulkDeleteReviews(ids: number[]): Promise<{ deleted: number[]; count: number }> {
  const res = await authFetch(`${API_URL}/reviews/admin-bulk-delete`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to bulk delete reviews");
  return res.json();
}

export async function apiGetLatestReviews(limit = 8): Promise<Review[]> {
  const res = await fetch(`${API_URL}/reviews/latest?limit=${limit}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch latest reviews");
  return res.json();
}

// ─── Dashboard APIs (password-protected) ──────────────────

export async function apiGetTodayOrders(): Promise<Order[]> {
  if (!isApiMode()) return localGetTodayOrders();

  const res = await authFetch(`${API_URL}/dashboard/orders`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Unauthorized or failed");
  return res.json();
}

export async function apiGetAllOrders(): Promise<Order[]> {
  if (!isApiMode()) return localGetAllOrders();

  const res = await authFetch(`${API_URL}/dashboard/orders/all`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Unauthorized or failed");
  return res.json();
}

export async function apiUpdateOrderStatus(
  orderId: string,
  status: Order["status"],
): Promise<void> {
  if (!isApiMode()) {
    localUpdateOrderStatus(orderId, status);
    return;
  }

  const res = await authFetch(`${API_URL}/dashboard/orders/${orderId}/status`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
}

export async function apiClaimOrder(orderId: string): Promise<{ message: string }> {
  if (!isApiMode()) return { message: "Local mode" };
  const res = await authFetch(`${API_URL}/dashboard/orders/${orderId}/claim`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to claim order");
  return data;
}

export async function apiUpdatePaymentStatus(
  orderId: string,
  paymentStatus: Order["paymentStatus"],
): Promise<void> {
  if (!isApiMode()) {
    localUpdatePaymentStatus(orderId, paymentStatus);
    return;
  }

  const res = await authFetch(`${API_URL}/dashboard/orders/${orderId}/payment`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ paymentStatus }),
  });
  if (!res.ok) throw new Error("Failed to update payment");
}

export async function apiGetDashboardStats() {
  if (!isApiMode()) return null;

  const res = await authFetch(`${API_URL}/dashboard/stats`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function apiGetSalesReport(
  type: SalesReportType,
  params: Record<string, string> = {},
): Promise<SalesReportData> {
  const query = new URLSearchParams({ type, ...params }).toString();

  const res = await authFetch(`${API_URL}/dashboard/sales-report?${query}`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch sales report");
  return res.json();
}

// ─── Subscription ────

export function apiSubscribeToOrders(
  callback: () => void,
  intervalMs = 3000,
): () => void {
  if (!isApiMode()) return localSubscribeToOrders(callback);

  const id = setInterval(callback, intervalMs);
  return () => clearInterval(id);
}

// ─── Update Order Items (Admin) ────

export async function apiUpdateOrderItems(
  orderId: string,
  items: EditOrderItem[],
): Promise<{ message: string; order: Order }> {
  if (!isApiMode()) {
    throw new Error("Edit order only supported in API mode");
  }

  const res = await authFetch(`${API_URL}/dashboard/orders/${orderId}/items`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ items }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update order");
  return data;
}

// ─── Cancel Order (Admin) ────

export async function apiCancelOrder(orderId: string): Promise<void> {
  return apiUpdateOrderStatus(orderId, "cancelled");
}

// ─── Delete Order (Admin) ────

export async function apiDeleteOrder(orderId: string): Promise<{ message: string }> {
  if (!isApiMode()) {
    throw new Error("Delete order only supported in API mode");
  }

  const res = await authFetch(`${API_URL}/dashboard/orders/${orderId}`, {
    method: "DELETE",
    headers: dashHeaders(dashboardPassword),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete order");
  return data;
}

// ─── Pay Due (Admin) ────

export async function apiPayDue(
  orderId: string,
): Promise<{ message: string }> {
  if (!isApiMode()) {
    throw new Error("Pay due only supported in API mode");
  }

  const res = await authFetch(`${API_URL}/dashboard/orders/${orderId}/pay-due`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to pay due");
  return data;
}

// ─── Customer Pay Due (no admin auth) ────

export async function apiCustomerPayDue(
  orderId: string,
  customerPhone: string,
): Promise<{ message: string }> {
  if (!isApiMode()) {
    throw new Error("Pay due only supported in API mode");
  }

  const res = await fetch(`${API_URL}/orders/${orderId}/pay-due`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ customerPhone }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to pay due");
  return data;
}

export async function apiGetOrderHistory(phone: string) {
  const res = await fetch(`${API_URL}/orders/history/${phone}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function apiGetActiveOrdersByPhone(phone: string) {
  const res = await fetch(`${API_URL}/orders/active/${phone}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch active orders");
  return res.json();
}

export async function apiGetEstimate() {
  const res = await fetch(`${API_URL}/orders/estimate`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch estimate");
  return res.json();
}

// ─── Customer Edit Order (20s window) ────

export async function apiCustomerEditOrder(
  orderId: string,
  items: { id: number; name: string; price: number; priceLabel: string; quantity: number; image?: string }[],
  customerPhone: string,
): Promise<{ message: string; order: Partial<Order> }> {
  const res = await fetch(`${API_URL}/orders/${orderId}/customer-edit`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ items, customerPhone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to edit order");
  return data;
}

// ─── Customer Editing Status (notify admin) ────

export async function apiEditingStart(orderId: string, customerPhone: string): Promise<void> {
  if (!isApiMode()) return;
  fetch(`${API_URL}/orders/${orderId}/editing-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerPhone }),
  }).catch(() => {});
}

export async function apiEditingEnd(orderId: string): Promise<void> {
  if (!isApiMode()) return;
  fetch(`${API_URL}/orders/${orderId}/editing-end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  discountType: "percent" | "flat";
  value: number;
  discount: number;
  subtotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  gst: number;
  gstRate: number;
  isGstEnabled: boolean;
  finalTotal: number;
}

export async function apiValidateCoupon(
  code: string,
  orderTotal: number,
): Promise<CouponValidation> {
  const res = await fetch(`${API_URL}/coupons/validate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code, orderTotal }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid coupon");
  return data;
}

export async function apiCreatePaidVoucher(
  amount: number,
  phone: string,
  customCode?: string,
): Promise<{ code: string; value: number; usageLimit: number }> {
  const res = await fetch(`${API_URL}/coupons/create-paid`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ amount, phone, customCode: customCode || undefined }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create voucher");
  return data;
}

// ─── Admin Coupon Management APIs ────────────────────────

export interface AdminCoupon {
  code: string;
  discount_type: "percent" | "flat";
  value: string;
  expiry_date: string | null;
  active: boolean;
  usage_limit: number;
  used_count: number;
  created_by: string | null;
  created_at: string;
  is_public: boolean;
}

export async function apiAdminCreateCoupon(data: {
  code?: string;
  discount_type: "percent" | "flat";
  value: number;
  expiry_date?: string;
  usage_limit?: number;
  active?: boolean;
  is_public?: boolean;
}): Promise<AdminCoupon> {
  const res = await authFetch(`${API_URL}/coupons/admin-create`, {
    method: "POST",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to create coupon");
  return result;
}

export async function apiAdminListCoupons(): Promise<AdminCoupon[]> {
  const res = await authFetch(`${API_URL}/coupons/admin-list`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch coupons");
  return res.json();
}

export async function apiAdminToggleCoupon(code: string): Promise<AdminCoupon> {
  const res = await authFetch(`${API_URL}/coupons/admin-toggle/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to toggle coupon");
  return result;
}

export async function apiAdminToggleCouponPublic(code: string): Promise<AdminCoupon> {
  const res = await authFetch(`${API_URL}/coupons/admin-toggle-public/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to toggle public status");
  return result;
}

export async function apiAdminDeleteCoupon(code: string): Promise<void> {
  const res = await authFetch(`${API_URL}/coupons/admin-delete/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || "Failed to delete coupon");
  }
}

export async function apiAdminBulkDeleteCoupons(codes: string[]): Promise<{ deleted: string[]; count: number }> {
  const res = await authFetch(`${API_URL}/coupons/admin-bulk-delete`, {
    method: "POST",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ codes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Bulk delete failed");
  return data;
}

export async function apiAdminShareCouponSMS(code: string, phone: string): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_URL}/coupons/admin-share-sms`, {
    method: "POST",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ code, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send SMS");
  return data;
}

// ─── Menu Management APIs ────

export interface MenuItem {
  id: number
  name: string
  slug: string
  description: string
  price: number
  price_label: string
  category: string
  diet_type: "veg" | "non-veg" | "egg" | "none"
  image_url: string | null
  available: boolean
  sort_order: number
  variants?: { name: string; price: number }[]
  created_at: string
  updated_at: string
}

// ─── Get Menu ────────────────────────────────

export async function apiGetMenuItems(): Promise<MenuItem[]> {
  const res = await fetch(`${API_URL}/menu`, {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error("Failed to fetch menu items")

  return res.json()
}

// ─── Create Menu Item (Image Upload) ────────────────────────────────

export async function apiCreateMenuItem(data: {
  name: string
  description: string
  price: number
  price_label: string
  category: string
  diet_type?: "veg" | "non-veg" | "egg" | "none"
  image?: File | null
  available?: boolean
  variants?: { name: string; price: number }[]
}): Promise<MenuItem> {

  const formData = new FormData()

  formData.append("name", data.name)
  formData.append("description", data.description)
  formData.append("price", String(data.price))
  formData.append("price_label", data.price_label)
  formData.append("category", data.category)

  if (data.diet_type) {
    formData.append("diet_type", data.diet_type)
  }

  if (data.available !== undefined) {
    formData.append("available", String(data.available))
  }

  if (data.variants !== undefined) {
    formData.append("variants", JSON.stringify(data.variants))
  }

  if (data.image) {
    formData.append("image", data.image)
  }

  const headers = dashHeaders(dashboardPassword)
  delete headers["Content-Type"] // 🔥 important for FormData

  const res = await authFetch(`${API_URL}/menu`, {
    method: "POST",
    headers,
    body: formData,
  })

  const result = await res.json()

  if (!res.ok) throw new Error(result.error || "Failed to create menu item")

  return result
}

// ─── Update Menu Item (Image Upload Optional) ────────────────────────────────

export async function apiUpdateMenuItem(
  id: number,
  data: Partial<{
    name: string
    description: string
    price: number
    price_label: string
    category: string
    diet_type: "veg" | "non-veg" | "egg" | "none"
    image: File | null
    available: boolean
    variants: { name: string; price: number }[]
  }>
): Promise<MenuItem> {

  const formData = new FormData()

  if (data.name) formData.append("name", data.name)
  if (data.description) formData.append("description", data.description)
  if (data.price !== undefined) formData.append("price", String(data.price))
  if (data.price_label) formData.append("price_label", data.price_label)
  if (data.category) formData.append("category", data.category)
  if (data.diet_type) formData.append("diet_type", data.diet_type)

  if (data.available !== undefined) {
    formData.append("available", String(data.available))
  }

  if (data.variants !== undefined) {
    formData.append("variants", JSON.stringify(data.variants))
  }

  if (data.image) {
    formData.append("image", data.image)
  }

  const headers = dashHeaders(dashboardPassword)
  delete headers["Content-Type"] // 🔥 important

  const res = await authFetch(`${API_URL}/menu/${id}`, {
    method: "PUT",
    headers,
    body: formData,
  })

  const result = await res.json()

  if (!res.ok) throw new Error(result.error || "Failed to update menu item")

  return result
}

// ─── Delete Menu Item ────────────────────────────────

export async function apiDeleteMenuItem(id: number): Promise<void> {

  const res = await authFetch(`${API_URL}/menu/${id}`, {
    method: "DELETE",
    headers: dashHeaders(dashboardPassword),
  })

  if (!res.ok) {
    const result = await res.json()
    throw new Error(result.error || "Failed to delete menu item")
  }
}

// ─── Bulk Delete Menu Items ────────────────────────────────

export async function apiBulkDeleteMenuItems(ids: number[]): Promise<{ count: number }> {
  const res = await authFetch(`${API_URL}/menu/bulk-delete-menu-items`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to bulk delete menu items");
  return res.json();
}

// ─── Toggle Menu Item Availability ────────────────────────────────

export async function apiToggleMenuItem(id: number): Promise<MenuItem> {

  const res = await authFetch(`${API_URL}/menu/${id}/toggle`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
  })

  const result = await res.json()

  if (!res.ok) throw new Error(result.error || "Failed to toggle menu item")

  return result
}

// ─── Category Types ────────────────────────────────

export interface MenuCategory {
  id: number
  name: string
  sort_order: number
  created_at: string
}

// ─── Get Categories ────────────────────────────────

export async function apiGetCategories(): Promise<MenuCategory[]> {
  const res = await fetch(`${API_URL}/categories`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

// ─── Create Category ────────────────────────────────

export async function apiCreateCategory(name: string): Promise<MenuCategory> {
  const res = await authFetch(`${API_URL}/categories`, {
    method: "POST",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ name }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to create category")
  return result
}

// ─── Update Category ────────────────────────────────

export async function apiUpdateCategory(id: number, name: string): Promise<MenuCategory> {
  const res = await authFetch(`${API_URL}/categories/${id}`, {
    method: "PUT",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ name }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update category")
  return result
}

// ─── Delete Category ────────────────────────────────

export async function apiDeleteCategory(id: number): Promise<void> {
  const res = await authFetch(`${API_URL}/categories/${id}`, {
    method: "DELETE",
    headers: dashHeaders(dashboardPassword),
  })
  if (!res.ok) {
    const result = await res.json()
    throw new Error(result.error || "Failed to delete category")
  }
}

// ─── Reorder Menu Items ────────────────────────────────

export async function apiReorderMenu(orderedIds: number[]): Promise<void> {
  const res = await authFetch(`${API_URL}/menu/reorder`, {
    method: "PUT",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ orderedIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder menu");
}

// ─── Menu Performance Analytics ────────────────────────

export interface MenuAnalytics {
  mostOrdered: { name: string; total_orders: number } | null;
  mostProfitable: { name: string; total_revenue: string } | null;
  leastOrdered: { name: string; total_orders: number } | null;
  topItems: { name: string; total_orders: number; total_revenue: string }[];
  statusDistribution: { status: string; count: number }[];
  hourlyDistribution: { hour: number; orders: number }[];
  weeklyTrend: { day: string; orders: number; revenue: number }[];
  paymentSplit: { method: string; count: number; revenue: number }[];
  orderTypeDistribution?: { type: string; count: number; revenue: number }[];
}

export async function apiGetMenuAnalytics(): Promise<MenuAnalytics> {
  const res = await authFetch(`${API_URL}/dashboard/menu-analytics`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch menu analytics");
  return res.json();
}

// ─── Customer Analytics ────────────────────────────────

export interface CustomerEntry {
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
}

export interface CustomerVarietyEntry {
  name: string;
  phone: string;
  uniqueItems: number;
  totalOrders: number;
}

export interface CustomerAnalytics {
  topByOrders: CustomerEntry[];
  topBySpend: CustomerEntry[];
  topByVariety: CustomerVarietyEntry[];
  totalCustomers: number;
  avgOrdersPerCustomer: number;
  repeatCustomers: number;
  oneTimeCustomers: number;
}

export async function apiCheckLoyaltyPoints(phone: string): Promise<{
  enabled: boolean;
  customerExists?: boolean;
  points?: number;
  name?: string;
  totalSpent?: number;
  settings?: {
    loyalty_enabled: boolean;
    loyalty_points_per_100: number;
    loyalty_discount_per_point: number;
  };
}> {
  if (!isApiMode()) return { enabled: false };
  const res = await authFetch(`${API_URL}/customers/loyalty/${phone}`);
  if (!res.ok) throw new Error("Failed to fetch loyalty points");
  return res.json();
}

export async function apiGetCustomerAnalytics(): Promise<CustomerAnalytics> {
  const res = await authFetch(`${API_URL}/dashboard/customer-analytics`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch customer analytics");
  return res.json();
}

// ─── Table Analytics ──────────────────────────────────
export interface TableAnalyticsData {
  tableNumber: string;
  totalSessions: number;
  totalOrders: number;
  totalRevenue: number;
}

export async function apiGetTableAnalytics(startDate?: string, endDate?: string): Promise<TableAnalyticsData[]> {
  let url = `${API_URL}/dashboard/table-analytics`;
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  }
  const res = await authFetch(url, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch table analytics");
  return res.json();
}

export interface TableHistoryItem {
  name: string;
  quantity: number;
  price: string | number;
}

export interface TableHistoryOrder {
  orderId: string;
  status: string;
  total: string | number;
  items: TableHistoryItem[];
}

export interface TableHistorySession {
  id: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  status: string;
  totalBill: number;
  orders: TableHistoryOrder[];
}

export async function apiGetTableHistory(tableNumber: string, startDate?: string, endDate?: string): Promise<TableHistorySession[]> {
  let url = `${API_URL}/dashboard/table-analytics/${encodeURIComponent(tableNumber)}/history`;
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  }
  const res = await authFetch(url, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch table history");
  return res.json();
}

// ─── Hero Content ───
export interface HeroContent {
  id: number;
  location_tag: string;
  title: string;
  description: string;
  image_url: string | null;
}

export async function apiGetHeroContent(): Promise<HeroContent> {
  const res = await fetch(`${API_URL}/hero`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch hero content");
  return res.json();
}

export async function apiUpdateHeroContent(data: {
  location_tag?: string;
  title?: string;
  description?: string;
  image?: File;
}): Promise<HeroContent> {
  const form = new FormData();
  if (data.location_tag) form.append("location_tag", data.location_tag);
  if (data.title) form.append("title", data.title);
  if (data.description) form.append("description", data.description);
  if (data.image) form.append("image", data.image);

  const hdrs: Record<string, string> = {};
  const token = getAdminToken();
  if (token) hdrs["Authorization"] = `Bearer ${token}`;

  const res = await authFetch(`${API_URL}/hero`, {
    method: "PUT",
    headers: hdrs,
    body: form,
  });
  if (!res.ok) throw new Error("Failed to update hero content");
  return res.json();
}

// ── Gallery ──

export interface GalleryImage {
  id: number;
  image_url: string;
  alt_text: string;
  display_order: number;
  created_at: string;
}

export async function apiGetGalleryImages(): Promise<GalleryImage[]> {
  const res = await fetch(`${API_URL}/gallery`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch gallery");
  return res.json();
}

export async function apiUploadGalleryImage(file: File, altText?: string): Promise<GalleryImage> {
  const form = new FormData();
  form.append("image", file);
  if (altText) form.append("alt_text", altText);

  const hdrs2: Record<string, string> = {};
  const tok = getAdminToken();
  if (tok) hdrs2["Authorization"] = `Bearer ${tok}`;

  const res = await authFetch(`${API_URL}/gallery`, {
    method: "POST",
    headers: hdrs2,
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload gallery image");
  return res.json();
}

export async function apiDeleteGalleryImage(id: number): Promise<void> {
  const res = await authFetch(`${API_URL}/gallery/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete gallery image");
}

export async function apiReorderGallery(orderedIds: number[]): Promise<void> {
  const res = await authFetch(`${API_URL}/gallery/reorder`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ orderedIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder gallery");
}

/// ─── Location Content ───

export interface LocationContent {
  id: number

  address: string
  phone: string

  open_time: string
  close_time: string
  closed_day: number

  opening_hours_display: string

  instagram_handle: string
  instagram_url: string

  map_embed_url: string
}

/* ---------- GET LOCATION ---------- */

export async function apiGetLocationContent(): Promise<LocationContent> {
  const res = await fetch(`${API_URL}/location`, {
    headers: authHeaders(),
  });

  if (!res.ok)
    throw new Error("Failed to fetch location content")

  return res.json()
}

/* ---------- UPDATE LOCATION ---------- */

export async function apiUpdateLocationContent(
  data: Partial<Omit<LocationContent, "id">>
): Promise<LocationContent> {

  const res = await authFetch(`${API_URL}/location`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  })

  if (!res.ok)
    throw new Error("Failed to update location content")

  return res.json()
}

/* ---------- RESOLVE MAP URL ---------- */

export async function apiResolveMapUrl(url: string): Promise<string> {

  const res = await authFetch(`${API_URL}/location/resolve-map`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  })

  if (!res.ok)
    throw new Error("Failed to resolve map URL")

  const data = await res.json()

  return data.embed_url
}

// ─── Promotions APIs ─────────────────────────────────────

export async function apiGetActivePromotion() {
  const res = await fetch(`${API_URL}/promotions/active`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function apiAdminListPromotions() {
  const res = await authFetch(`${API_URL}/promotions`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch promotions");
  return res.json();
}

export async function apiAdminCreatePromotion(data: {
  message: string;
  bg_color?: string;
  text_color?: string;
  starts_at?: string;
  expires_at: string;
}) {
  const res = await authFetch(`${API_URL}/promotions`, {
    method: "POST",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to create promotion");
  return result;
}

export async function apiAdminTogglePromotion(id: number) {
  const res = await authFetch(`${API_URL}/promotions/${id}/toggle`, {
    method: "PATCH",
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to toggle promotion");
  return res.json();
}

export async function apiAdminDeletePromotion(id: number) {
  const res = await authFetch(`${API_URL}/promotions/${id}`, {
    method: "DELETE",
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to delete promotion");
}

// ─── Kitchen Display APIs ────────────────────────────────

export interface KitchenOrder {
  id: string;
  token: number;
  customerName: string;
  items: { id: string; name: string; quantity: number; status: string; note: string }[];
  status: string;
  createdAt: string;

  orderType: "dine-in" | "takeaway" | "delivery";
  specialInstructions: string;
  paymentStatus: "paid" | "pending";
  paymentMethod: string;
}

export async function apiKitchenVerifyPin(pin: string): Promise<{ success: boolean; user?: AuthUser; token?: string }> {
  const res = await fetch(`${API_URL}/kitchen/verify-pin`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error("Invalid PIN");
  return res.json();
}

export async function apiKitchenGetOrders(): Promise<KitchenOrder[]> {
  const res = await fetch(`${API_URL}/kitchen/orders`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch kitchen orders");
  return res.json();
}

export async function apiKitchenMarkReady(orderId: string): Promise<void> {
  const res = await fetch(`${API_URL}/kitchen/orders/${orderId}/ready`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark order as ready");
}

export async function apiKitchenMarkItemReady(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/kitchen/order-items/${itemId}/ready`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark item as ready");
}

// ─── Table Management APIs ──────────────────────────────

export interface Table {
  id: string;
  tableNumber: string;
  qrCode: string;
  status: "available" | "occupied" | "reserved";
  activeSession: TableSession | null;
  qrRoutingMode?: "claim" | "waiter_unlock";
}

export interface TableSession {
  id: string;
  customerName: string;
  customerPhone: string;
  otp: string;
  isVerified: boolean;
  status: "active" | "billing" | "completed";
  startTime: string;
}

export async function apiAdminGetTables(): Promise<Table[]> {
  const res = await authFetch(`${API_URL}/tables`, {
    headers: dashHeaders(dashboardPassword),
  });
  if (!res.ok) throw new Error("Failed to fetch tables");
  return res.json();
}

export async function apiAdminCreateTable(tableNumber: string, qrCode?: string): Promise<Table> {
  const res = await authFetch(`${API_URL}/tables`, {
    method: "POST",
    headers: dashHeaders(dashboardPassword),
    body: JSON.stringify({ tableNumber, qrCode }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create table");
  }
  return res.json();
}

export async function apiGetTableByQr(qrCode: string): Promise<Table> {
  const res = await fetch(`${API_URL}/tables/qr/${qrCode}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Table not found");
  return res.json();
}

export async function apiReserveTable(tableId: string, customerName: string, customerPhone: string): Promise<TableSession> {
  const res = await fetch(`${API_URL}/tables/${tableId}/reserve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ customerName, customerPhone }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to reserve table");
  }
  return res.json();
}
export async function apiDeleteTable(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/tables/${id}`, {
    method: "DELETE",
    headers: dashHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete table");
  }
}



export async function apiCancelSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to cancel session");
}

export async function apiSessionDone(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/done`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark session as done");
}

export async function apiSessionClose(
  sessionId: string, 
  paymentMethod: string = "counter", 
  splitCash: number = 0, 
  splitUpi: number = 0,
  customerPhone?: string,
  pointsRedeemed?: number
): Promise<void> {
  const res = await authFetch(`${API_URL}/tables/sessions/${sessionId}/close`, {
    method: "POST",
    headers: dashHeaders(),
    body: JSON.stringify({ 
      paymentMethod, 
      splitCash, 
      splitUpi,
      customerPhone,
      pointsRedeemed
    }),
  });
  if (!res.ok) throw new Error("Failed to close session");
}

export async function apiAdminOpenTableSession(
  tableId: string,
  customerName?: string,
  customerPhone?: string
): Promise<{ id: string; new?: boolean; existing?: boolean }> {
  const res = await authFetch(`${API_URL}/tables/${tableId}/admin-open`, {
    method: "POST",
    headers: dashHeaders(),
    body: JSON.stringify({ customerName, customerPhone }),
  });
  
  if (!res.ok) {
    let msg = "Failed to open table";
    try {
      const err = await res.json();
      if (err && err.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }
  
  return res.json();
}

export async function apiAdminTransferTableSession(
  sessionId: string,
  newTableId: string
): Promise<{ message: string }> {
  const res = await authFetch(`${API_URL}/tables/sessions/${sessionId}/transfer`, {
    method: "POST",
    headers: dashHeaders(),
    body: JSON.stringify({ newTableId }),
  });
  
  if (!res.ok) {
    let msg = "Failed to transfer table";
    try {
      const err = await res.json();
      if (err && err.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export interface SessionBill {
  sessionId: string;
  tableNumber?: string | null;
  customerName?: string;
  customerPhone?: string;
  orders: (Order & { items: { id: string; name: string; price: number; quantity: number; status: string; note: string }[] })[];
  itemized: { menuItemId?: number | string; name: string; price: number; quantity: number; totalPrice: number }[];
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  isFullyPaid: boolean;
  sessionDetails?: {
    subtotal: number;
    discount: number;
    couponCode: string;
    cgst: number;
    sgst: number;
    gstTotal: number;
  };
}

export async function apiGetSessionBill(sessionId: string): Promise<SessionBill> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/bill`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch bill");
  return res.json();
}

export async function apiSessionPay(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/pay`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to pay session bill");
}

export async function apiApplySessionCoupon(sessionId: string, code: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/apply-coupon`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to apply coupon");
  }
  return res.json();
}

export async function apiRemoveSessionCoupon(sessionId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_URL}/tables/sessions/${sessionId}/remove-coupon`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove coupon");
  return res.json();
}

export interface SettledSession {
  session_id: string;
  table_number: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  discount_amount: string | null;
  raw_total: string | null;
}

export interface SettledSessionsResponse {
  data: SettledSession[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export async function apiGetSettledSessions(page: number = 1, limit: number = 25): Promise<SettledSessionsResponse> {
  const res = await authFetch(`${API_URL}/tables/sessions/history?page=${page}&limit=${limit}`, {
    headers: dashHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch settled sessions");
  return res.json();
}

export type { Order, OrderItem, Review, ReviewSummary } from "./orderStore";
