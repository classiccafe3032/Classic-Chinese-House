import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, TrendingUp, DollarSign, XCircle, X, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import type { Order } from "@/lib/apiClient";

interface StatsBarProps {
  orders: Order[];
}

const StatsBar = ({ orders }: StatsBarProps) => {
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const activeOrders = orders.filter((o) =>
    ["new", "preparing", "ready"].includes(o.status)
  ).length;

  const completedOrders = orders.filter(
    (o) => o.status === "completed"
  ).length;

  const cancelledOrdersList = orders.filter(
    (o) => o.status === "cancelled"
  );
  
  const cancelledOrders = cancelledOrdersList.length;

  // ✅ SAFE MONEY CALCULATION (IN PAISE)
  const totalSalesPaise = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => {
      return sum + Math.round(o.total * 100); // convert ₹ → paise safely
    }, 0);

  // convert back to rupees
  const totalSales = totalSalesPaise / 100;

  const formattedRevenue = totalSales.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const stats = [
    {
      value: activeOrders,
      label: "Active",
      icon: ShoppingBag,
      gradient: "from-primary/10 to-primary/5",
    },
    {
      value: completedOrders,
      label: "Completed",
      icon: TrendingUp,
      gradient: "from-accent/10 to-accent/5",
    },
    {
      value: cancelledOrders,
      label: "Cancelled",
      icon: XCircle,
      gradient: "from-destructive/10 to-destructive/5",
    },
    {
      value: `₹${formattedRevenue}`,
      label: "Revenue",
      icon: DollarSign,
      gradient: "from-emerald-500/10 to-emerald-500/5",
    },
  ];

  return (
    <>
      <div className="container mx-auto px-4 pt-5 pb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors mx-auto bg-card border border-border/50 px-4 py-2 rounded-full shadow-sm hover:shadow-md"
        >
          <BarChart3 size={16} className="text-primary" />
          {isExpanded ? "Hide Statistics" : "View Daily Statistics"}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="container mx-auto px-4 pb-5 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((stat) => (
                <motion.div
                  key={stat.label}
                  onClick={stat.label === "Cancelled" ? () => setShowCancelledModal(true) : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-gradient-to-br ${stat.gradient} border border-border/50 rounded-2xl p-4 text-center ${
                    stat.label === "Cancelled" ? "cursor-pointer hover:shadow-md transition-shadow hover:border-destructive/30" : ""
                  }`}
                >
                  <stat.icon size={18} className={`mx-auto mb-1 ${stat.label === "Cancelled" ? "text-destructive/70" : "text-muted-foreground"}`} />
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancelled Orders Modal */}
      <AnimatePresence>
        {showCancelledModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border/50 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <XCircle className="text-destructive" size={20} />
                  Cancelled Orders Today
                </h2>
                <button
                  onClick={() => setShowCancelledModal(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cancelledOrdersList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <XCircle className="mx-auto mb-2 opacity-50" size={32} />
                    <p>No cancelled orders today</p>
                  </div>
                ) : (
                  cancelledOrdersList.map(order => (
                    <div key={order.id} className="bg-background border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">#{order.token}</span>
                            <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full font-bold uppercase tracking-wider">
                              Cancelled
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1">{order.customerName || "Guest"} <span className="text-muted-foreground ml-1">{order.customerPhone && order.customerPhone !== "0000000000" ? `· ${order.customerPhone}` : ""}</span></p>
                          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Total</p>
                          <p className="text-lg font-black leading-none text-primary">₹{order.total.toFixed(0)}</p>
                        </div>
                      </div>
                      
                      {order.items && order.items.length > 0 && (
                        <div className="pt-3 border-t border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Items</p>
                          <ul className="space-y-1">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="flex justify-between text-sm">
                                <span><span className="font-semibold text-muted-foreground">{item.quantity}x</span> {item.name} {item.priceLabel !== "Full" ? `(${item.priceLabel})` : ""}</span>
                                <span className="font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StatsBar;