import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  CheckCircle2,
  Lock,
  Loader2,
  Clock,
  Maximize,
  Minimize,
  AlertTriangle,
  LogOut,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  apiAdminCheckAuth,
  apiAdminLogout,
  apiKitchenGetOrders,
  apiKitchenMarkReady,
  apiKitchenMarkItemReady,
  setTenantSlug as setGlobalTenantSlug,
  type KitchenOrder,
} from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import BackgroundOrbs from "@/components/BackgroundOrbs";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import NotFound from "./NotFound";

const kitchenOrbs = [
  {
    size: "w-[400px] h-[400px]",
    blur: "blur-[100px]",
    opacity: "opacity-15",
    color: "bg-primary/30",
    position: { top: "5%", right: "-5%" } as React.CSSProperties,
  },
  {
    size: "w-[350px] h-[350px]",
    blur: "blur-[100px]",
    opacity: "opacity-10",
    color: "bg-secondary/30",
    position: {
      bottom: "10%",
      left: "-5%",
      animationDelay: "3s",
    } as React.CSSProperties,
  },
];

// Removed redundant PinGate component. Kitchen auth now relies strictly on 
// staff_auth_token issued during standard dashboard login.

// ── Elapsed time helper ──────────────────────────────────
function useElapsed(createdAt: string) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / 1000,
      );
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return elapsed;
}

// ── Single kitchen order card ────────────────────────────
function KitchenOrderCard({
  order,
  onMarkReady,
  onMarkItemReady,
  isMarking,
  markingItemId,
}: {
  order: KitchenOrder;
  onMarkReady: (id: string) => void;
  onMarkItemReady: (orderId: string, itemId: string) => void;
  isMarking: boolean;
  markingItemId: string | null;
}) {
  const elapsed = useElapsed(order.createdAt);
  const elapsedMins = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / 60000,
  );

  // Feature 3: Urgency tiers — green < 5min, amber 5-10min, red 10+min
  const isOverdue = elapsedMins >= 10;
  const isWarning = elapsedMins >= 5 && !isOverdue;

  const urgencyBorder = isOverdue
    ? "border-destructive/60"
    : isWarning
      ? "border-amber-500/50"
      : "border-border/50";

  const urgencyBg = isOverdue
    ? "bg-destructive/5"
    : isWarning
      ? "bg-amber-500/5"
      : "bg-card";

  const urgencyTimeColor = isOverdue
    ? "text-destructive font-bold"
    : isWarning
      ? "text-amber-500 font-semibold"
      : "text-muted-foreground";

  const urgencyLabel = isOverdue
    ? "URGENT"
    : isWarning
      ? "Getting slow"
      : "On time";

  const urgencyLabelColor = isOverdue
    ? "text-destructive"
    : isWarning
      ? "text-amber-500"
      : "text-emerald-500";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`${urgencyBg} border-2 ${urgencyBorder} rounded-2xl p-4 hover:shadow-xl transition-all relative overflow-hidden ${isOverdue ? 'animate-pulse' : ''}`}
    >
      {/* Feature 3: Floating OVERDUE badge for 10+ min orders */}
      {isOverdue && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-destructive text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg">
          <AlertTriangle size={10} />
          OVERDUE
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary px-2 py-1 rounded-md font-bold text-lg">
            #{order.token}
          </span>

          <div>
            <p className="font-semibold text-sm text-foreground">
              {order.customerName}
            </p>

            {order.orderType && (
              <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-semibold capitalize">
                {order.orderType}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <span className="bg-secondary text-zinc-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <ChefHat size={12} />
          Preparing
        </span>
      </div>

      {order.specialInstructions && (
        <div className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          <p className="text-[11px] text-blue-600 font-semibold mb-0.5 flex items-center gap-1">
            📝 Special Instructions
          </p>
          <p className="text-sm font-medium text-foreground">
            {order.specialInstructions}
          </p>
        </div>
      )}

      {/* Items list */}
      <div className="mb-3 text-sm">
        <div className="space-y-2">
          {order.items.map((item, idx) => {
            const isReady = item.status === "ready";
            const isItemMarking = markingItemId === item.id;
            return (
              <div
                key={`${item.name}-${idx}`}
                className={`flex justify-between items-center py-2 px-3 rounded-lg border transition-all ${
                  isReady 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700/70 line-through" 
                    : "bg-background border-border text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => !isReady && onMarkItemReady(order.id, item.id)}
                    disabled={isReady || isItemMarking}
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      isReady ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 hover:border-emerald-500/50"
                    }`}
                  >
                    {isItemMarking ? (
                      <Loader2 size={12} className="animate-spin text-muted-foreground" />
                    ) : isReady ? (
                      <CheckCircle2 size={14} />
                    ) : null}
                  </button>
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.name}</span>
                    {item.note && (
                      <span className="text-[10px] text-amber-600 font-bold italic block mt-0.5">
                        * Note: {item.note}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-black text-lg">
                  x{item.quantity}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 pt-3">
        <div className="flex items-center justify-between">
          {/* Feature 3: Elapsed time with urgency label */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Clock
                size={14}
                className={isOverdue ? "text-destructive" : isWarning ? "text-amber-500" : "text-muted-foreground"}
              />
              <span className={`text-sm ${urgencyTimeColor}`}>
                {elapsed}
              </span>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${urgencyLabelColor}`}>
              {urgencyLabel}
            </span>
          </div>

          {/* Mark Ready button */}
          <motion.button
            whileHover={{ scale: isMarking ? 1 : 1.05 }}
            whileTap={{ scale: isMarking ? 1 : 0.95 }}
            disabled={isMarking}
            onClick={() => onMarkReady(order.id)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isMarking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={16} />
                Mark Ready
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}


// ── Main Kitchen Display ─────────────────────────────────
function KitchenDashboard({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingItemId, setMarkingItemId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("kitchen_sound_muted") !== "false";
  });

  useEffect(() => {
    localStorage.setItem("kitchen_sound_muted", isMuted.toString());
  }, [isMuted]);
  const { toast } = useToast();

  // Sound alert refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const { settings: businessSettings } = useBusinessSettings();

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiKitchenGetOrders();
      setOrders(data);
    } catch (err) {
      console.error("Kitchen fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const handleNewOrder = () => {
      fetchOrders();
      if (!isMuted) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio("/alert.wav");
            audioRef.current.volume = 0.8;
          }
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        } catch {}
      }
    };

    socket.on("new-order", handleNewOrder);
    socket.on("order-updated", fetchOrders);

    return () => {
      socket.off("new-order", handleNewOrder);
      socket.off("order-updated", fetchOrders);
    };
  }, [fetchOrders, isMuted]);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);



  const handleMarkReady = async (orderId: string) => {
    setMarkingId(orderId);
    try {
      await apiKitchenMarkReady(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast({ title: "Order Ready", description: "Order marked as ready!" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark order as ready",
        variant: "destructive",
      });
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkItemReady = async (orderId: string, itemId: string) => {
    setMarkingItemId(itemId);
    try {
      await apiKitchenMarkItemReady(itemId);
      setOrders((prev) => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            items: o.items.map(i => i.id === itemId ? { ...i, status: "ready" } : i)
          };
        }
        return o;
      }));
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark item as ready",
        variant: "destructive",
      });
    } finally {
      setMarkingItemId(null);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);


  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-6 py-8">
      <BackgroundOrbs orbs={kitchenOrbs} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header — same style as TokenDisplay */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10"
        >
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-primary">{businessSettings?.restaurantName.split(" ")[0]}</span>{" "}
              <span className="text-secondary">Kitchen</span>
            </h1>

            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <p className="text-sm text-muted-foreground">
                {isConnected ? "Live" : "Disconnected"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Order count badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/15 border border-secondary/25">
              <ChefHat size={18} className="text-secondary" />
              <span className="text-sm font-semibold text-foreground">
                {orders.length} Preparing
              </span>
            </div>

            {/* Audio Toggle Toggle */}
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                // Preload and grant browser permission immediately on first click
                if (isMuted) {
                  if (!audioRef.current) audioRef.current = new Audio("/alert.wav");
                  audioRef.current.load();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition ${
                isMuted 
                  ? "bg-card border-border text-muted-foreground hover:bg-muted" 
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20"
              }`}
              title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              <span className="text-sm font-semibold hidden sm:inline">
                {isMuted ? "Alerts Off" : "Alerts On"}
              </span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition"
            >
              {isFullscreen ? (
                <Minimize size={18} className="text-muted-foreground" />
              ) : (
                <Maximize size={18} className="text-muted-foreground" />
              )}
              <span className="text-sm font-semibold text-foreground">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition shadow-sm"
              title="Logout"
            >
              <LogOut size={18} />
              <span className="text-sm font-semibold hidden sm:inline">Logout</span>
            </button>
          </div>
        </motion.div>

        {/* Orders grid */}
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl py-20 text-center shadow-sm"
          >
            <ChefHat
              size={48}
              className="text-muted-foreground/30 mx-auto mb-4"
            />
            <p className="text-lg font-semibold text-muted-foreground">
              No orders being prepared
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Orders will appear here when admin starts preparing
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {orders.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onMarkReady={handleMarkReady}
                  onMarkItemReady={handleMarkItemReady}
                  isMarking={markingId === order.id}
                  markingItemId={markingItemId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root without PIN gate ──────────────────────────────────
const KitchenDisplay = () => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const { settings: businessSettings, loading: settingsLoading } = useBusinessSettings();

  useEffect(() => {
    // Check global admin/staff auth
    apiAdminCheckAuth().then((res) => {
      if (
        res.authenticated &&
        res.user &&
        (res.user.role === "admin" ||
          res.user.role === "manager" ||
          res.user.role === "kitchen")
      ) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        // Let the user know or redirect them
        window.location.href = "/dashboard";
      }
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    try {
      await apiAdminLogout();
      setAuthorized(false);
      window.location.href = "/dashboard";

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(console.error);
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse font-medium">Entering Kitchen...</p>
        </div>
      </div>
    );
  }

  if (!businessSettings) {
    return <NotFound />;
  }

  if (!authorized) return null;

  return <KitchenDashboard onLogout={handleLogout} />;
};

export default KitchenDisplay;
