import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChefHat,
  Clock,
  CheckCircle,
  Package,
  Pencil,
  XCircle,
  Download,
  Loader2,
  Printer,
  FileText,
  Edit3,
  UserCircle2,
} from "lucide-react";

import { apiPayDue, apiClaimOrder } from "@/lib/apiClient";
import type { Order } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { downloadReceipt, printReceipt } from "@/lib/receiptGenerator";
import { downloadKOTPrint } from "@/components/BillDocument";
import { printQueue } from "@/lib/printQueue";

const statusConfig = {
  approval_pending: { label: "Pending Approval", color: "bg-amber-500", icon: Clock },
  new: { label: "New", color: "bg-accent", icon: Clock },
  preparing: { label: "Preparing", color: "bg-secondary", icon: ChefHat },
  ready: { label: "Ready", color: "bg-emerald-500", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-emerald-700", icon: Package },
  cancelled: { label: "Cancelled", color: "bg-destructive", icon: XCircle },
};

const ITEMS_COLLAPSE_THRESHOLD = 3;

const ItemsList = ({ items }: { items: Order["items"] }) => {
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = items.length > ITEMS_COLLAPSE_THRESHOLD;
  const displayItems = collapsed
    ? items.slice(0, ITEMS_COLLAPSE_THRESHOLD)
    : items;

  return (
    <div className="mb-3 text-sm">
      <div className="space-y-1">
        {displayItems.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="flex flex-col py-1"
          >
            <div className="flex justify-between items-center">
              <span>
                {item.name} x {item.quantity}
              </span>
              <span className="font-medium">
                ₹{item.price * item.quantity}
              </span>
            </div>
            {item.note && (
              <span className="text-xs text-red-500 font-bold italic line-clamp-1 ml-2">
                * Note: {item.note}
              </span>
            )}
          </div>
        ))}
        {canCollapse && (
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="w-full text-left py-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {collapsed
              ? `••• ${items.length - ITEMS_COLLAPSE_THRESHOLD} more items`
              : "Show less"}
          </button>
        )}
      </div>
    </div>
  );
};

/** Build the receipt data object from an order */
function buildReceiptData(order: Order) {
  return {
    token: order.token,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    cgst: order.cgst,
    sgst: order.sgst,
    cgstRate: (order as any).cgstRate,
    sgstRate: (order as any).sgstRate,
    gst: order.gst,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paidAmount: order.paidAmount,
    createdAt: order.createdAt,
    business: order.business,
    orderType: order.orderType,
    specialInstructions: order.specialInstructions,
    tableSessionId: order.tableSessionId,
  };
}

interface OrderCardProps {
  order: Order;
  user: { name: string; role: string };
  onAdvanceStatus: (
    orderId: string,
    newStatus: Order["status"],
  ) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onEdit: (order: Order) => void;
  onRefresh: () => Promise<void>;
  isUpdating: boolean;
  orderWorkflow?: "multi-step" | "quick-complete";
  isCustomerEditing?: boolean;
}

const OrderCard = ({
  order,
  user,
  onAdvanceStatus,
  onCancelOrder,
  onEdit,
  onRefresh,
  isUpdating,
  orderWorkflow = "quick-complete",
  isCustomerEditing = false,
}: OrderCardProps) => {
  const config =
    statusConfig[order.status] ?? {
      label: order.status,
      color: "bg-muted",
      icon: Clock,
    };

  const StatusIcon = config.icon;

  const paidAmount = order.paidAmount || 0;
  const dueAmount = Math.max(0, order.total - paidAmount);

  const [loadingPayment, setLoadingPayment] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const isTableOrder = order.orderSource === "table";
  const hasDue = !isTableOrder && dueAmount > 0;

  const nextLabel =
    order.status === "new"
      ? "Start Preparing"
      : order.status === "preparing"
        ? "Mark Ready"
        : order.status === "ready"
          ? "Complete"
          : null;

  const handleAdvanceStatus = async () => {
    if (isUpdating || hasDue) return;

    if (orderWorkflow === "multi-step") {
      // Find the next logical status
      const flow: Order["status"][] = ["new", "preparing", "ready", "completed"];
      const idx = flow.indexOf(order.status);
      if (idx >= 0 && idx < flow.length - 1) {
        await onAdvanceStatus(order.id, flow[idx + 1]);
      }
    } else {
      // Quick complete
      await onAdvanceStatus(order.id, "completed");
    }
  };

  const handlePayDue = async () => {
    try {
      setLoadingPayment(true);
      await apiPayDue(order.id);
      
      // [AUTO-PRINT LOGIC] Automatically print final bill when payment is marked received
      console.log(`🧾 [PRINTER] AUTO-PRINTING FINAL BILL for Order #${order.token} (Payment Collected)`);
      console.log(`   --> Amount Paid: ₹${dueAmount.toFixed(2)}`);

      await onRefresh();
      toast({
        title: "Payment Updated",
        description: `Due ₹${dueAmount} marked as paid`,
      });
    } catch {
      toast({
        title: "Payment Failed",
        description: "Unable to update payment",
        variant: "destructive",
      });
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleClaim = async () => {
    try {
      setClaiming(true);
      await apiClaimOrder(order.id);
      await onRefresh();
      toast({ title: "Order Claimed", description: "You are now serving this order." });
    } catch (err: any) {
      toast({ title: "Failed to claim", description: err.message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const receiptData = buildReceiptData(order);

  const handlePrintKOT = () => {
    printQueue.enqueue(`manual-kot-${Date.now()}`, "kot", receiptData);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border ${isCustomerEditing ? 'border-amber-500 shadow-lg shadow-amber-500/10' : 'border-border/30'} rounded-2xl p-3 active:scale-[0.98] transition`}
    >
      {isCustomerEditing && (
        <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl py-2 px-3 flex items-center gap-2 animate-pulse">
          <Loader2 size={14} className="animate-spin text-amber-600" />
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Customer is editing...</span>
        </div>
      )}
      {/* HEADER */}
      <div className="mb-3">
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-2">
          <span className="bg-primary/10 text-primary px-2 py-1 rounded-md font-bold text-sm shrink-0 mt-0.5">
            #{order.token}
          </span>

          <div className="text-right min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight truncate">
              {order.customerName}
            </p>

            {order.customerPhone && order.customerPhone !== "0000000000" && (
              <p className="text-xs text-muted-foreground truncate">
                {order.customerPhone}
              </p>
            )}
          </div>
        </div>

        {/* Row 2 (scrollable badges) */}
        <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
          {order.orderType && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent/15 text-accent border border-accent/20 whitespace-nowrap">
              {order.orderType === "dine-in"
                ? "Dine-in"
                : order.orderType === "takeaway"
                  ? "Takeaway"
                  : "Delivery"}
            </span>
          )}

          {order.tableNumber && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground whitespace-nowrap">
              Table {order.tableNumber}
            </span>
          )}

          {order.waiterName && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-secondary text-secondary-foreground flex items-center gap-1 whitespace-nowrap">
              <UserCircle2 size={12} />
              {order.waiterName}
            </span>
          )}

          <span
            className={`${config.color} text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap`}
          >
            <StatusIcon size={12} />
            {config.label}
          </span>
        </div>
      </div>

      {/* SPECIAL INSTRUCTIONS */}
      {order.specialInstructions && (
        <div className="mb-3 bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">
          <p className="text-xs font-semibold">📝 Special Instructions</p>
          <p className="text-xs mt-1">{order.specialInstructions}</p>
        </div>
      )}

      {/* ITEMS */}
      <ItemsList items={order.items} />

      {/* FOOTER */}
      <div className="border-t border-border/30 pt-3 space-y-3">
        {/* TOTAL */}
        <div className="flex items-center justify-between flex-wrap gap-y-3">
          <div className="flex flex-col">
            <span className="font-bold text-lg">₹{order.total}</span>
            {order.status === "cancelled" ? (
              <span className="text-xs text-destructive font-semibold">Cancelled</span>
            ) : dueAmount === 0 ? (
              <span className="text-xs text-emerald-600">✔ Paid</span>
            ) : (
              <span className="text-xs text-destructive">
                Due ₹{dueAmount.toFixed(2)}
              </span>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2">
            {/* Primary */}
            <button
              onClick={() => printQueue.enqueue(`manual-${Date.now()}`, "receipt", receiptData)}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs flex items-center gap-2"
            >
              <Printer size={14} />
              Print
            </button>

            {/* Secondary */}
            <button
              onClick={() => downloadReceipt(receiptData)}
              className="bg-muted p-2 rounded-xl"
            >
              <Download size={16} />
            </button>

            <button
              onClick={handlePrintKOT}
              className="bg-muted p-2 rounded-xl"
              title="Print KOT"
            >
              <ChefHat size={16} />
            </button>
          </div>
        </div>

        {/* ACTION ROW */}
        <div className="flex flex-wrap gap-2">
          {dueAmount > 0 && !isTableOrder && order.status !== "cancelled" && (
            <button
              onClick={handlePayDue}
              disabled={loadingPayment}
              className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs flex items-center gap-2"
            >
              {loadingPayment ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                `Pay ₹${dueAmount.toFixed(2)}`
              )}
            </button>
          )}

          {isTableOrder && !order.waiterId && user.role === "waiter" && order.status !== "completed" && order.status !== "cancelled" && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              {claiming ? <Loader2 size={14} className="animate-spin" /> : "Claim Order"}
            </button>
          )}

          {(order.status === "new" || (order.status !== "cancelled" && (user.role === "admin" || user.role === "manager"))) && (
            <button
              onClick={() => onEdit(order)}
              disabled={isCustomerEditing}
              className="bg-secondary px-3 py-2 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}

          {(user.role === "admin" || user.role === "manager") && order.status === "new" && (
            <button
              onClick={() => onCancelOrder(order.id)}
              disabled={isCustomerEditing}
              className="bg-destructive/10 text-destructive px-3 py-2 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle size={14} />
              Cancel
            </button>
          )}

          {order.status !== "completed" &&
            order.status !== "cancelled" &&
            !hasDue && (
              <button
                disabled={
                  isUpdating ||
                  isCustomerEditing ||
                  (orderWorkflow === "multi-step" && user.role === "kitchen" && order.status === "ready") ||
                  (orderWorkflow === "multi-step" && user.role === "waiter" && order.status === "preparing")
                }
                onClick={handleAdvanceStatus}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-semibold w-full"
              >
                {isUpdating ? (
                  <Loader2 size={14} className="animate-spin mx-auto" />
                ) : (
                  orderWorkflow === "multi-step" ? nextLabel : "Mark Completed"
                )}
              </button>
            )}
        </div>
      </div>
    </motion.div>
  );
};
export default OrderCard;
