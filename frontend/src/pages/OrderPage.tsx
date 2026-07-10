import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Sparkles,
  Search,
  Tag,
  Loader2,
  X,
  Ban,
  Share2,
  AlertCircle,
  Clock,
  XCircle,
  Edit3,
  MoreVertical,
  Star,
  LayoutGrid,
  List,
  Coffee,
  Soup,
  IceCream,
  ChefHat,
  ConciergeBell,
  GlassWater,
  CupSoda,
  UtensilsCrossed,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useCart } from "@/hooks/useCart";
import { useLocationContent } from "@/hooks/useLocationContent";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import {
  apiPlaceOrder,
  apiValidateCoupon,
  apiGetBusinessSettings,
  apiCustomerEditOrder,
  apiCustomerPayDue,
  apiEditingStart,
  apiEditingEnd,
  apiGetOrderHistory,
  apiGetEstimate,
  type Order,
  type CouponValidation,
  type BusinessSettings,
} from "@/lib/apiClient";
import { calculateOrderPricing } from "@/lib/billing";
import { useDynamicMenu } from "@/hooks/useDynamicMenu";
import type { DynamicMenuItem } from "@/hooks/useDynamicMenu";
import { toast } from "@/hooks/use-toast";
import { downloadReceipt, printReceipt } from "@/lib/receiptGenerator";
import { downloadInvoicePdf } from "@/lib/invoicePdfGenerator";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryPlaceholder from "@/components/ui/CategoryPlaceholder";
import { Download, Printer, FileText, Receipt, Image as ImageIcon } from "lucide-react";
import NotFound from "./NotFound";



import VariantSelectionModal from "@/components/VariantSelectionModal";
import SessionBillModal from "@/components/SessionBillModal";

type Step = "menu" | "cart" | "checkout" | "confirmation";

export interface OrderPageProps {
  isTableMode?: boolean;
  tableSessionId?: string;
  tableNumber?: string;
  defaultName?: string;
  defaultPhone?: string;
  onSessionDone?: () => void;
  markingDone?: boolean;
  onCancelSession?: () => void;
  cancellingSession?: boolean;
  isTableLocked?: boolean;
}

function OrderPageContent({
  isTableMode = false,
  tableSessionId,
  tableNumber,
  defaultName = "",
  defaultPhone = "",
  onSessionDone,
  markingDone,
  onCancelSession,
  cancellingSession,
  isTableLocked = false
}: OrderPageProps) {


  const [activeCategory, setActiveCategory] = useState("All");
  const [vegOnly, setVegOnly] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [customerName, setCustomerName] = useState(defaultName);
  const [customerPhone, setCustomerPhone] = useState(defaultPhone);
  const paymentMethod = "online" as const;
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">(isTableMode ? "dine-in" : "takeaway");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [isPlacing, setIsPlacing] = useState(false);
  const [search, setSearch] = useState("");
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { settings: businessSettings, loading: settingsLoading } = useBusinessSettings();
  const [searchParams] = useSearchParams();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DynamicMenuItem | null>(
    null,
  );
  const historyRef = useRef<HTMLDivElement | null>(null);
  const {
    items: menuItems,
    categories,
    loading: menuLoading,
  } = useDynamicMenu();

  const locationData = useLocationContent();
  const restaurantStatus = useRestaurantStatus(locationData);

  // ─── Edit window state (20s after order) ────
  const [editTimeLeft, setEditTimeLeft] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<Order["items"]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isPayingDue, setIsPayingDue] = useState(false);
  const [editAddItem, setEditAddItem] = useState("");
  const editTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hoist all hooks here to avoid Rules of Hooks violations
  const hasInitializedEdit = useRef(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltySettings, setLoyaltySettings] = useState<{ enabled: boolean; points_per_100: number; discount_per_point: number } | null>(null);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);

  useEffect(() => {
    if (customerPhone.length === 10 && !isTableMode) {
      setCheckingLoyalty(true);
      fetch(`${import.meta.env.VITE_API_URL || ""}/customers/loyalty/${customerPhone}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.enabled) {
            setLoyaltyPoints(data.points || 0);
            if (data.settings) {
              setLoyaltySettings({
                enabled: data.settings.loyalty_enabled,
                points_per_100: data.settings.loyalty_points_per_100,
                discount_per_point: data.settings.loyalty_discount_per_point
              });
            }
          }
        })
        .catch(console.error)
        .finally(() => setCheckingLoyalty(false));
    } else {
      setLoyaltyPoints(0);
      setPointsRedeemed(0);
    }
  }, [customerPhone, isTableMode]);
  const editItemsRef = useRef<Order["items"]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    (localStorage.getItem("customerViewMode") as "grid" | "list") || "grid"
  );
  
  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("customerViewMode", mode);
  };
  const [open, setOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(
    null,
  );
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    count,
  } = useCart();

  const [variantModalItem, setVariantModalItem] = useState<DynamicMenuItem | null>(null);
  const [variantModalContext, setVariantModalContext] = useState<"cart" | "edit">("cart");

  const handleVariantAdd = (item: DynamicMenuItem, variant: { name: string; price: number }, quantity: number) => {
    if (isTableLocked) {
      toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
      return;
    }
    const newItem = {
      id: `${item.id}-${variant.name}`,
      name: `${item.name} (${variant.name})`,
      price: variant.price,
      priceLabel: `₹${variant.price}`,
      image: item.image || "/placeholder.svg",
      quantity,
    };

    if (variantModalContext === "edit") {
      const currentItems = getCurrentEditItems();
      const existing = currentItems.find((existingItem) => existingItem.id === newItem.id);

      const nextItems = existing
        ? currentItems.map((existingItem) =>
          existingItem.id === newItem.id
            ? { ...existingItem, quantity: existingItem.quantity + quantity }
            : existingItem,
        )
        : [...currentItems, newItem];

      syncEditItems(nextItems);
      setEditAddItem("");
    } else {
      addItem(newItem);
      toast({
        title: `${item.name} (${variant.name}) added to cart`,
      });
    }
    setVariantModalContext("cart");
  };

  const OrderSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-muted rounded-lg" />
      ))}
    </div>
  );

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "";

    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const filtered = (
    activeCategory === "All"
      ? menuItems
      : menuItems.filter((m) => m.category === activeCategory)
  )
    .filter((m) => {
      if (vegOnly && m.diet_type === "non-veg") return false;
      if (vegOnly && m.diet_type === "egg") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1));

  const validate = () => {
    // In table mode, name + phone are pre-filled from the session — skip validation
    if (isTableMode) return true;
    const errs: { name?: string; phone?: string } = {};
    if (!customerName.trim() || customerName.trim().length > 100)
      errs.name = "Enter a valid name (max 100 chars)";
    if (customerPhone.trim() && !/^[6-9]\d{9}$/.test(customerPhone.trim()))
      errs.phone = "Enter a valid 10-digit phone number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Coupon handling ─────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    setAppliedCoupon(null);

    try {
      const result = await apiValidateCoupon(couponInput.trim(), total);
      setAppliedCoupon(result);
      setCouponInput("");
      toast({
        title: "Coupon Applied! 🎉",
        description: `You save ₹${result.discount}`,
      });
    } catch (err: any) {
      setCouponError(err.message || "Invalid coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError("");
    setCouponInput("");
  };

  const loyaltyDiscountValue = pointsRedeemed * (loyaltySettings?.discount_per_point ?? 1);
  const totalDiscount = (appliedCoupon?.discount ?? 0) + loyaltyDiscountValue;

  const pricing = calculateOrderPricing(
    total,
    totalDiscount,
    businessSettings,
  );

  // ---------------- ORDER HISTORY ----------------
  const fetchOrderHistory = async () => {
    if (!customerPhone.trim()) return;

    setLoadingOrders(true);
    setHasFetched(false);

    try {
      const data = await apiGetOrderHistory(customerPhone);
      // Ensure always array
      setOrderHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("History fetch failed", err);
      setOrderHistory([]);
    } finally {
      setLoadingOrders(false);
      setHasFetched(true);
    }
  };


  useEffect(() => {
    if (step === "confirmation" && confirmedOrder) {
      // Show edit button while order is in 'new' status
      const isEditable = confirmedOrder.status === 'new';

      if (isEditable) {
        // Calculate initial remaining seconds
        const createdTime = new Date(confirmedOrder.createdAt).getTime();
        const now = Date.now();
        const elapsed = now - createdTime;
        const windowMs = 20000;
        const initialRemaining = Math.max(0, Math.ceil((windowMs - elapsed) / 1000));

        setEditTimeLeft(initialRemaining);

        if (initialRemaining > 0) {
          const interval = setInterval(() => {
            const currentNow = Date.now();
            const currentElapsed = currentNow - createdTime;
            const currentRemaining = Math.max(0, Math.ceil((windowMs - currentElapsed) / 1000));

            setEditTimeLeft(currentRemaining);
            if (currentRemaining <= 0) {
              clearInterval(interval);
            }
          }, 1000);
          return () => clearInterval(interval);
        }
      } else {
        setEditTimeLeft(0);
      }

      // Only reset edit items on initial entry, not when confirmedOrder updates after save
      if (!hasInitializedEdit.current && isEditable) {
        const initialItems = confirmedOrder.items.map((i) => ({ ...i }));
        setEditItems(initialItems);
        editItemsRef.current = initialItems;
        hasInitializedEdit.current = true;
      }

      if (!isEditable) {
        hasInitializedEdit.current = false;
      }
    } else {
      hasInitializedEdit.current = false;
      setEditTimeLeft(0);
    }
  }, [step, confirmedOrder?.status, confirmedOrder?.id, confirmedOrder?.createdAt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historyRef.current &&
        !historyRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    };

    if (showHistory) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistory]);

  useEffect(() => {
    if (menuLoading) return; // wait for API menu to load

    const itemSlug = searchParams.get("item");
    if (!itemSlug) return;

    // Find the menu item by slug
    const menuItem = menuItems.find((m) => m.slug === itemSlug);
    if (!menuItem || !menuItem.id) return;

    // Prevent duplicate add
    const alreadyInCart = items.find((i) => i.id === menuItem.id);

    if (!alreadyInCart) {
      if (menuItem.variants && menuItem.variants.length > 0) {
        setVariantModalItem(menuItem);
      } else {
        addItem({
          id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          priceLabel: menuItem.priceLabel,
          image: menuItem.image,
        });

        toast({
          title: `${menuItem.name} added to cart`,
          description: "You can continue adding more items.",
        });
      }
    }

    // Scroll to the item in the menu
    const timer = setTimeout(() => {
      const el = document.getElementById(itemSlug);

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        el.classList.add("ring-4", "ring-primary", "ring-offset-2");

        setTimeout(() => {
          el.classList.remove("ring-4", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [menuLoading, searchParams, menuItems, items, addItem]);

  // Cleanup editing state on unmount
  useEffect(() => {
    return () => {
      if (isEditing && confirmedOrder?.id) {
        apiEditingEnd(confirmedOrder.id);
      }
    };
  }, [isEditing, confirmedOrder?.id]);

  // Early returns must happen AFTER all hooks are defined
  if (settingsLoading || menuLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <h2 className="text-xl font-bold font-heading">Loading Restaurant Menu...</h2>
          <p className="text-muted-foreground mt-2">Checking services and availability</p>
        </div>
      </div>
    );
  }

  if (!businessSettings) {
    return <NotFound />;
  }

  // ---------------- FEATURE GATING ----------------
  if (businessSettings && businessSettings.isActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-center">
        <div>
          <Ban className="text-destructive w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Service Suspended</h1>
          <p className="text-muted-foreground">This restaurant's online services are currently unavailable.</p>
        </div>
      </div>
    );
  }

  if (businessSettings && !businessSettings.features?.qr_digital_ordering) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-center">
        <div className="max-w-sm">
          <Ban className="text-muted-foreground w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Online Ordering Disabled</h1>
          <p className="text-muted-foreground">Please place your order directly at the counter.</p>
          <Link to="/" className="mt-6 inline-block bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-xl">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  // ---------------- QUICK REORDER ----------------
  const handleReorder = (order: any) => {
    clearCart();

    order.items.forEach((historyItem: any) => {
      const menuMatch = menuItems.find((m) => m.name === historyItem.name);

      if (!menuMatch || !menuMatch.id) return;

      for (let i = 0; i < historyItem.quantity; i++) {
        addItem({
          id: menuMatch.id,
          name: menuMatch.name,
          price: menuMatch.price,
          priceLabel: menuMatch.priceLabel,
          image: menuMatch.image,
        });
      }
    });

    setStep("cart");
  };

  const handlePlaceOrder = async () => {
    if (isTableLocked) {
      toast({
        title: "Table Locked",
        description: "Please wait for a waiter to unlock your table before placing an order.",
        variant: "destructive"
      });
      return;
    }
    if (!restaurantStatus.open) {
      toast({
        title: "Restaurant Closed",
        description: restaurantStatus.message,
        variant: "destructive",
      });
      return;
    }
    if (!validate()) return;
    setIsPlacing(true);
    try {
      const order = await apiPlaceOrder(
        customerName,
        customerPhone,
        items,
        paymentMethod,
        appliedCoupon?.code,
        orderType,
        specialInstructions.trim(),
        isTableMode ? "table" : "counter",
        tableSessionId || null,
        0,
        0,
        undefined,
        pointsRedeemed
      );
      // fetch estimated wait time in background
      apiGetEstimate().then(estimateData => {
        setEstimatedTime(estimateData.estimatedMinutes);
      }).catch(err => {
        console.error("Failed to fetch estimated time:", err);
      });

      setConfirmedOrder(order);
      clearCart();
      setStep("confirmation");
    } catch (err) {
      console.error("Failed to place order:", err);
      toast({
        title: "Order Failed ❌",
        description:
          "Something went wrong while placing your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPlacing(false);
    }
  };



  const syncEditItems = (nextItems: Order["items"]) => {
    editItemsRef.current = nextItems;
    setEditItems(nextItems);
  };

  const getCurrentEditItems = () =>
    editItemsRef.current.length > 0 ? editItemsRef.current : editItems;

  const handleEditQty = (id: number | string, delta: number) => {
    if (isTableLocked) {
      toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
      return;
    }
    const nextItems = getCurrentEditItems()
      .map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
      )
      .filter((i) => i.quantity > 0);

    syncEditItems(nextItems);
  };

  const handleEditAddItem = () => {
    const selectedMenuItemId = Number(editAddItem);
    if (!Number.isFinite(selectedMenuItemId)) return;

    const menuItem = menuItems.find((m) => m.id === selectedMenuItemId);
    if (!menuItem || typeof menuItem.id !== "number") return;

    if (menuItem.variants && menuItem.variants.length > 0) {
      setVariantModalContext("edit");
      setVariantModalItem(menuItem);
      return;
    }

    const currentItems = getCurrentEditItems();
    const existing = currentItems.find((item) => item.id === menuItem.id);

    const nextItems = existing
      ? currentItems.map((item) =>
        item.id === menuItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      )
      : [
        ...currentItems,
        {
          id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          priceLabel: menuItem.priceLabel || "",
          quantity: 1,
          image: menuItem.image || "/placeholder.svg",
        },
      ];

    syncEditItems(nextItems);
    setEditAddItem("");
  };

  const handleSaveEdit = async () => {
    const currentItems = editItemsRef.current;
    if (!confirmedOrder || currentItems.length === 0) return;
    setIsSavingEdit(true);
    try {
      // Deep copy the local items as the source of truth
      const itemsSnapshot = currentItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        priceLabel: i.priceLabel || "",
        quantity: i.quantity,
        image: i.image || "",
      }));

      const result = await apiCustomerEditOrder(
        confirmedOrder.id,
        itemsSnapshot as any,
        confirmedOrder.customerPhone,
      );

      // Prefer server response items, but always fall back to local snapshot
      const serverItems = result.order.items;
      const updatedItems =
        Array.isArray(serverItems) && serverItems.length >= itemsSnapshot.length
          ? serverItems.map((si) => ({ ...si }))
          : itemsSnapshot;

      // Update confirmedOrder with new items and pricing - stop editing first
      setIsEditing(false);
      setConfirmedOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: updatedItems,
          subtotal: result.order.subtotal ?? prev.subtotal,
          discount: result.order.discount ?? prev.discount,
          cgst: result.order.cgst ?? prev.cgst,
          sgst: result.order.sgst ?? prev.sgst,
          gst: result.order.gst ?? prev.gst,
          total: result.order.total ?? prev.total,
          paymentMethod: result.order.paymentMethod ?? prev.paymentMethod,
          paymentStatus:
            (result.order.paymentStatus as Order["paymentStatus"]) ??
            prev.paymentStatus,
          paidAmount: result.order.paidAmount ?? prev.paidAmount,
          business: result.order.business ?? prev.business,
        };
      });

      syncEditItems(updatedItems.map((i) => ({ ...i })));

      apiEditingEnd(confirmedOrder.id);
      const due = (result.order as any).due ?? 0;
      if (due > 0) {
        toast({
          title: "Order Updated ✅",
          description: `Updated the order!.`,
        });
      } else {
        toast({
          title: "Order Updated ✅",
          description: "Your order has been updated successfully.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Edit Failed ❌",
        description: err.message || "Could not update order.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
      apiEditingEnd(confirmedOrder.id);
    }
  };


  if (step === "confirmation" && confirmedOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-3xl p-8 md:p-12 text-center max-w-md w-full border border-border/50 shadow-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="text-emerald-500" size={40} />
          </motion.div>
          <h1 className="font-heading text-3xl font-bold mb-2">
            Order Placed!
          </h1>
          <p className="text-muted-foreground mb-6">
            Your order has been sent to the kitchen
          </p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-6 mb-6"
          >
            <p className="text-sm text-muted-foreground mb-1">
              Your Token Number
            </p>
            <p className="font-heading text-6xl font-bold text-primary">
              #{confirmedOrder.token}
            </p>
            <AnimatePresence>
              {estimatedTime !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4"
                >
                  <p className="text-sm text-muted-foreground mb-1">
                    Estimated Wait Time
                  </p>
                  <p className="font-semibold text-lg text-secondary">
                    {estimatedTime - 2} - {estimatedTime + 3} mins
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ─── Edit Order Button (visible while order is in 'new' status) ─── */}
          <AnimatePresence>
            {editTimeLeft > 0 && !isEditing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <button
                  onClick={() => {
                    setIsEditing(true);
                    if (confirmedOrder) {
                      const freshItems = confirmedOrder.items.map((i) => ({ ...i }));
                      syncEditItems(freshItems);
                      apiEditingStart(confirmedOrder.id, confirmedOrder.customerPhone);
                    }
                  }}
                  className="w-full bg-accent/20 border border-accent/40 rounded-xl p-3 flex items-center justify-between hover:bg-accent/30 transition-all"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Edit3 size={16} /> Edit your order
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 animate-pulse">
                    ⏱️ {editTimeLeft}s left
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Edit Mode ─── */}
          <AnimatePresence>
            {isEditing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 bg-muted/50 rounded-2xl p-4 border border-border text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Edit Items</h3>
                  <span className="text-xs text-muted-foreground">
                    Take your time
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm truncate flex-1">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditQty(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-destructive/20 transition-colors"
                        >
                          {item.quantity === 1 ? (
                            <Trash2 size={13} className="text-destructive" />
                          ) : (
                            <Minus size={13} />
                          )}
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleEditQty(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="text-sm font-medium w-16 text-right">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
                {editItems.length === 0 && (
                  <p className="text-xs text-destructive text-center py-2">
                    Add at least one item
                  </p>
                )}
                {/* Add New Item */}

                <div className="border-t border-border mt-3 pt-3">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">
                    Add New Item
                  </p>

                  <div className="flex gap-2 items-center">
                    {/* Custom Dropdown */}
                    <div className="relative flex-1 max-w-[260px]">
                      <button
                        onClick={() => setOpen((prev) => !prev)}
                        className="w-full h-9 px-3 rounded-lg border border-border 
                   bg-background text-sm text-left flex items-center justify-between"
                      >
                        <span className="truncate">
                          {menuItems.find((i) => String(i.id) === editAddItem)
                            ?.name || "Select item..."}
                        </span>
                        <span className="text-xs opacity-60">▼</span>
                      </button>

                      {open && (
                        <div
                          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto 
                        rounded-lg border border-border bg-background shadow-lg custom-scrollbar"
                        >
                          {menuItems
                            .filter((m) => m.available)
                            .map((m) => (
                              <div
                                key={m.id}
                                onClick={() => {
                                  setEditAddItem(String(m.id));
                                  setOpen(false);
                                }}
                                className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                              >
                                {m.name} - ₹{m.price}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Plus Button (unchanged behavior) */}
                    <button
                      onClick={handleEditAddItem}
                      disabled={!editAddItem}
                      className="h-9 w-9 flex items-center justify-center rounded-lg 
                 bg-yellow-500 hover:bg-yellow-600 
                 text-black transition 
                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <div className="border-t border-border mt-3 pt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      const resetItems = confirmedOrder.items.map((i) => ({
                        ...i,
                      }));
                      syncEditItems(resetItems);
                      apiEditingEnd(confirmedOrder.id);
                    }}
                    className="flex-1 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || editItems.length === 0}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Order Summary ─── */}
          {!isEditing && (
            <div className="text-left space-y-2 mb-6">
              {confirmedOrder.items.map((item) => (
                <div
                  key={`${item.id}-${item.name}`}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span className="font-semibold">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
              {(confirmedOrder.discount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-primary font-medium">
                  <span>Discount ({confirmedOrder.couponCode})</span>
                  <span>-₹{confirmedOrder.discount}</span>
                </div>
              )}
              {(confirmedOrder.gst ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>CGST</span>
                    <span>₹{confirmedOrder.cgst ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>SGST</span>
                    <span>₹{confirmedOrder.sgst ?? 0}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{confirmedOrder.total}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Payment:{" "}
                {confirmedOrder.orderSource === "table"
                  ? "Added to Table Bill"
                  : confirmedOrder.paymentMethod === "online"
                    ? "Paid Online"
                    : "Pay at Counter"}
              </p>

            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  downloadReceipt({
                    token: confirmedOrder.token,
                    customerName: confirmedOrder.customerName,
                    customerPhone: confirmedOrder.customerPhone,
                    items: confirmedOrder.items,
                    subtotal: confirmedOrder.subtotal,
                    discount: confirmedOrder.discount,
                    couponCode: confirmedOrder.couponCode,
                    cgst: confirmedOrder.cgst,
                    sgst: confirmedOrder.sgst,
                    gst: confirmedOrder.gst,
                    total: confirmedOrder.total,
                    paymentMethod: confirmedOrder.paymentMethod,
                    paidAmount: confirmedOrder.paidAmount,
                    createdAt: confirmedOrder.createdAt,
                    business: confirmedOrder.business,
                  })
                }
                className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-xl font-semibold transition-all hover:bg-secondary/80 flex items-center justify-center gap-2"
              >
                <Download size={18} /> Receipt
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setStep("menu");
                setConfirmedOrder(null);
                // For counter mode only, reset name/phone
                if (!isTableMode) {
                  setCustomerName("");
                  setCustomerPhone("");
                  removeCoupon();
                }
              }}
              className="w-full bg-muted text-foreground py-3 rounded-xl font-semibold transition-all hover:bg-muted/70"
            >
              {isTableMode ? "Order More Items" : "Order More"}
            </motion.button>
            <Link
              to="/"
              className="w-full bg-card border border-border text-foreground py-3 rounded-xl font-semibold text-center hover:bg-muted transition-all"
            >
              Go Home
            </Link>
          </div>
        </motion.div>
        <VariantSelectionModal
          item={variantModalItem as any}
          isOpen={!!variantModalItem}
          onClose={() => setVariantModalItem(null)}
          onAdd={handleVariantAdd as any}
        />
      </div>
    );
  }

  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-8">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setStep("cart")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft size={20} /> Back to Cart
          </button>

          <h1 className="font-heading text-3xl font-bold mb-8">Checkout</h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* NAME */}
            {!isTableMode && (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  Your Name
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  maxLength={100}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-ring focus:outline-none transition-shadow"
                />
                {errors.name && (
                  <p className="text-destructive text-xs mt-1">{errors.name}</p>
                )}
              </div>
            )}

            {/* PHONE */}
            {!isTableMode && (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  Phone Number (Optional)
                </label>
                <input
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(
                      e.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-ring focus:outline-none transition-shadow"
                />
                {errors.phone && (
                  <p className="text-destructive text-xs mt-1">{errors.phone}</p>
                )}
              </div>
            )}

            {/* LOYALTY BANNER */}
            {loyaltyPoints > 0 && loyaltySettings?.enabled && !isTableMode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-primary flex items-center gap-2">
                      <Star className="w-4 h-4 fill-primary" />
                      Loyalty Reward Available
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You have {loyaltyPoints} points worth ₹{(loyaltyPoints * loyaltySettings.discount_per_point).toFixed(2)}.
                    </p>
                  </div>
                  {pointsRedeemed > 0 ? (
                    <button
                      onClick={() => setPointsRedeemed(0)}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-destructive/10 text-destructive"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const maxPoints = Math.floor(pricing.subtotal / loyaltySettings.discount_per_point);
                        setPointsRedeemed(Math.min(loyaltyPoints, maxPoints || loyaltyPoints));
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground"
                    >
                      Redeem
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ORDER HISTORY BUTTON */}
            {customerPhone.trim().length === 10 && (
              <>
                <motion.button
                  disabled={loadingOrders}
                  whileHover={!loadingOrders ? { scale: 1.02 } : {}}
                  whileTap={!loadingOrders ? { scale: 0.98 } : {}}
                  onClick={() => {
                    if (!showHistory) {
                      fetchOrderHistory();
                    }
                    setShowHistory((prev) => !prev);
                  }}
                  className="text-primary text-sm font-semibold disabled:opacity-50"
                >
                  {loadingOrders
                    ? "Loading..."
                    : showHistory
                      ? "Hide Past Orders"
                      : "View Past Orders"}
                </motion.button>

                {/* ORDER HISTORY PANEL */}
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      ref={historyRef}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-card border rounded-2xl p-4 space-y-3 max-h-48 overflow-y-auto relative shadow-lg"
                    >
                      {/* Close Button */}
                      <button
                        onClick={() => setShowHistory(false)}
                        className="absolute top-3 right-3 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Close
                      </button>

                      {loadingOrders && <OrderSkeleton />}

                      {!loadingOrders &&
                        hasFetched &&
                        orderHistory.length === 0 && (
                          <div className="text-center text-sm text-muted-foreground">
                            No past orders found
                          </div>
                        )}

                      {!loadingOrders &&
                        orderHistory.length > 0 &&
                        orderHistory.map((order) => (
                          <div
                            key={order.id}
                            className="border-b pb-3 text-sm space-y-1"
                          >
                            {/* Header */}
                            <div className="flex justify-between font-semibold">
                              <span>Token #{order.token}</span>
                              <span className="capitalize text-muted-foreground">
                                {order.status}
                              </span>
                            </div>

                            {/* Date */}
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(order.createdAt)}
                            </div>

                            {/* Items */}
                            <div className="text-xs space-y-0.5">
                              {order.items?.map((item: any, idx: number) => (
                                <div key={idx}>
                                  • {item.name} {item.qty && `x${item.qty}`}
                                </div>
                              ))}
                            </div>

                            {/* Reorder */}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleReorder(order)}
                              className="text-secondary text-xs mt-1 font-semibold"
                            >
                              Reorder
                            </motion.button>
                          </div>
                        ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}



            {/* SPECIAL INSTRUCTIONS */}
            {!isTableMode && (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  Special Instructions <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. No onions, extra spicy, allergies..."
                  maxLength={300}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-ring focus:outline-none transition-shadow resize-none text-sm"
                />
              </div>
            )}



            {/* COUPON CODE */}
            {!isTableMode && (
              <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Tag size={16} className="text-primary" />
                  Have a coupon?
                </label>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <div>
                      <span className="font-bold text-primary text-sm">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {appliedCoupon.discountType === "percent"
                          ? `${appliedCoupon.value}% off`
                          : `₹${appliedCoupon.discount} off`}
                      </span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      placeholder="Enter coupon code"
                      maxLength={20}
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm uppercase tracking-wider"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponInput.trim()}
                      className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2 shrink-0"
                    >
                      {validatingCoupon ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </motion.button>
                  </div>
                )}

                {couponError && (
                  <p className="text-destructive text-xs font-medium">
                    {couponError}
                  </p>
                )}
              </div>
            )}

            {/* ORDER SUMMARY */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-2">
              {items.map((item) => (
                <div key={item.name} className="flex justify-between text-sm">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>₹{item.price * item.quantity}</span>
                </div>
              ))}

              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{pricing.subtotal}</span>
                </div>

                {appliedCoupon && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex justify-between text-sm text-primary font-medium"
                  >
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-₹{(appliedCoupon?.discount ?? 0).toFixed(2)}</span>
                  </motion.div>
                )}

                {pointsRedeemed > 0 && loyaltySettings?.enabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex justify-between text-sm text-primary font-medium"
                  >
                    <span>Loyalty Reward ({pointsRedeemed} pts)</span>
                    <span>-₹{loyaltyDiscountValue.toFixed(2)}</span>
                  </motion.div>
                )}

                {pricing.gst > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>CGST</span>
                      <span>₹{pricing.cgst}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>SGST</span>
                      <span>₹{pricing.sgst}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between font-bold text-lg pt-1">
                  <span>Total</span>
                  <span>₹{pricing.total}</span>
                </div>
              </div>
            </div>

            {/* PLACE ORDER BUTTON */}
            {!restaurantStatus.open && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <Clock size={20} className="text-destructive shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-destructive">Restaurant is currently closed</p>
                  <p className="text-xs text-muted-foreground">{restaurantStatus.message}</p>
                </div>
              </div>
            )}
            <motion.button
              whileHover={restaurantStatus.open && !isTableLocked ? { scale: 1.01 } : {}}
              whileTap={restaurantStatus.open && !isTableLocked ? { scale: 0.99 } : {}}
              onClick={handlePlaceOrder}
              disabled={isPlacing || !restaurantStatus.open || isTableLocked}
              className="w-full bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!restaurantStatus.open ? "Restaurant Closed" : isPlacing ? "Placing..." : isTableLocked ? "Table Locked" : isTableMode ? "Place Order (Pay Later)" : `Place Order`}
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between py-3 px-3 sm:px-4 gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1 mr-2"
          >
            <ArrowLeft size={18} className="shrink-0 sm:w-5 sm:h-5" />
            <span className="font-heading text-base sm:text-xl font-bold leading-tight truncate min-w-0">
              <span className="text-primary truncate block">{businessSettings?.restaurantName || "Classic Chinese"}</span>
            </span>
            {isTableMode && tableNumber && (
              <span className="ml-0.5 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] sm:text-xs font-bold border border-primary/30 shadow-sm shrink-0 whitespace-nowrap">
                Table {tableNumber}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isTableMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 sm:px-3 sm:py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-1 shadow-sm">
                    <MoreVertical size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline text-xs font-semibold">Options</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl border-border/50">
                  {onSessionDone && (
                    <DropdownMenuItem
                      onClick={onSessionDone}
                      disabled={markingDone}
                      className="gap-3 py-3 px-3 rounded-xl cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 font-bold"
                    >
                      {markingDone ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Done Eating
                    </DropdownMenuItem>
                  )}
                  {tableSessionId && (
                    <DropdownMenuItem
                      onClick={() => setIsBillOpen(true)}
                      className="gap-3 py-3 px-3 rounded-xl cursor-pointer font-bold text-secondary focus:text-secondary focus:bg-secondary/10"
                    >
                      <Receipt size={16} />
                      My Bill
                    </DropdownMenuItem>
                  )}
                  {onCancelSession && (
                    <DropdownMenuItem
                      onClick={onCancelSession}
                      disabled={cancellingSession}
                      className="gap-3 py-3 px-3 rounded-xl cursor-pointer font-medium text-muted-foreground focus:text-foreground mt-2 border-t border-border/50"
                    >
                      {cancellingSession ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                      Release Table
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (isTableLocked) {
                  toast({ title: "Table Locked", description: "You cannot view the cart until the table is unlocked.", variant: "destructive" });
                  return;
                }
                if (count > 0) setStep("cart");
              }}
              className="relative bg-primary text-primary-foreground px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-md shadow-primary/20 transition-all whitespace-nowrap"
            >
              <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-[10px] sm:text-xs">Cart</span>
              {count > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-secondary text-secondary-foreground w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-bold flex items-center justify-center shadow-sm"
                >
                  {count}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {step === "cart" ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="container mx-auto p-4 max-w-lg"
        >
          <button
            onClick={() => setStep("menu")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft size={20} /> Continue Shopping
          </button>

          {/* 🔥 HEADER WITH CLEAR CART */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-heading text-3xl font-bold">Your Cart</h1>

            {items.length > 0 && (
              <button
                onClick={() => {
                  clearCart();

                  toast({
                    title: "Cart Cleared",
                    description: "All items removed from cart",
                  });
                }}
                className="flex items-center gap-1 text-sm font-medium text-destructive hover:underline"
              >
                <Trash2 size={14} />
                Clear Cart
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart size={36} className="text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground font-medium">
                Your cart is empty
              </p>
              <p className="text-muted-foreground/60 text-sm mt-1">
                Add some delicious dishes!
              </p>
              <button
                onClick={() => setStep("menu")}
                className="mt-4 text-primary font-semibold hover:underline"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div
                    key={item.name}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-4 bg-card border border-border/50 rounded-2xl p-4"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-primary/5 flex items-center justify-center">
                      {(!item.image || item.image.includes("placeholder.svg") || item.image.includes("placeholder.jpg")) ? (
                        <div className="w-full h-full p-2">
                          <CategoryPlaceholder category={item.category} />
                        </div>
                      ) : (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {item.name}
                      </h3>
                      <p className="text-primary font-bold text-sm">
                        {item.priceLabel}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                      >
                        {item.quantity === 1 ? (
                          <Trash2 size={14} />
                        ) : (
                          <Minus size={14} />
                        )}
                      </button>

                      <span className="w-8 text-center font-bold">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* SPECIAL INSTRUCTIONS (TABLE MODE ONLY) */}
              {isTableMode && (
                <div className="pt-2">
                  <label className="text-sm font-semibold mb-1.5 block">
                    Special Instructions <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. No onions, extra spicy, allergies..."
                    maxLength={300}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-ring focus:outline-none transition-shadow resize-none text-sm"
                  />
                </div>
              )}

              {/* 💰 TOTAL */}
              <div className="border-t border-border pt-4 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>₹{total}</span>
              </div>

              {/* 🚀 CHECKOUT */}
              {!restaurantStatus.open && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <Clock size={20} className="text-destructive shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-destructive">Restaurant is currently closed</p>
                    <p className="text-xs text-muted-foreground">{restaurantStatus.message}</p>
                  </div>
                </div>
              )}
              <motion.button
                whileHover={restaurantStatus.open && !isTableLocked ? { scale: 1.01 } : {}}
                whileTap={restaurantStatus.open && !isTableLocked ? { scale: 0.99 } : {}}
                onClick={() => {
                  if (isTableLocked) return;
                  if (restaurantStatus.open) {
                    isTableMode ? handlePlaceOrder() : setStep("checkout");
                  }
                }}
                disabled={!restaurantStatus.open || isPlacing || isTableLocked}
                className="w-full bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlacing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin" /> Placing Order...
                  </span>
                ) : !restaurantStatus.open ? "Ordering Unavailable" : isTableLocked ? "Table is Locked" : isTableMode ? "Place Order" : "Proceed to Checkout"}
              </motion.button>
            </div>
          )}
        </motion.div>
      ) : (
        <>
          {/* Closed banner */}
          {!restaurantStatus.open && !menuLoading && (
            <div className="bg-destructive/10 border-b border-destructive/20">
              <div className="container mx-auto px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                  <Clock size={20} className="text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-destructive">We're currently closed</p>
                  <p className="text-xs text-muted-foreground">{restaurantStatus.message} - Browse the menu, but orders can only be placed during opening hours.</p>
                </div>
              </div>
            </div>
          )}

          {!menuLoading && menuItems.length > 0 && (
            <div className="sticky top-[57px] z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
              <div className="container mx-auto px-4 py-3 space-y-3">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search menu…"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm transition-shadow"
                  />
                </div>
                <div
                  className="flex gap-2 overflow-x-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  {categories.map((cat) => (
                    <motion.button
                      key={cat}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeCategory === cat
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-card text-foreground/70 hover:bg-muted border border-border/50"
                        }`}
                    >
                      {cat}
                    </motion.button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-4 px-1">
                  <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
                    <button
                      onClick={() => handleViewModeChange("grid")}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      title="Grid View"
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      onClick={() => handleViewModeChange("list")}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      title="List View"
                    >
                      <List size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVegOnly(!vegOnly)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${vegOnly ? 'bg-green-600' : 'bg-muted-foreground/30'}`}
                    >
                      <motion.div
                        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                        animate={{ x: vegOnly ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm border border-green-600 bg-green-50 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span></span>
                      Veg Only
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="container mx-auto p-4">
            <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-3"}>
              {menuLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-card rounded-2xl overflow-hidden border border-border/50"
                  >
                    <Skeleton className="aspect-square w-full rounded-none" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-8 w-full rounded-xl" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((item) => {
                      const inCart = items.find((i) => i.id === item.id);
                      return (
                        <motion.div
                          key={item.name}
                          id={item.slug}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => setSelectedItem(item)}
                          className={`bg-card rounded-2xl overflow-hidden border border-border/50 group hover:shadow-xl hover:shadow-primary/5 transition-shadow cursor-pointer ${viewMode === "list" ? "flex flex-row items-center justify-between p-3 gap-3" : "flex flex-col h-full"} ${!item.available ? "opacity-70" : ""}`}
                        >
                          {viewMode === "grid" && (
                            <div className="relative overflow-hidden aspect-square bg-primary/5 flex items-center justify-center shrink-0">
                              {(!item.image || item.image.includes("placeholder.svg") || item.image.includes("placeholder.jpg")) ? (
                                <CategoryPlaceholder category={item.category} />
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
                          )}
                          <div className={`flex flex-col flex-grow min-w-0 ${viewMode === "list" ? "" : "p-3"}`}>
                            <h3 className={`font-bold leading-tight flex items-start gap-1.5 ${viewMode === "list" ? "text-sm mb-1 truncate" : "text-base"}`}>
                              <span className="truncate">{item.name}</span>
                              {item.diet_type === "veg" && <span className="w-3 h-3 rounded-sm border border-green-600 bg-green-50 flex items-center justify-center mt-0.5 shrink-0" title="Veg"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span></span>}
                              {item.diet_type === "non-veg" && <span className="w-3 h-3 rounded-sm border border-red-600 bg-red-50 flex items-center justify-center mt-0.5 shrink-0" title="Non-Veg"><span className="w-1.5 h-1.5 rounded-full bg-red-600"></span></span>}
                              {item.diet_type === "egg" && <span className="w-3 h-3 rounded-sm border border-yellow-600 bg-yellow-50 flex items-center justify-center mt-0.5 shrink-0" title="Contains Egg"><span className="w-1.5 h-1.5 rounded-full bg-yellow-600"></span></span>}
                            </h3>
                            
                            {viewMode === "grid" && (
                              <p className="text-muted-foreground text-xs mb-3 line-clamp-2">
                                {item.desc}
                              </p>
                            )}

                            {viewMode === "list" && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-primary font-bold text-sm tracking-tight">{item.priceLabel}</span>
                                <span className="text-muted-foreground text-xs">{item.category}</span>
                              </div>
                            )}

                            <div className={`${viewMode === "grid" ? "mt-auto" : "hidden"}`} onClick={(e) => e.stopPropagation()}>
                              {!item.available ? (
                                <div className="w-full bg-destructive/10 text-destructive py-2 rounded-xl font-semibold text-xs text-center flex items-center justify-center gap-1">
                                  <Ban size={12} /> Out of Stock
                                </div>
                              ) : inCart ? (
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => {
                                      if (isTableLocked) {
                                        toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
                                        return;
                                      }
                                      updateQuantity(
                                        item.id!,
                                        inCart.quantity - 1,
                                      );
                                    }}
                                    className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                                  >
                                    {inCart.quantity === 1 ? (
                                      <Trash2 size={12} />
                                    ) : (
                                      <Minus size={12} />
                                    )}
                                  </button>
                                  <span className="font-bold text-sm">
                                    {inCart.quantity}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (isTableLocked) {
                                        toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
                                        return;
                                      }
                                      updateQuantity(
                                        item.id!,
                                        inCart.quantity + 1,
                                      );
                                    }}
                                    className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-secondary hover:text-secondary-foreground transition-all"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    if (isTableLocked) {
                                      toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
                                      return;
                                    }
                                    if (item.variants && item.variants.length > 0) {
                                      setVariantModalContext("cart");
                                      setVariantModalItem(item);
                                    } else {
                                      addItem({
                                        id: item.id!,
                                        name: item.name,
                                        price: item.price,
                                        priceLabel: item.priceLabel,
                                        image: item.image,
                                      });
                                    }
                                  }}
                                  className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <Plus size={14} /> Add
                                </motion.button>
                              )}
                            </div>
                          </div>

                          {viewMode === "list" && (
                            <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                              {!item.available ? (
                                <span className="text-destructive font-semibold text-xs">Out of Stock</span>
                              ) : inCart ? (
                                <div className="flex items-center gap-3 bg-muted p-1 rounded-lg border border-border/50">
                                  <button
                                    onClick={() => {
                                      if (isTableLocked) {
                                        toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
                                        return;
                                      }
                                      updateQuantity(item.id!, inCart.quantity - 1);
                                    }}
                                    className="w-7 h-7 rounded-md bg-card flex items-center justify-center shadow-sm hover:text-destructive transition-colors"
                                  >
                                    {inCart.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                                  </button>
                                  <span className="font-bold text-sm w-4 text-center">{inCart.quantity}</span>
                                  <button
                                    onClick={() => {
                                      if (isTableLocked) {
                                        toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
                                        return;
                                      }
                                      updateQuantity(item.id!, inCart.quantity + 1);
                                    }}
                                    className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-sm transition-colors"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    if (isTableLocked) {
                                      toast({ title: "Table Locked", description: "You cannot modify the cart until the table is unlocked.", variant: "destructive" });
                                      return;
                                    }
                                    if (item.variants && item.variants.length > 0) {
                                      setVariantModalContext("cart");
                                      setVariantModalItem(item);
                                    } else {
                                      addItem({
                                        id: item.id!,
                                        name: item.name,
                                        price: item.price,
                                        priceLabel: item.priceLabel,
                                        image: item.image,
                                      });
                                    }
                                  }}
                                  className="bg-[#D9A019] hover:bg-[#C08C15] text-white px-5 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors"
                                >
                                  Add
                                </motion.button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {filtered.length === 0 && (
                    <div className="col-span-full text-center py-16">
                      <UtensilsCrossed
                        size={48}
                        className="mx-auto mb-4 text-muted-foreground/30"
                      />
                      <p className="text-muted-foreground font-medium">
                        {menuItems.length === 0
                          ? "Menu Coming Soon!"
                          : "No items found"}
                      </p>
                      <p className="text-muted-foreground/60 text-sm mt-1">
                        {menuItems.length === 0
                          ? "Our menu is being prepared. Please check back shortly!"
                          : "Try a different search or category"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {count > 0 && step === "menu" && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-0 left-0 right-0 p-4 z-50"
              >
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setStep("cart")}
                  className="w-full max-w-lg mx-auto flex items-center justify-between bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-4 px-6 rounded-2xl font-bold shadow-2xl shadow-primary/30 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingCart size={20} />
                    {count} item{count > 1 ? "s" : ""}
                  </span>
                  <span>View Cart - ₹{total}</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
              >
                <X size={18} />
              </button>

              <div className="relative h-56 sm:h-72 overflow-hidden">
                <img
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-bold">
                    {selectedItem.priceLabel}
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="font-heading font-bold text-xl sm:text-2xl mb-1">
                    {selectedItem.name}
                  </h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {selectedItem.category}
                  </span>
                </div>

                <p className="text-muted-foreground text-sm leading-relaxed">
                  {selectedItem.desc}
                </p>

                {!selectedItem.available && (
                  <div className="bg-destructive/10 text-destructive py-2 px-3 rounded-xl text-sm flex items-center gap-2">
                    <Ban size={14} /> Currently out of stock
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {selectedItem.available ? (
                    (() => {
                      const inCart = items.find(
                        (i) => i.id === selectedItem.id,
                      );
                      return inCart ? (
                        <div className="flex-1 flex items-center justify-center gap-4 bg-muted rounded-xl py-3">
                          <button
                            onClick={() =>
                              updateQuantity(
                                selectedItem.id!,
                                inCart.quantity - 1,
                              )
                            }
                            className="w-9 h-9 rounded-lg bg-card flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                          >
                            {inCart.quantity === 1 ? (
                              <Trash2 size={14} />
                            ) : (
                              <Minus size={14} />
                            )}
                          </button>
                          <span className="font-bold text-lg">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(
                                selectedItem.id!,
                                inCart.quantity + 1,
                              )
                            }
                            className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-secondary hover:text-secondary-foreground transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (selectedItem.variants && selectedItem.variants.length > 0) {
                              setVariantModalItem(selectedItem);
                            } else {
                              addItem({
                                id: selectedItem.id!,
                                name: selectedItem.name,
                                price: selectedItem.price,
                                priceLabel: selectedItem.priceLabel,
                                image: selectedItem.image,
                              });
                            }
                          }}
                          className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2"
                        >
                          <Plus size={16} /> Add to Cart
                        </motion.button>
                      );
                    })()
                  ) : (
                    <div className="flex-1 bg-muted text-muted-foreground py-3 rounded-xl text-sm font-semibold text-center cursor-not-allowed">
                      Unavailable
                    </div>
                  )}
                  <Link
                    to={`/reviews?item=${encodeURIComponent(selectedItem.name)}`}
                    className="px-5 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Reviews
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <VariantSelectionModal
        item={variantModalItem as any}
        isOpen={!!variantModalItem}
        onClose={() => setVariantModalItem(null)}
        onAdd={handleVariantAdd as any}
      />

      <SessionBillModal
        sessionId={tableSessionId}
        isOpen={isBillOpen}
        onClose={() => setIsBillOpen(false)}
      />
    </div>
  );
}

export default function OrderPage(props: OrderPageProps) {
  return (
    <ErrorBoundary>
      <OrderPageContent {...props} />
    </ErrorBoundary>
  );
}
