import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "@/lib/socket";
import { useOrders } from "@/hooks/useOrders";
import { useAutoPrint } from "@/hooks/useAutoPrint";
import { Capacitor } from "@capacitor/core";
import { printQueue } from "@/lib/printQueue";
import {
  apiUpdateOrderStatus,
  apiUpdateOrderItems,
  apiCancelOrder,
  apiAdminLogin,
  apiAdminCheckAuth,
  apiAdminLogout,
  apiAdminRequestReset,
  apiAdminResetPassword,
  apiStaffLogin,
  apiWebAuthnGenerateAuthentication,
  apiWebAuthnVerifyAuthentication,
  type Order,
  type AuthUser,
} from "@/lib/apiClient";
import { startAuthentication } from "@simplewebauthn/browser";
import { authenticateWithBiometrics, hasSavedBiometricToken, isBiometricAvailable } from "@/lib/biometrics";
// localUpdateOrderStatus no longer needed - optimistic updates are in useOrders
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Package,
  BarChart3,
  Ticket,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
  Shield,
  History,
  MessageSquare,
  UtensilsCrossed,
  BarChart3 as BarChartIcon,
  Settings,
  FileText,
  ClipboardList,
  ImageIcon,
  Megaphone,
  QrCode,
  Users,
  Fingerprint,
  RefreshCw,
} from "lucide-react";

import { Loader2 } from "lucide-react";

import EditOrderModal from "@/components/dashboard/EditOrderModal";
import type { EditItem } from "@/components/dashboard/EditOrderModal";
import OrderCard from "@/components/dashboard/OrderCard";
import StatsBar from "@/components/dashboard/StatsBar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

// Lazy-loaded heavy sub-components
const SalesReportUI = lazy(() => import("@/components/dashboard/SalesReportUI"));
const CouponManagement = lazy(() => import("@/components/dashboard/CouponManagement"));
const OrderHistory = lazy(() => import("@/components/dashboard/OrderHistory"));
const ReviewManagement = lazy(() => import("@/components/dashboard/ReviewManagement"));
const TableQRCodes = lazy(() => import("@/components/dashboard/TableQRCodes"));
const SecurityLogs = lazy(() => import("@/components/dashboard/SecurityLogs"));
const MenuManager = lazy(() => import("@/components/dashboard/MenuManager"));
const MenuAnalytics = lazy(() => import("@/components/dashboard/MenuAnalytics"));
const TableAnalytics = lazy(() => import("@/components/dashboard/TableAnalytics"));
const AccountSecurity = lazy(() => import("@/components/dashboard/AccountSecurity"));
const HeroManager = lazy(() => import("@/components/dashboard/HeroManager"));
const GalleryManager = lazy(() => import("@/components/dashboard/GalleryManager"));
const PromotionManager = lazy(() => import("@/components/dashboard/PromotionManager"));
const LocationManager = lazy(() => import("@/components/dashboard/LocationManager"));
const CounterOrder = lazy(() => import("@/components/dashboard/CounterOrder"));
const BusinessSettingsManager = lazy(() => import("@/components/dashboard/BusinessSettingsManager"));
const TableManager = lazy(() => import("@/components/dashboard/TableManager"));
const StaffManager = lazy(() => import("@/components/dashboard/StaffManager"));
const CustomerManagement = lazy(() => import("@/components/dashboard/CustomerManagement"));
const PageContentManager = lazy(() => import("@/components/dashboard/PageContentManager"));

// Fallback loader for dashboard tabs
const TabLoader = () => (
  <div className="flex items-center justify-center p-12">
    <Loader2 size={32} className="animate-spin text-primary" />
  </div>
);

const statusFlow: Order["status"][] = [
  "new",
  "preparing",
  "ready",
  "completed",
];

const allStatuses: Order["status"][] = [
  "new",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

type AuthMode = "login" | "request-reset" | "reset-password";

// ─── Password validation ───
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain at least 1 letter";
  if (!/[0-9]/.test(pw)) return "Password must contain at least 1 number";
  return null;
}

// ─── AUTH SCREEN ───
const AuthScreen = ({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) => {
  const [loginMode, setLoginMode] = useState<"owner" | "staff">("staff");
  const [mode, setMode] = useState<AuthMode>("login");
  const [hasBiometricOption, setHasBiometricOption] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      hasSavedBiometricToken().then(hasToken => {
        if (hasToken) setHasBiometricOption(true);
      });
    } else {
      // Browser WebAuthn is always "available" to try
      setHasBiometricOption(true);
    }
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [maskedMobile, setMaskedMobile] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("admin_username");
    const savedPass = localStorage.getItem("admin_password");
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
      setLoginMode("owner");
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (loginMode === "owner") {
        const res = await apiAdminLogin(username, password);
        if (rememberMe) {
          localStorage.setItem("admin_username", username);
          localStorage.setItem("admin_password", password);
        } else {
          localStorage.removeItem("admin_username");
          localStorage.removeItem("admin_password");
        }
        onAuthenticated({ ...res.user, features: res.features });
      } else {
        const res = await apiStaffLogin(pin);
        onAuthenticated({ ...res.user, features: res.features });
      }
    } catch (err: any) {
      setError(err.message);
      if (loginMode === "staff") setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setError("");
      setLoading(true);

      if (Capacitor.isNativePlatform()) {
        // Native Android Biometrics
        const res = await authenticateWithBiometrics();
        onAuthenticated({ ...res.user, features: res.features });
      } else {
        // Browser WebAuthn / Passkeys
        const { options, authSessionId } = await apiWebAuthnGenerateAuthentication();
        const response = await startAuthentication({ optionsJSON: options });
        const res = await apiWebAuthnVerifyAuthentication(response, authSessionId);
        onAuthenticated({ ...res.user, features: res.features });
      }
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        setError(err.message || "Biometric login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto-submit when 4 digits are entered
        setTimeout(() => {
          setError("");
          setLoading(true);
          apiStaffLogin(newPin)
            .then((res) => {
              onAuthenticated({ ...res.user, features: res.features });
            })
            .catch((err) => {
              setError(err.message);
              setPin("");
              setLoading(false);
            });
        }, 300);
      }
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const data = await apiAdminRequestReset(username);
      setMaskedMobile(data.mobile);
      setSuccess(`OTP sent to ${data.email || data.mobile}`);
      setMode("reset-password");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const pwError = validatePassword(newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);
    try {
      const data = await apiAdminResetPassword(username, otp, newPassword);
      setSuccess(data.message);
      setOtp("");
      setNewPassword("");
      setTimeout(() => {
        setMode("login");
        setSuccess("");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-3xl pointer-events-none" />

          {/* Mode Switcher */}
          {mode === "login" && (
            <div className="flex bg-muted p-1 rounded-xl mb-4 md:mb-6 relative z-10">
              <button
                onClick={() => { setLoginMode("staff"); setError(""); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${loginMode === "staff" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Staff Login
              </button>
              <button
                onClick={() => { setLoginMode("owner"); setError(""); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${loginMode === "owner" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Owner Login
              </button>
            </div>
          )}

          {/* Icon */}
          <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10">
            {mode === "login" ? (
              loginMode === "staff" ? <Shield className="text-primary" size={28} /> : <Lock className="text-primary" size={28} />
            ) : mode === "request-reset" ? (
              <KeyRound className="text-primary" size={28} />
            ) : (
              <ShieldCheck className="text-primary" size={28} />
            )}
          </div>

          {/* Title */}
          <h1 className="font-heading text-xl md:text-2xl font-bold text-center mb-1 relative z-10">
            {mode === "login"
              ? (loginMode === "staff" ? "Staff Auth" : "Owner Login")
              : mode === "request-reset"
                ? "Forgot Password"
                : "Reset Password"}
          </h1>
          <p className="text-muted-foreground text-center text-xs md:text-sm mb-4 md:mb-6 relative z-10">
            {mode === "login"
              ? (loginMode === "staff" ? "Enter your 4-digit PIN" : "Enter your master login details")
              : mode === "request-reset"
                ? "We'll send an OTP to your registered email"
                : `Enter the OTP sent to your email`}
          </p>

          {/* Error / Success */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <p className="text-destructive text-sm text-center bg-destructive/10 p-2.5 rounded-xl">
                  {error}
                </p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <p className="text-green-600 dark:text-green-400 text-sm text-center bg-green-500/10 p-2.5 rounded-xl">
                  {success}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PIN PAD FOR STAFF */}
          {mode === "login" && loginMode === "staff" && (
            <div className="space-y-4 relative z-10">
              <div className="text-center text-xs text-muted-foreground uppercase tracking-widest mt-1 mb-3">Enter PIN</div>
              {/* PIN Display */}
              <div className="flex justify-center gap-4 mb-5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i ? "bg-primary border-primary scale-110" : "bg-transparent border-border"
                      }`}
                  />
                ))}
              </div>

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinClick(num.toString())}
                    disabled={loading || pin.length >= 4}
                    className="h-12 md:h-14 bg-muted hover:bg-muted/80 rounded-xl font-bold text-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handlePinClick("0")}
                  disabled={loading || pin.length >= 4}
                  className="h-12 md:h-14 bg-muted hover:bg-muted/80 rounded-xl font-bold text-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  onClick={() => setPin("")}
                  className="h-12 md:h-14 text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  Clear
                </button>
              </div>

              {loading && (
                <p className="text-center text-xs text-muted-foreground animate-pulse mt-4">
                  Authenticating...
                </p>
              )}
            </div>
          )}

          {/* LOGIN FORM FOR OWNER */}
          {mode === "login" && loginMode === "owner" && (
            <form onSubmit={handleLogin} className="space-y-3 relative z-10">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="Login ID (Email/Mobile)"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center transition-all"
                autoFocus
                disabled={loading}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center tracking-widest transition-all"
                autoFocus
                disabled={loading}
              />
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Remember my password on this device
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || !password || !username}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {loading ? "Verifying..." : "Unlock Dashboard"}
              </button>

              {hasBiometricOption && (
                <>
                  <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm">or</span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBiometricLogin}
                    disabled={loading}
                    className="w-full bg-card border border-primary/20 text-primary py-3 rounded-xl font-bold hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                  >
                    <Fingerprint size={20} />
                    {Capacitor.isNativePlatform() ? "Sign in with Biometrics" : "Sign in with Passkey"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode("request-reset");
                  setError("");
                  setSuccess("");
                }}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
              >
                Forgot password?
              </button>
            </form>
          )}

          {/* REQUEST RESET FORM */}
          {mode === "request-reset" && (
            <form onSubmit={handleRequestReset} className="space-y-4 relative z-10">
              <p className="text-sm text-muted-foreground text-center px-4">
                Click below to receive an OTP on your registered email address.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccess("");
                }}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} /> Back to login
              </button>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {mode === "reset-password" && (
            <form onSubmit={handleResetPassword} className="space-y-4 relative z-10">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                placeholder="6-digit OTP"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center tracking-[0.5em] text-lg font-mono transition-all"
                autoFocus
                disabled={loading}
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                }}
                placeholder="New password"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6 || !newPassword}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccess("");
                }}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} /> Back to login
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── MAIN DASHBOARD ───
const Dashboard = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiAdminCheckAuth().then((auth) => {
      if (auth.authenticated && auth.user) {
        // Kitchen staff should use the dedicated /kitchen page
        if (auth.user.role === 'kitchen') {
          navigate('/kitchen', { replace: true });
          return;
        }
        setUser(auth.user);
      }
      setChecking(false);
    });
  }, [navigate]);

  const handleLogout = async () => {
    await apiAdminLogout();
    setUser(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={(u) => {
      // Redirect kitchen staff to /kitchen immediately on login
      if (u.role === 'kitchen') {
        navigate('/kitchen', { replace: true });
        return;
      }
      setUser(u);
    }} />;
  }

  return <DashboardContent user={user} onLogout={handleLogout} />;
};

const DashboardContent = ({ user, onLogout }: { user: AuthUser, onLogout: () => void }) => {
  const { orders, refreshOrders, optimisticUpdateStatus, unlockOrder } = useOrders(true);

  useAutoPrint(orders);
  const [updatingOrders, setUpdatingOrders] = useState<Record<string, boolean>>(
    {},
  );
  const [tab, setTab] = useState<
    "orders" | "tables" | "sales" | "analytics" | "content" | "management" | "system" | "staff"
  >("orders");
  const [contentSubTab, setContentSubTab] = useState<"menu" | "hero" | "gallery" | "page" | "address" | "promotions">("menu");
  const [managementSubTab, setManagementSubTab] = useState<"coupons" | "reviews" | "qr-codes" | "customers">("qr-codes");
  const [analyticsSubTab, setAnalyticsSubTab] = useState<"menu" | "table">("menu");
  const [settingsSubTab, setSettingsSubTab] = useState<"security" | "account" | "business">("business");
  const [orderSubTab, setOrderSubTab] = useState<"active" | "history" | "counter-order">("active");
  const [statusFilter, setStatusFilter] = useState<Order["status"] | "all">(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("dashboard_sound_enabled") === "true";
  });

  useEffect(() => {
    localStorage.setItem("dashboard_sound_enabled", soundEnabled.toString());
  }, [soundEnabled]);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editingOrderIds, setEditingOrderIds] = useState<Set<string>>(new Set());
  const [orderWorkflow, setOrderWorkflow] = useState<"multi-step" | "quick-complete">("quick-complete");

  useEffect(() => {
    import("@/lib/apiClient").then(({ apiAdminGetBusinessSettings }) => {
      apiAdminGetBusinessSettings().then(s => setOrderWorkflow(s.orderWorkflow || "quick-complete")).catch(() => { });
    });
  }, []);

  const prevStatusesRef = useRef<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sound alert for orders becoming ready
  useEffect(() => {
    let shouldDing = false;
    const currentStatuses: Record<string, string> = {};

    orders.forEach(o => {
      currentStatuses[o.id] = o.status;
      const prevStatus = prevStatusesRef.current[o.id];
      // Trigger if an order transitions to 'ready'
      if (prevStatus && prevStatus !== "ready" && o.status === "ready") {
        shouldDing = true;
      }
    });

    if (shouldDing && soundEnabled) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/alert.wav");
          audioRef.current.volume = 1;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { });
      } catch { }
    }

    prevStatusesRef.current = currentStatuses;
  }, [orders, soundEnabled]);

  // Socket listeners for new-order sound and refresh
  useEffect(() => {
    const handleNewOrder = (data?: any) => {
      console.log(`🖨️ [PRINTER] AUTO-PRINTING KOT for Order #${data?.token || data?.id || 'NEW'}`);
      console.log(`   --> Sending items to kitchen...`);

      refreshOrders();
      if (soundEnabled) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio("/alert.wav");
            audioRef.current.volume = 1;
          }
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => { });
        } catch { }
      }
    };
    const handleOrderEditing = (data: { id: string; editing: boolean }) => {
      setEditingOrderIds((prev) => {
        const next = new Set(prev);
        if (data.editing) next.add(data.id);
        else next.delete(data.id);
        return next;
      });
    };
    socket.on("new-order", handleNewOrder);
    socket.on("order-editing", handleOrderEditing);
    return () => {
      socket.off("new-order", handleNewOrder);
      socket.off("order-editing", handleOrderEditing);
    };
  }, [refreshOrders, soundEnabled]);

  const handleAdvanceStatus = async (
    orderId: string,
    newStatus: Order["status"],
  ) => {
    const currentOrder = orders.find(o => o.id === orderId);
    const currentStatus = currentOrder?.status || "new";

    // 1. Mark as updating (shows spinner)
    setUpdatingOrders((prev) => ({ ...prev, [orderId]: true }));

    // [AUTO-PRINT LOGIC] Print Final Bill if marked completed (Skip for dine-in, as they print when table is cleared)
    if (newStatus === "completed" && currentOrder?.orderType !== "dine-in") {
      console.log(`🧾 [PRINTER] AUTO-PRINTING FINAL BILL for Order #${currentOrder?.token || orderId}`);
      if (currentOrder && Capacitor.isNativePlatform()) {
        const rd = {
          token: currentOrder.token,
          customerName: currentOrder.customerName || "Guest",
          customerPhone: currentOrder.customerPhone || "",
          items: currentOrder.items || [],
          total: currentOrder.total,
          paymentMethod: currentOrder.paymentMethod as any,
          createdAt: currentOrder.createdAt,
          orderType: currentOrder.orderType as any,
          paymentStatus: currentOrder.paymentStatus as any,
          subtotal: currentOrder.subtotal,
          discount: currentOrder.discount,
          cgst: currentOrder.cgst,
          sgst: currentOrder.sgst,
          gst: currentOrder.gst,
          paidAmount: currentOrder.paidAmount || currentOrder.total,
        };
        printQueue.enqueue(`auto-receipt-${orderId}`, "receipt", rd);
      }
    }

    // 2. Optimistic update in React state + lock against socket overwrites
    optimisticUpdateStatus(orderId, newStatus);

    try {
      await apiUpdateOrderStatus(orderId, newStatus);
    } catch {
      // Rollback on failure
      optimisticUpdateStatus(orderId, currentStatus);
    } finally {
      // 3. Unlock so next socket refresh picks up server truth
      unlockOrder(orderId);

      // 4. Clear spinner
      setUpdatingOrders((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }
  };

  const handleSaveEditOrder = async (items: EditItem[]) => {
    if (!editOrder) return;
    await apiUpdateOrderItems(editOrder.id, items);
    await refreshOrders();
  };

  const activeTableNumbers = Array.from(new Set(
    orders
      .filter(o => o.orderSource === "table" && o.tableNumber)
      .map(o => o.tableNumber!)
  )).sort((a, b) => Number(a) - Number(b));

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (sourceFilter !== "all") {
      if (sourceFilter === "counter" && o.orderSource !== "counter") return false;
      if (sourceFilter !== "counter" && o.tableNumber !== sourceFilter) return false;
    }
    return true;
  });

  const statusConfig: Record<string, { label: string }> = {
    new: { label: "New" },
    preparing: { label: "Preparing" },
    ready: { label: "Ready" },
    completed: { label: "Completed" },
    cancelled: { label: "Cancelled" },
  };

  const handleCancelOrder = async (orderId: string) => {
    setUpdatingOrders((prev) => ({ ...prev, [orderId]: true }));
    optimisticUpdateStatus(orderId, "cancelled");
    try {
      await apiCancelOrder(orderId);
    } catch {
      await refreshOrders();
    } finally {
      unlockOrder(orderId);
      setUpdatingOrders((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <EditOrderModal
        open={!!editOrder}
        order={editOrder}
        onClose={() => setEditOrder(null)}
        onSave={handleSaveEditOrder}
        user={user}
      />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 pb-3 pt-1 shadow-sm">
        <DashboardHeader
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onLogout={onLogout}
        />

        {/* Tabs */}
        <div className="container mx-auto px-4 mt-2">
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide no-scrollbar"
            style={{ scrollbarWidth: "none" }}
          >
            {[
              { key: "orders" as const, label: "Orders", icon: Package, roles: ["admin", "manager", "waiter", "kitchen"] },
              { key: "tables" as const, label: "Tables", icon: UtensilsCrossed, roles: ["admin", "manager", "waiter"], check: () => user.features?.manual_table_orders || user.features?.qr_digital_ordering },
              { key: "sales" as const, label: "Sales", icon: BarChart3, roles: ["admin", "manager"] },
              { key: "analytics" as const, label: "Analytics", icon: BarChartIcon, roles: ["admin", "manager"], check: () => user.features?.advanced_analytics },
              { key: "content" as const, label: "Content", icon: FileText, roles: ["admin", "manager"], check: () => user.features?.website_cms },
              { key: "management" as const, label: "Management", icon: ClipboardList, roles: ["admin", "manager"], check: () => user.features?.coupon_engine || user.features?.customer_reviews },
              { key: "system" as const, label: "System", icon: Settings, roles: ["admin"] },
              { key: "staff" as const, label: "Staff", icon: Shield, roles: ["admin", "manager"] },
            ]
              .filter(t => user.role === 'admin' || (user.permissions?.tabs && user.permissions.tabs[t.key as keyof typeof user.permissions.tabs]))
              .filter(t => !t.check || t.check())
              .map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key as any);
                    if (t.key === "management") setManagementSubTab("qr-codes");
                    if (t.key === "system") setSettingsSubTab("business");
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${tab === t.key
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-card border border-border text-foreground/70 hover:bg-muted"
                    }`}
                >
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      <Suspense fallback={<TabLoader />}>
        {tab === "orders" ? (
          <div className="container mx-auto px-4 pb-8">
            {(user.role === 'admin' || user.permissions?.canViewOrderStats) && (
              <StatsBar orders={orders} />
            )}
            {/* Sub-tabs: Active Orders / History */}
            <div className={`flex gap-2 mb-4 overflow-x-auto scrollbar-hide no-scrollbar ${!(user.role === 'admin' || user.permissions?.canViewOrderStats) ? 'mt-4' : ''}`} style={{ scrollbarWidth: "none" }}>
              {[
                { key: "active" as const, label: "Active Orders", icon: Package, permissionKey: "active" as const },
                { key: "counter-order" as const, label: "New Order", icon: UtensilsCrossed, permissionKey: "pos" as const, check: () => user.features?.pos_system },
                { key: "history" as const, label: "History", icon: History, permissionKey: "history" as const },
              ]
                .filter(st => user.role === 'admin' || (user.permissions?.orders && user.permissions.orders[st.permissionKey]))
                .filter(st => !st.check || st.check())
                .map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setOrderSubTab(st.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${orderSubTab === st.key
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    <st.icon size={14} /> {st.label}
                  </button>
                ))}
            </div>

            {(orderSubTab === "active" && (user.role === 'admin' || user.permissions?.orders?.active)) ? (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 w-full">
                  {/* Status filter */}
                  <div
                    className="flex gap-2 overflow-x-auto scrollbar-hide max-w-full"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {(["all", ...allStatuses] as const)
                      .filter(s => {
                        if (orderWorkflow === "quick-complete" && ["new", "preparing", "ready"].includes(s)) return false;
                        return true;
                      })
                      .map((s) => (
                        <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === s
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                      >
                        {s === "all" ? "All" : statusConfig[s].label}
                        {s !== "all" &&
                          ` (${orders.filter((o) => o.status === s).length})`}
                      </button>
                    ))}
                  </div>

                  {/* Source filter dropdown */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refreshOrders()}
                      className="p-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition shadow-sm"
                      title="Refresh Orders"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="bg-card border border-border text-foreground rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary outline-none min-w-[140px] cursor-pointer"
                    >
                      <option value="all">🌐 All Sources</option>
                      <option value="counter">🛍️ Counter Orders</option>
                      {activeTableNumbers.map(t => (
                        <option key={t} value={t}>🪑 Table {t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Order cards */}
                {filteredOrders.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16"
                  >
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package size={36} className="text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground font-medium">No orders yet</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">
                      Waiting for customers...
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {filteredOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          user={user}
                          onAdvanceStatus={handleAdvanceStatus}
                          onCancelOrder={handleCancelOrder}
                          onEdit={setEditOrder}
                          onRefresh={refreshOrders}
                          isUpdating={!!updatingOrders[order.id]}
                          orderWorkflow={orderWorkflow}
                          isCustomerEditing={editingOrderIds.has(order.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            ) : (orderSubTab === "counter-order" && (user.role === 'admin' || user.permissions?.orders?.pos)) ? (
              <CounterOrder user={user} />
            ) : (orderSubTab === "history" && (user.role === 'admin' || user.permissions?.orders?.history)) ? (
              <OrderHistory />
            ) : null}
          </div>
        ) : tab === "tables" ? (
          <TableManager
            orders={orders}
            user={user}
            onRefresh={refreshOrders}
            onAdvanceStatus={handleAdvanceStatus}
            onCancelOrder={handleCancelOrder}
            orderWorkflow={orderWorkflow}
            isUpdating={updatingOrders}
            editingOrderIds={editingOrderIds}
          />
        ) : tab === "sales" ? (
          <SalesReportUI />
        ) : tab === "content" ? (
          <div className="container mx-auto px-4 pb-8 py-4">
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {[
                { key: "menu" as const, label: "Menu", icon: UtensilsCrossed },
                { key: "hero" as const, label: "Hero", icon: ImageIcon, check: () => user.features?.website_cms },
                { key: "gallery" as const, label: "Gallery", icon: ImageIcon, check: () => user.features?.website_cms },
                { key: "page" as const, label: "Page Content", icon: FileText, check: () => user.features?.website_cms },
                { key: "address" as const, label: "Address", icon: ImageIcon, check: () => user.features?.website_cms },
                { key: "promotions" as const, label: "Promotions", icon: Megaphone, check: () => user.features?.website_cms },
              ].filter(st => !st.check || st.check()).map((st) => (
                <button
                  key={st.key}
                  onClick={() => setContentSubTab(st.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${contentSubTab === st.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                >
                  <st.icon size={14} /> {st.label}
                </button>
              ))}
            </div>

            {contentSubTab === "menu" ? (
              <MenuManager />
            ) : contentSubTab === "hero" ? (
              <HeroManager />
            ) : contentSubTab === "gallery" ? (
              <GalleryManager />
            ) : contentSubTab === "page" ? (
              <PageContentManager />
            ) : contentSubTab === "promotions" ? (
              <PromotionManager />
            ) : (
              <LocationManager />
            )}
          </div>
        ) : tab === "analytics" ? (
          <div className="container mx-auto px-4 pb-8 py-4">
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {[
                { key: "menu" as const, label: "Menu Analytics", icon: BarChartIcon },
                { key: "table" as const, label: "Table Analytics", icon: UtensilsCrossed },
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setAnalyticsSubTab(st.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${analyticsSubTab === st.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                >
                  <st.icon size={14} /> {st.label}
                </button>
              ))}
            </div>

            {analyticsSubTab === "menu" ? (
              <MenuAnalytics />
            ) : (
              <TableAnalytics />
            )}
          </div>
        ) : tab === "management" ? (
          <div className="container mx-auto px-4 pb-8 py-4">
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {[
                { key: "qr-codes" as const, label: "QR Codes", icon: QrCode, check: () => user.features?.qr_digital_ordering !== false },
                { key: "customers" as const, label: "Customers", icon: Users },
                { key: "coupons" as const, label: "Coupons", icon: Ticket, check: () => user.features?.coupon_engine },
                { key: "reviews" as const, label: "Reviews", icon: MessageSquare, check: () => user.features?.customer_reviews },
              ].filter(st => !st.check || st.check()).map((st) => (
                <button
                  key={st.key}
                  onClick={() => setManagementSubTab(st.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${managementSubTab === st.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                >
                  <st.icon size={14} /> {st.label}
                </button>
              ))}
            </div>

            {managementSubTab === "qr-codes" ? (
              <TableQRCodes />
            ) : managementSubTab === "customers" ? (
              <CustomerManagement />
            ) : managementSubTab === "coupons" ? (
              <CouponManagement />
            ) : (
              <ReviewManagement />
            )}
          </div>
        ) : tab === "system" ? (
          <div className="container mx-auto px-4 pb-8 py-4">
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {[
                { key: "business" as const, label: "Business & GST", icon: Settings },
                { key: "account" as const, label: "Security", icon: ShieldCheck },
                { key: "security" as const, label: "Login Logs", icon: Shield },
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setSettingsSubTab(st.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${settingsSubTab === st.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                >
                  <st.icon size={14} /> {st.label}
                </button>
              ))}
            </div>

            {settingsSubTab === "business" ? (
              <BusinessSettingsManager />
            ) : settingsSubTab === "account" ? (
              <AccountSecurity />
            ) : (
              <SecurityLogs />
            )}
          </div>
        ) : tab === "staff" ? (
          <StaffManager />
        ) : null}
      </Suspense>
    </div>
  );
};

export default Dashboard;
