import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Download, FileText, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { downloadReceipt } from "@/lib/receiptGenerator";
import { downloadInvoicePdf } from "@/lib/invoicePdfGenerator";
import type { ReceiptData } from "@/lib/receiptGenerator";
import { apiGetActiveOrdersByPhone } from "@/lib/apiClient";

interface ActiveOrder {
  id: string;
  token: number;
  customerName: string;
  customerPhone: string;
  total: number;
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  gst: number;
  gstRate: number;
  status: string;
  paymentMethod: "counter" | "online";
  paymentStatus: string;
  paidAmount: number;
  couponCode: string | null;
  createdAt: string;
  items: { name: string; price: number; priceLabel: string; quantity: number; image: string }[];
  business: { restaurantName: string; gstin: string | null; address: string };
}

const ReceiptLookup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async () => {
    if (phone.trim().length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setError("");
    setLoading(true);
    setSearched(true);
    try {
      const data = await apiGetActiveOrdersByPhone(phone.trim());
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
      setError("Unable to fetch orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const buildReceiptData = (order: ActiveOrder): ReceiptData => ({
    token: order.token,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    items: order.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    cgst: order.cgst,
    sgst: order.sgst,
    gst: order.gst,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paidAmount: order.paidAmount,
    createdAt: order.createdAt,
    business: order.business,
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const statusLabel: Record<string, string> = {
    new: "Order Placed",
    preparing: "Preparing",
    ready: "Ready for Pickup",
  };

  return (
    <div className="bg-card border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Receipt size={14} />
          <span>Download your order receipt</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pb-2 pt-2 max-w-sm mx-auto space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      inputMode="numeric"
                      maxLength={10}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-base md:text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleLookup}
                    disabled={loading || phone.length < 10}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {loading ? "..." : "Find"}
                  </button>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                {searched && !loading && orders.length === 0 && !error && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No active orders found for this number
                  </p>
                )}

                {orders.length > 0 && (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-primary">#{order.token}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                              {statusLabel[order.status] || order.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.items.length} item{order.items.length > 1 ? "s" : ""} • ₹{order.total.toFixed(2)} • {formatTime(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => downloadReceipt(buildReceiptData(order))}
                            className="p-2 rounded-lg bg-muted hover:bg-muted/70 transition text-foreground"
                            title="Download Receipt"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => downloadInvoicePdf(buildReceiptData(order))}
                            className="p-2 rounded-lg bg-muted hover:bg-muted/70 transition text-foreground"
                            title="Download Invoice"
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ReceiptLookup;
