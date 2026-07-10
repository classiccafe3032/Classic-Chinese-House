import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
} from "date-fns";
import {
  History,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar as CalendarIcon,
  SortAsc,
  SortDesc,
  X,
  Trash2,
  FileDown,
  Loader2,
  Printer,
  FileText,
} from "lucide-react";
import { apiGetAllOrders, apiDeleteOrder, type Order } from "@/lib/apiClient";
import { downloadReceipt, type ReceiptData } from "@/lib/receiptGenerator";
import { printQueue } from "@/lib/printQueue";
import { downloadInvoicePdf } from "@/lib/invoicePdfGenerator";
import { toast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type SortField = "date" | "total" | "token";
type SortDir = "asc" | "desc";
type DatePreset =
  | "today"
  | "this-week"
  | "this-month"
  | "last-month"
  | "custom"
  | "all";
const PAGE_SIZE = 20;

const presetLabels: Record<DatePreset, string> = {
  all: "All Time",
  today: "Today",
  "this-week": "This Week",
  "this-month": "This Month",
  "last-month": "Last Month",
  custom: "Custom Range",
};

const statusColors: Record<string, string> = {
  new: "bg-accent text-accent-foreground",
  preparing: "bg-secondary text-secondary-foreground",
  ready: "bg-emerald-500/15 text-emerald-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-destructive/15 text-destructive",
};

const OrderHistory = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("this-month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<Order["status"] | "all">(
    "all",
  );
  const [paymentFilter, setPaymentFilter] = useState<
    "all" | "paid" | "pending"
  >("all");
  const [methodFilter, setMethodFilter] = useState<
    "all" | "counter" | "online"
  >("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<
    "all" | "dine-in" | "takeaway" | "delivery"
  >("all");
  const [orderSourceFilter, setOrderSourceFilter] = useState<
    "all" | "counter" | "table"
  >("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(() => {
    setLoading(true);
    apiGetAllOrders()
      .then(setOrders)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let result = [...orders];

    // Date filtering
    if (datePreset !== "all") {
      let start: Date;
      let end: Date;

      if (datePreset === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
      } else if (datePreset === "this-week") {
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
      } else if (datePreset === "this-month") {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else if (datePreset === "last-month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
      } else if (datePreset === "custom" && customFrom && customTo) {
        start = customFrom;
        end = new Date(
          customTo.getFullYear(),
          customTo.getMonth(),
          customTo.getDate(),
          23,
          59,
          59,
        );
      } else {
        start = new Date(0);
        end = now;
      }

      result = result.filter((o) => {
        const d = parseISO(o.createdAt);
        return isWithinInterval(d, { start, end });
      });
    }

    // Status
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    // Payment status
    if (paymentFilter !== "all") {
      result = result.filter((o) => o.paymentStatus === paymentFilter);
    }

    // Payment method
    if (methodFilter !== "all") {
      result = result.filter((o) => o.paymentMethod === methodFilter);
    }

    // Order type
    if (orderTypeFilter !== "all") {
      result = result.filter((o) => (o.orderType || "dine-in") === orderTypeFilter);
    }

    // Order source
    if (orderSourceFilter !== "all") {
      result = result.filter((o) => (o.orderSource || "counter") === orderSourceFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          String(o.token).includes(q),
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date")
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === "total") cmp = a.total - b.total;
      else if (sortField === "token") cmp = a.token - b.token;
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [
    orders,
    datePreset,
    customFrom,
    customTo,
    statusFilter,
    paymentFilter,
    methodFilter,
    orderTypeFilter,
    orderSourceFilter,
    searchQuery,
    sortField,
    sortDir,
  ]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    datePreset,
    customFrom,
    customTo,
    statusFilter,
    paymentFilter,
    methodFilter,
    orderTypeFilter,
    orderSourceFilter,
    sortField,
    sortDir,
  ]);

  const groupedOrders = useMemo(() => {
    // Only group if we are specifically viewing Table History
    if (orderSourceFilter !== "table") return filteredOrders;

    const groups: Record<string, Order> = {};
    filteredOrders.forEach((o) => {
      // If it doesn't have a session, just keep it separate (fallback)
      if (!o.tableSessionId) {
        groups[o.id] = { ...o };
        return;
      }

      if (!groups[o.tableSessionId]) {
        groups[o.tableSessionId] = { ...o, items: [...o.items.map(i => ({ ...i }))] };
      } else {
        const g = groups[o.tableSessionId];
        g.total += o.total;
        g.subtotal += o.subtotal;
        g.cgst += o.cgst;
        g.sgst += o.sgst;
        g.gst += o.gst;
        g.discount += o.discount;
        g.paidAmount = (g.paidAmount || 0) + (o.paidAmount || 0);

        // Merge items
        o.items.forEach((item) => {
          const existing = g.items.find((i) => i.name === item.name);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            g.items.push({ ...item });
          }
        });
      }
    });

    // Re-apply sort because Object.values might not preserve it perfectly, though fields are mostly dates
    const result = Object.values(groups);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date")
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === "total") cmp = a.total - b.total;
      else if (sortField === "token") cmp = a.token - b.token;
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [filteredOrders, orderSourceFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(groupedOrders.length / PAGE_SIZE));
  const paginatedOrders = groupedOrders.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const totalRevenue = groupedOrders.reduce((sum, o) => sum + o.total, 0);
  const paidRevenue = groupedOrders.reduce(
    (sum, o) => sum + (o.paidAmount || 0),
    0,
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = sortDir === "desc" ? SortDesc : SortAsc;

  const handleDeleteOrder = async (orderId: string) => {
    setDeletingId(orderId);
    try {
      await apiDeleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast({
        title: "Order Deleted",
        description: "Order removed from history",
      });
    } catch {
      toast({
        title: "Delete Failed",
        description: "Unable to delete order",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Token/Table",
      "Customer",
      "Phone",
      "Items",
      "Total",
      "Payment Method",
      "Payment Status",
      "Order Source",
      "Order Type",
      "Status",
      "Date",
    ];
    const rows = groupedOrders.map((o) => [
      o.tableNumber ? `Table ${o.tableNumber}` : o.token,
      o.customerName,
      o.customerPhone,
      o.items.map((i) => `${i.name} x${i.quantity}`).join("; "),
      o.total,
      o.paymentMethod,
      o.paymentStatus,
      o.orderSource || "counter",
      o.orderType || "dine-in",
      o.status,
      new Date(o.createdAt).toLocaleString("en-IN"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Exported",
      description: `${filteredOrders.length} orders exported as CSV`,
    });
  };
  const OrderItemsList = ({ items }: { items: Order["items"] }) => {
    const [collapsed, setCollapsed] = useState(true);
    const ITEMS_COLLAPSE_THRESHOLD = 3;

    const canCollapse = items.length > ITEMS_COLLAPSE_THRESHOLD;

    const displayItems = collapsed
      ? items.slice(0, ITEMS_COLLAPSE_THRESHOLD)
      : items;

    return (
      <div className="mb-2 text-sm">
        <div className="space-y-1">
          {displayItems.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex justify-between items-center"
            >
              <span className="text-muted-foreground">
                {item.name} x{item.quantity}
              </span>
            </div>
          ))}
        </div>

        {canCollapse && (
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {collapsed
              ? `••• ${items.length - ITEMS_COLLAPSE_THRESHOLD} more`
              : "Show less"}
          </button>
        )}
      </div>
    );
  };
  return (
    <div className="container mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <History size={20} className="text-primary" /> Order History
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={groupedOrders.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-foreground/70 hover:bg-muted disabled:opacity-50 transition-all"
          >
            <FileDown size={14} /> CSV
          </button>

          {/* Orders Count */}
          {/* <span className="text-sm text-muted-foreground">
            {filteredOrders.length} orders
          </span> */}

          {/* Revenue */}
          {/* <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-sm tabular-nums">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </span> */}
        </div>
      </div>
      {/* Search + filter toggle */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or token..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "px-3 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-1.5 transition-all",
            showFilters
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border text-foreground hover:bg-muted",
          )}
        >
          <Filter size={14} />
          Filters
          <ChevronDown
            size={12}
            className={cn("transition-transform", showFilters && "rotate-180")}
          />
        </button>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              {/* Date presets */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Date Range
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(presetLabels) as DatePreset[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setDatePreset(p)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        datePreset === p
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {presetLabels[p]}
                    </button>
                  ))}
                </div>
                {datePreset === "custom" && (
                  <div className="flex gap-3 mt-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-sm">
                          <CalendarIcon size={14} />
                          {customFrom
                            ? format(customFrom, "dd MMM yyyy")
                            : "From"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customFrom}
                          onSelect={setCustomFrom}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-sm">
                          <CalendarIcon size={14} />
                          {customTo ? format(customTo, "dd MMM yyyy") : "To"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customTo}
                          onSelect={setCustomTo}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Status + Payment */}
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Status
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(
                      [
                        "all",
                        // "new",
                        // "preparing",
                        // "ready",
                        "completed",
                        "cancelled",
                      ] as const
                    ).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                          statusFilter === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {s === "all"
                          ? "All"
                          : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Payment
                  </p>
                  <div className="flex gap-1.5">
                    {(["all", "paid", "pending"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPaymentFilter(p)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                          paymentFilter === p
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p === "all"
                          ? "All"
                          : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider pt-4">
                      Method
                    </p>
                    <div className="flex gap-1.5">
                      {(["all", "counter", "online"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMethodFilter(m)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                            methodFilter === m
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {m === "all"
                            ? "All"
                            : m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider pt-4">
                      Order Type
                    </p>
                    <div className="flex gap-1.5">
                      {(["all", "dine-in", "takeaway", "delivery"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setOrderTypeFilter(t)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                            orderTypeFilter === t
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {t === "all" ? "All" : t === "dine-in" ? "Dine-in" : t === "takeaway" ? "Takeaway" : "Delivery"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider pt-4">
                      Order Source
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {(["all", "counter", "table"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setOrderSourceFilter(s)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                            orderSourceFilter === s
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {s === "all" ? "All Sources" : s === "counter" ? "Counter" : "Table"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sort */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Sort By
                </p>
                <div className="flex gap-1.5">
                  {(
                    [
                      { key: "date", label: "Date" },
                      { key: "total", label: "Amount" },
                      { key: "token", label: "Token" },
                    ] as { key: SortField; label: string }[]
                  ).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggleSort(s.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                        sortField === s.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.label}
                      {sortField === s.key && <SortIcon size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[16px] text-muted-foreground">{orderSourceFilter === "table" ? "Sessions" : "Orders"}</p>
          <p className="text-xl font-bold">{groupedOrders.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[16px] text-muted-foreground">Revenue</p>
          <p className="text-xl font-bold">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[16px] text-muted-foreground">Collected</p>
          <p className="text-xl font-bold text-emerald-600">
            ₹{paidRevenue.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
          />
        </div>
      ) : groupedOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={36} className="text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">No orders found</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Try adjusting your filters
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {paginatedOrders.map((order, i) => {
            const paidAmt = order.paidAmount || 0;
            const due = Math.max(0, order.total - paidAmt);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-card border border-border/50 rounded-2xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-xl font-bold text-primary">
                      {orderSourceFilter === "table" && order.tableNumber ? `Table ${order.tableNumber}` : `#${order.token}`}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">
                        {order.customerName}
                      </p>
                      {order.customerPhone && order.customerPhone !== "0000000000" && (
                        <p className="text-xs text-muted-foreground">
                          {order.customerPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        statusColors[order.status] ||
                        "bg-muted text-muted-foreground",
                      )}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </span>
                    <button
                      onClick={() => {
                        const rd: ReceiptData = {
                          token: order.token,
                          customerName: order.customerName,
                          customerPhone: order.customerPhone,
                          items: order.items,
                          subtotal: order.subtotal,
                          discount: order.discount,
                          couponCode: order.couponCode,
                          cgst: order.cgst,
                          sgst: order.sgst,
                          gst: order.gst,
                          total: order.total,
                          paymentMethod: order.paymentMethod,
                          paidAmount: order.paidAmount,
                          createdAt: order.createdAt,
                          business: order.business,
                          orderType: order.orderType,
                          specialInstructions: order.specialInstructions,
                        };
                        printQueue.enqueue(`manual-${Date.now()}`, "receipt", rd);
                      }}
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors"
                      title="Print Receipt"
                    >
                      <Printer size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() =>
                        downloadReceipt({
                          token: order.token,
                          customerName: order.customerName,
                          customerPhone: order.customerPhone,
                          items: order.items,
                          subtotal: order.subtotal,
                          discount: order.discount,
                          couponCode: order.couponCode,
                          cgst: order.cgst,
                          sgst: order.sgst,
                          gst: order.gst,
                          total: order.total,
                          paymentMethod: order.paymentMethod,
                          paidAmount: order.paidAmount,
                          createdAt: order.createdAt,
                          business: order.business,
                          orderType: order.orderType,
                          specialInstructions: order.specialInstructions,
                        })
                      }
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors"
                      title="Download Receipt"
                    >
                      <Download size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() =>
                        downloadInvoicePdf({
                          token: order.token,
                          customerName: order.customerName,
                          customerPhone: order.customerPhone,
                          items: order.items,
                          subtotal: order.subtotal,
                          discount: order.discount,
                          couponCode: order.couponCode,
                          cgst: order.cgst,
                          sgst: order.sgst,
                          gst: order.gst,
                          total: order.total,
                          paymentMethod: order.paymentMethod,
                          paidAmount: order.paidAmount,
                          createdAt: order.createdAt,
                          business: order.business,
                          orderType: order.orderType,
                          specialInstructions: order.specialInstructions,
                        })
                      }
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors"
                      title="Download PDF Invoice"
                    >
                      <FileText size={14} className="text-muted-foreground" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
                          title="Delete Order"
                          disabled={deletingId === order.id}
                        >
                          {deletingId === order.id ? (
                            <Loader2
                              size={14}
                              className="text-destructive animate-spin"
                            />
                          ) : (
                            <Trash2 size={14} className="text-destructive" />
                          )}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Order #{order.token}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this order from
                            history. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteOrder(order.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {order.orderType && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent border border-accent/20">
                      {order.orderType === "dine-in" ? "Dine-in" : order.orderType === "takeaway" ? "Takeaway" : "Delivery"}
                    </span>
                  )}
                </div>

                {order.specialInstructions && (
                  <div className="mb-2 bg-accent/10 border border-accent/20 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground">📝 {order.specialInstructions}</p>
                  </div>
                )}

                <OrderItemsList items={order.items} />

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-bold">₹{order.total.toFixed(2)}</span>
                    {due === 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                        Paid
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                        Due ₹{due}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {order.paymentMethod === "counter" ? "Counter" : "Online"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredOrders.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6 px-1">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, filteredOrders.length)} of{" "}
            {filteredOrders.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-card border border-border hover:bg-muted disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
              )
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`e-${idx}`}
                    className="px-1 text-muted-foreground text-xs"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "min-w-[32px] h-8 rounded-lg text-xs font-semibold transition-all",
                      page === p
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-card border border-border text-foreground hover:bg-muted",
                    )}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-card border border-border hover:bg-muted disabled:opacity-40 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
