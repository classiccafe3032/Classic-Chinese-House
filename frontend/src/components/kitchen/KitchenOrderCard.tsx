import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChefHat,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  CreditCard,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  StickyNote,
  Package,
} from "lucide-react";
import type { KitchenOrder } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";

// ── Elapsed time hook ────────────────────────────────────
function useElapsed(createdAt: string) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / 1000
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

// ── Order type config ────────────────────────────────────
const orderTypeConfig: Record<string, { label: string; icon: typeof UtensilsCrossed; className: string }> = {
  "dine-in": { label: "Dine-in", icon: UtensilsCrossed, className: "bg-primary/10 text-primary border-primary/20" },
  takeaway: { label: "Takeaway", icon: ShoppingBag, className: "bg-secondary/10 text-secondary border-secondary/20" },
  delivery: { label: "Delivery", icon: Truck, className: "bg-accent/20 text-accent-foreground border-accent/30" },
};

export default function KitchenOrderCard({
  order,
  onMarkReady,
  isMarking,
}: {
  order: KitchenOrder;
  onMarkReady: (id: string) => void;
  isMarking: boolean;
}) {
  const elapsed = useElapsed(order.createdAt);
  const elapsedMins = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / 60000
  );

  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const hasNotes = !!order.specialInstructions?.trim();
  const isUrgent = elapsedMins >= 15;
  const isWarning = elapsedMins >= 8 && !isUrgent;
  const isPriority = isUrgent || hasNotes;

  // Urgency styling
  const urgencyBorder = isUrgent
    ? "border-destructive/60 shadow-destructive/10"
    : isWarning
      ? "border-yellow-500/50 shadow-yellow-500/5"
      : "border-border/50";

  const urgencyBg = isUrgent
    ? "bg-destructive/5"
    : isWarning
      ? "bg-yellow-500/5"
      : "bg-card";

  const urgencyRing = isUrgent ? "ring-1 ring-destructive/20" : "";

  const typeConf = orderTypeConfig[order.orderType] || orderTypeConfig["dine-in"];
  const TypeIcon = typeConf.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 60 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`${urgencyBg} border-2 ${urgencyBorder} ${urgencyRing} rounded-2xl p-5 hover:shadow-xl transition-all relative overflow-hidden flex flex-col`}
    >
      {/* Priority stripe */}
      {isPriority && (
        <div className={`absolute top-0 left-0 right-0 h-1 ${isUrgent ? "bg-destructive" : "bg-yellow-500"}`} />
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Token */}
          <span className={`shrink-0 px-3 py-1.5 rounded-xl font-black text-xl ${
            isUrgent
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/10 text-primary"
          }`}>
            #{order.token}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground truncate">
              {order.customerName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge className={`text-[10px] border ${typeConf.className} font-bold gap-1`}>
            <TypeIcon size={10} />
            {typeConf.label}
          </Badge>
          <Badge
            className={`text-[10px] font-bold gap-1 ${
              order.paymentStatus === "paid"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            }`}
          >
            <CreditCard size={10} />
            {order.paymentStatus === "paid" ? "Paid" : "Pending"}
          </Badge>
        </div>
      </div>

      {/* ── Items list ─────────────────────────────────── */}
      <div className="flex-1 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Package size={13} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {totalItems} Item{totalItems !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-1 bg-muted/40 rounded-xl p-3">
          {order.items.map((item, idx) => (
            <div
              key={`${item.name}-${idx}`}
              className="flex justify-between items-center"
            >
              <span className="text-sm font-medium text-foreground">{item.name}</span>
              <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Special instructions ───────────────────────── */}
      {hasNotes && (
        <div className="mb-3 bg-accent/40 border border-accent/50 rounded-xl p-3 flex gap-2">
          <StickyNote size={14} className="text-accent-foreground shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-accent-foreground leading-relaxed">
            {order.specialInstructions}
          </p>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="border-t border-border/40 pt-3 mt-auto">
        <div className="flex items-center justify-between">
          {/* Elapsed timer */}
          <div className="flex items-center gap-2">
            {isUrgent ? (
              <AlertTriangle size={15} className="text-destructive animate-pulse" />
            ) : (
              <Clock
                size={15}
                className={isWarning ? "text-yellow-500" : "text-muted-foreground"}
              />
            )}
            <span
              className={`text-sm font-bold tabular-nums ${
                isUrgent
                  ? "text-destructive"
                  : isWarning
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              }`}
            >
              {elapsed}
            </span>
            {isUrgent && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                Urgent
              </span>
            )}
          </div>

          {/* Mark Ready */}
          <motion.button
            whileHover={{ scale: isMarking ? 1 : 1.05 }}
            whileTap={{ scale: isMarking ? 1 : 0.95 }}
            disabled={isMarking}
            onClick={() => onMarkReady(order.id)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isMarking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={16} />
                Ready
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
