import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "../ErrorBoundary";
import { printQueue } from "@/lib/printQueue";
import { useDynamicMenu, type DynamicMenuItem } from "@/hooks/useDynamicMenu";
import {
  apiPlaceOrder,
  apiGetBusinessSettings,
  apiAdminGetTables,
  apiAdminOpenTableSession,
  type OrderItem,
  type BusinessSettings,
  type Table,
  type AuthUser,
  apiCheckLoyaltyPoints,
} from "@/lib/apiClient";
import { calculateOrderPricing } from "@/lib/billing";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Phone,
  CheckCircle2,
  UtensilsCrossed,
  ArrowLeft,
  MessageSquarePlus,
  Printer,
  Coffee,
  Soup,
  IceCream,
  ChefHat,
  ConciergeBell,
  GlassWater,
  CupSoda,
  LayoutGrid,
  List,
} from "lucide-react";

const CategoryIconPlaceholder = ({ category, className = "w-12 h-12 text-primary/40 group-hover:scale-110 transition-transform duration-500" }: { category?: string, className?: string }) => {
  const cat = (category || "").toLowerCase();

  if (cat.includes("beverage") || cat.includes("drink") || cat.includes("water")) {
    return <GlassWater className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("tea") || cat.includes("coffee")) {
    return <Coffee className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("soup")) {
    return <Soup className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("dessert") || cat.includes("sweet")) {
    return <IceCream className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("starter") || cat.includes("appetizer")) {
    return <UtensilsCrossed className={className} strokeWidth={1.5} />;
  }

  return <ConciergeBell className={className} strokeWidth={1.5} />;
};
import VariantSelectionModal from "@/components/VariantSelectionModal";
import ItemNoteModal from "./ItemNoteModal";
import { validateName, validateMobile } from "@/lib/validators";

interface CartItem extends OrderItem {
  // extends OrderItem which has name, price, priceLabel, quantity, image
  note?: string;
}

const CounterOrder = ({ user }: { user?: AuthUser }) => {
  return (
    <ErrorBoundary>
      <CounterOrderContent user={user} />
    </ErrorBoundary>
  );
};

const CounterOrderContent = ({ user }: { user?: AuthUser }) => {
  const { items: menuItems, categories, loading } = useDynamicMenu();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("pos_view_mode") as "grid" | "list") || "grid";
  });

  useEffect(() => {
    localStorage.setItem("pos_view_mode", viewMode);
  }, [viewMode]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [step, setStep] = useState<"menu" | "checkout" | "confirmation">("menu");
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    token: number;
    total: number;
    items: { name: string; price: number; quantity: number; note?: string }[];
    orderType: string;
    specialInstructions?: string;
    paymentStatus?: string;
  } | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [orderType, setOrderType] = useState<"takeaway" | "delivery">("takeaway");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [noteModalItem, setNoteModalItem] = useState<{ id: string | number; name: string; note: string } | null>(null);
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"counter" | "online" | "split">("counter");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitUpi, setSplitUpi] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [loyaltyData, setLoyaltyData] = useState<{
    enabled: boolean;
    customerExists?: boolean;
    points?: number;
    settings?: { loyalty_points_per_100: number; loyalty_discount_per_point: number };
  } | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  const getQuickCashOptions = (total: number) => {
    if (total <= 0) return [];
    const options = [];
    if (total % 100 !== 0) options.push(Math.ceil(total / 100) * 100);
    if (total % 500 !== 0) options.push(Math.ceil(total / 500) * 500);
    options.push(Math.ceil(total / 1000) * 1000);
    return Array.from(new Set(options)).filter((opt) => opt > total).slice(0, 3);
  };

  const availableItems = useMemo(() => {
    return menuItems
      .filter((i) => i.available)
      .filter((i) => category === "All" || i.category === category)
      .filter(
        (i) =>
          !search ||
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.desc.toLowerCase().includes(search.toLowerCase())
      );
  }, [menuItems, category, search]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const pointsDiscount = pointsToRedeem * (loyaltyData?.settings?.loyalty_discount_per_point || 0);
  const pricing = calculateOrderPricing(cartTotal, pointsDiscount, businessSettings);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const addToCart = (item: (typeof menuItems)[0]) => {
    if (!item.id) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          priceLabel: item.priceLabel,
          quantity: 1,
          image: item.image,
          category: item.category,
        },
      ];
    });
  };

  const [variantModalItem, setVariantModalItem] = useState<DynamicMenuItem | null>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is inside an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          e.target.blur();
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Enter") {
        if (step === "menu" && cart.length > 0) {
          e.preventDefault();
          setStep("checkout");
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (noteModalItem || variantModalItem) {
          setNoteModalItem(null);
          setVariantModalItem(null);
        } else if (step === "checkout") {
          setStep("menu");
        } else if (step === "menu" && cart.length > 0) {
          setCart([]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, cart.length, noteModalItem, variantModalItem]);

  const handleVariantAdd = (item: DynamicMenuItem, variant: { name: string; price: number }, quantity: number) => {
    if (!item.id) return;
    setCart((prev) => {
      const id = `${item.id}-${variant.name}`;
      const existing = prev.find((c) => c.id === id);
      if (existing) {
        return prev.map((c) =>
          c.id === id ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [
        ...prev,
        {
          id,
          name: `${item.name} (${variant.name})`,
          price: variant.price,
          priceLabel: `₹${variant.price}`,
          quantity,
          image: item.image,
        },
      ];
    });
    toast.success(`${item.name} (${variant.name}) added`);
  };

  const updateQty = (id: string | number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.id === id ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (id: string | number) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const updateNote = (id: string | number, note: string) => {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, note } : c))
    );
  };

  const handlePlaceOrder = async () => {
    let finalName = customerName.trim() || "Guest";
    let finalPhone = customerPhone.trim();

    const nErr = validateName(customerName, false);
    const pErr = validateMobile(customerPhone, false);

    if (nErr || pErr) {
      setNameError(nErr || "");
      setPhoneError(pErr || "");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setPlacing(true);
    try {
      const order = await apiPlaceOrder(
        finalName,
        finalPhone,
        cart,
        paymentMethod,
        undefined, // couponCode
        orderType,
        specialInstructions.trim(),
        "counter", // orderSource
        undefined, // tableSessionId
        parseFloat(splitCash) || 0,
        parseFloat(splitUpi) || 0,
        pricing.total,
        pointsToRedeem
      );

      setLastOrder({
        token: order.token,
        total: order.total,
        items: cart.map(c => ({ name: c.name, price: c.price, quantity: c.quantity, note: c.note })),
        orderType,
        specialInstructions: specialInstructions.trim(),
        paymentStatus: order.paymentStatus || "paid"
      });
      setStep("confirmation");
      toast.success(`Order #${order.token} placed successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setNameError("");
    setPhoneError("");
    setSearch("");
    setCategory("All");
    setStep("menu");
    setLastOrder(null);
    setOrderType("takeaway");
    setSpecialInstructions("");
    setLoyaltyData(null);
    setPointsToRedeem(0);
  };

  const getCartQty = (id: number) =>
    cart.filter((c) => c.id === id || String(c.id).startsWith(`${id}-`)).reduce((sum, c) => sum + c.quantity, 0);

  useEffect(() => {
    if (customerPhone.length === 10 && !phoneError) {
      apiCheckLoyaltyPoints(customerPhone)
        .then((data) => {
          setLoyaltyData(data);
          if (data && data.enabled && data.customerExists) {
            toast.success(`Customer found! ${data.points} points available.`);
          }
        })
        .catch(() => {
          setLoyaltyData(null);
        });
    } else {
      setLoyaltyData(null);
      setPointsToRedeem(0);
    }
  }, [customerPhone, phoneError]);

  useEffect(() => {
    apiGetBusinessSettings()
      .then(setBusinessSettings)
      .catch(() => setBusinessSettings(null));
  }, []);


  // ─── CONFIRMATION ───
  if (step === "confirmation" && lastOrder) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto text-center py-12"
      >
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="font-heading text-2xl font-bold mb-2">Order Placed!</h2>
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <p className="text-muted-foreground text-sm mb-1">Token Number</p>
          <p className="text-5xl font-bold text-primary mb-3">{lastOrder.token}</p>
          <p className="text-muted-foreground text-sm">Total</p>
          <p className="text-xl font-semibold">₹{lastOrder.total.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-2">Payment: At Counter</p>
        </div>

        {cashReceived !== null && lastOrder && cashReceived >= lastOrder.total && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6">
            <p className="text-emerald-700 dark:text-emerald-400 text-sm font-semibold mb-1">Return Change</p>
            <p className="text-emerald-700 dark:text-emerald-400 text-3xl font-black">
              ₹{(cashReceived - lastOrder.total).toFixed(2)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              const rd = {
                token: lastOrder.token,
                customerName: customerName || "Guest",
                customerPhone: customerPhone || "",
                items: lastOrder.items || [],
                total: lastOrder.total || 0,
                paymentMethod: paymentMethod as any,
                createdAt: new Date().toISOString(),
                orderType: lastOrder.orderType,
                specialInstructions: lastOrder.specialInstructions,
                paymentStatus: lastOrder.paymentStatus || "paid",
              };
              printQueue.enqueue(`manual-kot-${Date.now()}`, "kot", rd);
            }}
            className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-bold transition-all"
          >
            <Printer size={18} /> Print KOT (Kitchen Ticket)
          </button>
          <button
            onClick={() => {
              resetForm();
              setCashReceived(null);
              setPaymentMethod("counter");
              setSplitCash("");
              setSplitUpi("");
            }}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all"
          >
            Place Another Order
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── CHECKOUT ───
  if (step === "checkout") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="max-w-lg mx-auto"
      >
        <button
          onClick={() => setStep("menu")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Back to menu
        </button>

        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
          <h3 className="font-heading text-lg font-bold mb-4">Customer Details</h3>
          <div className="space-y-3">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                // Customer name is mandatory
                required
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (nameError) setNameError("");
                }}
                onBlur={(e) => setNameError(validateName(e.target.value, false) || "")}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${nameError ? 'border-red-500' : 'border-border'} bg-background focus:ring-2 focus:ring-ring focus:outline-none`}
                autoFocus
              />
            </div>
            {nameError && <p className="text-red-500 text-xs">{nameError}</p>}
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                placeholder="Phone Number (Optional)"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  if (phoneError) setPhoneError("");
                }}
                onBlur={(e) => setPhoneError(validateMobile(e.target.value, false) || "")}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${phoneError ? 'border-red-500' : 'border-border'} bg-background focus:ring-2 focus:ring-ring focus:outline-none`}
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            {phoneError && <p className="text-red-500 text-xs">{phoneError}</p>}

            {/* Loyalty Points Section */}
            {loyaltyData?.enabled && loyaltyData.customerExists && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-sm font-semibold mb-1 text-primary">Loyalty Points</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Available: <strong>{loyaltyData.points} pts</strong></span>
                  <span className="text-muted-foreground font-semibold">Value: ₹{((loyaltyData.points || 0) * (loyaltyData.settings?.loyalty_discount_per_point || 0)).toFixed(2)}</span>
                </div>
                {loyaltyData.points && loyaltyData.points > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          max={loyaltyData.points}
                          min={0}
                          step="0.01"
                          value={pointsToRedeem || ""}
                          onChange={(e) => {
                            const val = Math.min(parseFloat(e.target.value) || 0, loyaltyData.points || 0);
                            setPointsToRedeem(val);
                          }}
                          className="w-full pl-3 pr-10 py-2 rounded-xl border border-primary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                          placeholder="Points to redeem..."
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">pts</span>
                      </div>
                      <button
                        onClick={() => setPointsToRedeem(loyaltyData.points || 0)}
                        className="text-sm bg-primary text-primary-foreground px-4 rounded-xl font-bold hover:bg-primary/90 transition-all shrink-0"
                      >
                        Use All
                      </button>
                    </div>
                    {pointsToRedeem > 0 && (
                      <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit">
                        ✨ {pointsToRedeem} points applied!
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Order Type */}
            <div>
              <p className="text-sm font-semibold mb-2">Order Type</p>
              <div className="flex gap-2">
                {(["takeaway", "delivery"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${orderType === type
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-background border-border text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    {type === "takeaway" ? "Takeaway" : "Delivery"}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <p className="text-sm font-semibold mb-2">Special Instructions <span className="text-muted-foreground font-normal">(Optional)</span></p>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. No onions, extra spicy..."
                maxLength={300}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none resize-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
          <h3 className="font-heading text-lg font-bold mb-3">Order Summary</h3>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.name} className="flex flex-col text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <span className="text-foreground">
                    {item.quantity}x {item.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNoteModalItem({ id: item.id, name: item.name, note: item.note || "" })}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Add note"
                    >
                      <MessageSquarePlus size={14} />
                    </button>
                    <span className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
                {item.note && (
                  <p className="text-xs text-amber-600 font-medium italic mt-1 ml-4">
                    Note: {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>₹{pricing.subtotal.toFixed(2)}</span>
            </div>
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Loyalty Discount ({pointsToRedeem} pts)</span>
                <span>-₹{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            {pricing.gst > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>CGST</span>
                  <span>₹{pricing.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>SGST</span>
                  <span>₹{pricing.sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">₹{pricing.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <h3 className="font-heading text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Payment Method</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => setPaymentMethod("counter")}
              className={`py-2 px-2 rounded-xl text-sm font-bold border transition-all ${paymentMethod === "counter" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                }`}
            >
              💵 Cash
            </button>
            <button
              onClick={() => setPaymentMethod("online")}
              className={`py-2 px-2 rounded-xl text-sm font-bold border transition-all ${paymentMethod === "online" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                }`}
            >
              📱 Online/UPI
            </button>
            <button
              onClick={() => {
                setPaymentMethod("split");
                setSplitCash("");
                setSplitUpi("");
              }}
              className={`py-2 px-2 rounded-xl text-sm font-bold border transition-all ${paymentMethod === "split" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                }`}
            >
              ⚖️ Split
            </button>
          </div>

          {paymentMethod === "counter" && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setCashReceived(pricing.total)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-bold border transition-colors ${cashReceived === pricing.total
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                    : "bg-background border-border hover:border-emerald-500/50 text-emerald-600"
                    }`}
                >
                  Exact: ₹{pricing.total.toFixed(0)}
                </button>
                {getQuickCashOptions(pricing.total).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCashReceived(amt)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-bold border transition-colors ${cashReceived === amt
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                      : "bg-background border-border hover:border-emerald-500/50 text-emerald-600"
                      }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {cashReceived !== null && cashReceived >= pricing.total && (
                <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">Return Change:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-black text-xl">₹{(cashReceived - pricing.total).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === "split" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💵</span>
                <div className="flex-1">
                  <label className="text-xs font-bold text-muted-foreground ml-1">Cash Received</label>
                  <input
                    type="number"
                    placeholder="₹0"
                    className="w-full bg-muted border-none rounded-xl p-3 font-bold text-lg focus:ring-2 focus:ring-primary outline-none"
                    value={splitCash}
                    onChange={(e) => {
                      setSplitCash(e.target.value);
                      const val = parseFloat(e.target.value) || 0;
                      setSplitUpi(Math.max(0, pricing.total - val).toString());
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div className="flex-1">
                  <label className="text-xs font-bold text-muted-foreground ml-1">UPI Received</label>
                  <input
                    type="number"
                    placeholder="₹0"
                    className="w-full bg-muted border-none rounded-xl p-3 font-bold text-lg focus:ring-2 focus:ring-primary outline-none"
                    value={splitUpi}
                    onChange={(e) => {
                      setSplitUpi(e.target.value);
                      const val = parseFloat(e.target.value) || 0;
                      setSplitCash(Math.max(0, pricing.total - val).toString());
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={placing}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {placing ? "Placing Order..." : `Place Order • ₹${pricing.total.toFixed(2)}`}
        </button>

        <ItemNoteModal
          isOpen={!!noteModalItem}
          onClose={() => setNoteModalItem(null)}
          onSave={(note) => {
            if (noteModalItem) updateNote(noteModalItem.id, note);
          }}
          itemName={noteModalItem?.name || ""}
          initialNote={noteModalItem?.note || ""}
        />
      </motion.div>
    );
  }

  // ─── MENU + CART ───
  return (
    <div className={cartCount > 0 ? "pb-28" : "pb-6"}>
      {/* Search + Categories */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search menu (Press '/' to focus)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm"
            />
          </div>
          <button
            onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
            className="px-3.5 rounded-xl border border-border bg-card text-foreground flex items-center justify-center hover:bg-muted transition shadow-sm"
            title={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
          >
            {viewMode === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${category === cat
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid / List */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-3 animate-pulse">
              <div className="w-full aspect-[4/3] bg-muted rounded-xl mb-2" />
              <div className="h-4 bg-muted rounded w-3/4 mb-1" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3 animate-pulse flex justify-between items-center">
                <div className="flex flex-col gap-2 w-1/2">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-8 w-16 bg-muted rounded-xl" />
              </div>
            ))}
          </div>
        )
      ) : (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {availableItems.map((item) => {
            const qty = getCartQty(item.id!);
            return (
              <motion.div
                key={item.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-card rounded-2xl overflow-hidden border group hover:shadow-xl hover:shadow-primary/5 transition-shadow ${qty > 0 ? "border-primary/50 shadow-md shadow-primary/10" : "border-border/50"
                  }`}
              >
                <div className="relative overflow-hidden aspect-[4/3] bg-primary/5 flex items-center justify-center">
                  {(!item.image || item.image.includes("placeholder.svg") || item.image.includes("placeholder.jpg")) ? (
                    <CategoryIconPlaceholder category={item.category} />
                  ) : (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-2 right-2 bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
                    {item.priceLabel}
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-heading font-bold text-sm mb-0.5 truncate">{item.name}</h4>
                  <p className="text-muted-foreground text-xs mb-3 line-clamp-1">{item.category}</p>

                  {qty === 0 ? (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (item.variants && item.variants.length > 0) {
                          setVariantModalItem(item);
                        } else {
                          addToCart(item);
                        }
                      }}
                      className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus size={14} /> Add
                    </motion.button>
                  ) : (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          if (item.variants && item.variants.length > 0) {
                            setVariantModalItem(item);
                          } else {
                            updateQty(item.id!, -1);
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                      >
                        {qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="font-bold text-sm">{qty}</span>
                      <button
                        onClick={() => {
                          if (item.variants && item.variants.length > 0) {
                            setVariantModalItem(item);
                          } else {
                            updateQty(item.id!, 1);
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-secondary hover:text-secondary-foreground transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {availableItems.map((item) => {
              const qty = getCartQty(item.id!);
              return (
                <motion.div
                  key={item.name}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-card rounded-xl p-3 flex justify-between items-center border group hover:shadow-md transition-shadow ${qty > 0 ? "border-primary/50 shadow-sm" : "border-border/50"}`}
                >
                  <div 
                    className="flex-1 cursor-pointer pr-2"
                    onClick={() => {
                      if (item.variants && item.variants.length > 0) {
                        setVariantModalItem(item);
                      } else {
                        addToCart(item);
                      }
                    }}
                  >
                    <h4 className="font-heading font-bold text-sm mb-0.5">{item.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary font-bold">{item.priceLabel}</span>
                      <span className="text-[10px] text-muted-foreground">{item.category}</span>
                    </div>
                  </div>
                  
                  {qty === 0 ? (
                    <button
                      onClick={() => {
                        if (item.variants && item.variants.length > 0) {
                          setVariantModalItem(item);
                        } else {
                          addToCart(item);
                        }
                      }}
                      className="ml-2 w-16 bg-secondary text-secondary-foreground py-1.5 rounded-lg font-semibold text-xs flex items-center justify-center transition hover:bg-secondary/80"
                    >
                      Add
                    </button>
                  ) : (
                    <div className="ml-2 flex items-center gap-2 bg-primary/10 rounded-lg p-1 border border-primary/20">
                      <button
                        onClick={() => {
                          if (item.variants && item.variants.length > 0) {
                            setVariantModalItem(item);
                          } else {
                            updateQty(item.id!, -1);
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center bg-card rounded-md text-foreground shadow-sm hover:bg-muted"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center font-bold text-sm text-primary">{qty}</span>
                      <button
                        onClick={() => {
                          if (item.variants && item.variants.length > 0) {
                            setVariantModalItem(item);
                          } else {
                            updateQty(item.id!, 1);
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center bg-primary text-primary-foreground rounded-md shadow-sm hover:bg-primary/90"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* Cart Summary Bar */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4"
          >
            <div className="max-w-2xl mx-auto bg-primary text-primary-foreground rounded-2xl p-4 shadow-2xl shadow-primary/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {cartCount} item{cartCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-primary-foreground/80 text-xs">
                    ₹{pricing.total.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCart([])}
                  className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-all"
                  title="Clear cart"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setStep("checkout")}
                  className="bg-primary-foreground text-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-foreground/90 transition-all"
                >
                  Checkout →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && availableItems.length === 0 && (
        <div className="text-center py-12">
          <UtensilsCrossed size={36} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}

      <VariantSelectionModal
        item={variantModalItem as any}
        isOpen={!!variantModalItem}
        onClose={() => setVariantModalItem(null)}
        onAdd={handleVariantAdd as any}
      />

      <ItemNoteModal
        isOpen={!!noteModalItem}
        onClose={() => setNoteModalItem(null)}
        onSave={(note) => {
          if (noteModalItem) updateNote(noteModalItem.id, note);
        }}
        itemName={noteModalItem?.name || ""}
        initialNote={noteModalItem?.note || ""}
      />
    </div>
  );
};

export default CounterOrder;
