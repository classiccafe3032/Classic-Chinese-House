import { motion, AnimatePresence } from "framer-motion";
import { X, Receipt, Clock, CreditCard, ChevronDown, ChevronUp, Plus, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { apiGetTableSessionBill, apiPlaceOrder, type SessionBill } from "@/lib/apiClient";
import { toast } from "sonner";

interface SessionBillModalProps {
  sessionId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionBillModal({ sessionId, isOpen, onClose }: SessionBillModalProps) {
  const isAuthorized = !!localStorage.getItem("admin_auth_token") || !!localStorage.getItem("staff_auth_token");
  const [bill, setBill] = useState<SessionBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<boolean>(false);
  const [repeatingIds, setRepeatingIds] = useState<Set<string | number>>(new Set());

  const handleReorder = async (item: SessionBill["itemized"][0]) => {
    if (!sessionId || !item.menuItemId) return;
    setRepeatingIds((prev) => new Set(prev).add(item.menuItemId!));
    try {
      await apiPlaceOrder(
        bill?.customerName || "Table Guest",
        bill?.customerPhone || "",
        [{ id: item.menuItemId, name: item.name, price: item.price, priceLabel: "₹"+item.price, quantity: 1, image: "" }],
        "counter",
        undefined,
        "dine-in",
        "",
        "table",
        sessionId
      );
      toast.success(`1x ${item.name} sent to kitchen!`);
      // Refresh bill data
      const data = await apiGetTableSessionBill(sessionId);
      setBill(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder");
    } finally {
      setRepeatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.menuItemId!);
        return next;
      });
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      setLoading(true);
      setError(null);
      apiGetTableSessionBill(sessionId)
        .then((data) => {
          setBill(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "Failed to load bill");
          setLoading(false);
        });
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/30 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Receipt className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg leading-tight">My Table Bill</h2>
                {bill?.tableNumber && (
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Table {bill.tableNumber}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            {loading ? (
              <div className="space-y-4 py-8 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mx-auto" />
                <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
                <div className="space-y-3 mt-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-1/4" />
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive font-semibold mb-2">Error</p>
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
            ) : bill && bill.orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Receipt size={24} className="text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-lg">No orders yet</p>
                <p className="text-muted-foreground text-sm">Items you place will appear here</p>
              </div>
            ) : bill ? (
              <>
                {/* Aggregated Items */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b pb-2">
                    Items Ordered
                  </h3>
                  <div className="space-y-3">
                    {bill.itemized.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-sm">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">x{item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">₹{item.totalPrice.toFixed(2)}</span>
                          {isAuthorized && item.menuItemId && (
                            <button
                              onClick={() => handleReorder(item)}
                              disabled={repeatingIds.has(item.menuItemId)}
                              className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors p-1 rounded-md flex items-center gap-1 text-xs font-bold"
                              title={`Order 1 more ${item.name}`}
                            >
                              {repeatingIds.has(item.menuItemId) ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Plus size={12} />
                              )}
                              1
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-batches (Orders) Toggle */}
                <div className="border border-border/50 rounded-xl overflow-hidden bg-muted/10">
                  <button
                    onClick={() => setExpandedOrders(!expandedOrders)}
                    className="w-full flex items-center justify-between p-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Clock size={16} className="text-muted-foreground" />
                      Order History ({bill.orders.length} batches)
                    </span>
                    {expandedOrders ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  
                  {expandedOrders && (
                    <div className="p-3 border-t border-border/50 space-y-4 bg-background/50">
                      {bill.orders.map((o) => (
                        <div key={o.id} className="text-xs space-y-1">
                          <div className="flex justify-between font-semibold text-muted-foreground mb-1 border-b border-border/50 pb-1">
                            <span>Token #{o.token}</span>
                            <span>{new Date((o as any).created_at || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {o.items.map((i, idx) => (
                            <div key={idx} className="flex justify-between opacity-80">
                              <span>{i.quantity}x {i.name}</span>
                              <span>₹{(i.price * i.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Footer (Total) */}
          {bill && bill.orders.length > 0 && (
            <div className="p-5 border-t border-border bg-card">
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Amount</span>
                  <span>₹{bill.totalAmount.toFixed(2)}</span>
                </div>
                {bill.totalPaid > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Amount Paid</span>
                    <span>-₹{bill.totalPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Balance Due</span>
                  <span className="text-primary">₹{bill.totalDue.toFixed(2)}</span>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all bg-primary/10 text-primary hover:bg-primary/20"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
