import { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socket";
import { apiAdminGetTables, apiAdminCreateTable, apiSessionClose, apiGetSessionBill, apiGetBusinessSettings, apiDeleteTable, apiPlaceOrder, type Table, type Order, type SessionBill, type AuthUser, type TableHistoryOrder } from "@/lib/apiClient";
import OrderCard from "./OrderCard";
import BillDocument, { downloadBillPrint, downloadKOTPrint } from "@/components/BillDocument";
import { printQueue } from "@/lib/printQueue";
import { Capacitor } from "@capacitor/core";
import { Loader2, CheckCircle, UtensilsCrossed, Clock, QrCode, Plus, X, Printer, Download, Trash2, RefreshCw, MoreVertical, ArrowLeftRight, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import TableOpenModal from "./TableOpenModal";
import TableOrderModal from "./TableOrderModal";
import TableTransferModal from "./TableTransferModal";
import SettledBillsModal from "./SettledBillsModal";

interface TableManagerProps {
  orders: Order[];
  user: AuthUser;
  onRefresh: () => Promise<void>;
  onAdvanceStatus: (orderId: string, newStatus: Order["status"]) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  orderWorkflow?: "multi-step" | "quick-complete";
  isUpdating: Record<string, boolean>;
  editingOrderIds: Set<string>;
}

export default function TableManager({ orders, user, onRefresh, onAdvanceStatus, onCancelOrder, orderWorkflow, isUpdating, editingOrderIds }: TableManagerProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };


  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [addingTable, setAddingTable] = useState(false);
  const [showSettledBills, setShowSettledBills] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitUpi, setSplitUpi] = useState<string>("");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [billsMap, setBillsMap] = useState<Record<string, SessionBill>>({}); // sessionId -> bill

  // Loyalty State
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);
  const [loyaltySettings, setLoyaltySettings] = useState<{ enabled: boolean; points_per_100: number; discount_per_point: number } | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null); // For admin detail modal
  const [business, setBusiness] = useState<any>(null);
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);

  const [openTableState, setOpenTableState] = useState<{ id: string, number: string } | null>(null);
  const [orderTableState, setOrderTableState] = useState<{ sessionId: string, number: string, customerName?: string, customerPhone?: string } | null>(null);
  const [transferTableState, setTransferTableState] = useState<{ sessionId: string, number: string } | null>(null);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const [repeatingIds, setRepeatingIds] = useState<Set<string | number>>(new Set());

  const handleReorder = async (item: SessionBill["itemized"][0], sessionId: string, customerName?: string, customerPhone?: string) => {
    if (!sessionId || !item.menuItemId) return;
    setRepeatingIds((prev) => new Set(prev).add(item.menuItemId!));
    try {
      await apiPlaceOrder(
        customerName || "Table Guest",
        customerPhone || "",
        [{ id: item.menuItemId, name: item.name, price: item.price, priceLabel: "₹" + item.price, quantity: 1, image: "" }],
        "counter",
        undefined,
        "dine-in",
        "",
        "table",
        sessionId
      );
      toast({ title: `1x ${item.name} sent to kitchen!` });
      const newBill = await apiGetSessionBill(sessionId);
      setBillsMap(prev => ({ ...prev, [sessionId]: newBill }));
    } catch (err: any) {
      toast({ title: "Failed to reorder", description: err.message, variant: "destructive" });
    } finally {
      setRepeatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.menuItemId!);
        return next;
      });
    }
  };

  const fetchTables = useCallback(async () => {
    try {
      const data = await apiAdminGetTables();
      setTables(data);
      // Fetch bills for tables with active sessions (occupied / billing)
      const billFetches = data
        .filter(t => t.activeSession && (t.status === 'occupied' || t.activeSession.status === 'billing'))
        .map(async t => {
          try {
            const b = await apiGetSessionBill(t.activeSession!.id);
            return { sessionId: t.activeSession!.id, bill: b };
          } catch { return null; }
        });
      const results = await Promise.all(billFetches);
      const map: Record<string, SessionBill> = {};
      results.forEach(r => { if (r) map[r.sessionId] = r.bill; });
      setBillsMap(map);
    } catch (err: any) {
      toast({ title: "Failed to fetch tables", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 15000); // reduced polling frequency since we have sockets
    
    socket.on("tables-updated", fetchTables);
    
    return () => {
      clearInterval(interval);
      socket.off("tables-updated", fetchTables);
    };
  }, [fetchTables]);

  useEffect(() => {
    apiGetBusinessSettings().then(setBusiness).catch(() => { });
  }, []);

  useEffect(() => {
    if (loyaltyPhone.length === 10) {
      setCheckingLoyalty(true);
      fetch(`${import.meta.env.VITE_API_URL || ""}/customers/loyalty/${loyaltyPhone}`, {
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
      setLoyaltySettings(null);
    }
  }, [loyaltyPhone]);







  const handleCloseSession = async (sessionId: string, method: string) => {
    setClosingId(sessionId);
    try {
      await apiSessionClose(sessionId, method, parseFloat(splitCash) || 0, parseFloat(splitUpi) || 0, loyaltyPhone || undefined, pointsRedeemed);
      
      // [AUTO-PRINT LOGIC] Print Final Bill after clearing the table
      const bill = billsMap[sessionId];
      const detailSession = tables.find((t) => t.activeSession?.id === sessionId)?.activeSession;
      if (bill && bill.totalAmount > 0 && detailSession) {
        console.log(`🧾 [PRINTER] AUTO-PRINTING FINAL TABLE BILL for Ref #${sessionId.slice(0, 8)}`);
        const rd = {
          token: parseInt(detailSession.id.slice(0, 4), 16) || 0,
          customerName: detailSession.customerName || "Table Guest",
          customerPhone: detailSession.customerPhone || "",
          items: bill.itemized?.map((i: SessionBill["itemized"][0]) => ({
            id: String(i.menuItemId || i.name || Date.now()),
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            priceLabel: `₹${i.price}`,
            note: ""
          })) || [],
          total: bill.totalAmount,
          paymentMethod: (method === "cash" || method === "upi" || method === "card" || method === "split" ? "counter" : "online") as "counter" | "online",
          createdAt: new Date().toISOString(),
          orderType: "dine-in" as const,
          paymentStatus: "paid" as const,
          tableSessionId: detailSession.id,
          subtotal: bill.sessionDetails?.subtotal || 0,
          discount: bill.sessionDetails?.discount || 0,
          cgst: bill.sessionDetails?.cgst || 0,
          sgst: bill.sessionDetails?.sgst || 0,
          gst: bill.sessionDetails?.gstTotal || 0,
          paidAmount: bill.totalAmount,
        };
        printQueue.enqueue(`auto-receipt-${Date.now()}`, "receipt", rd);
      }

      await fetchTables();
      await onRefresh();
      toast({ title: method === 'none' ? "Table cleared (No Bill)" : `Table cleared (${method.toUpperCase()})` });
      setSelectedTable(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to free table", description: errorMsg, variant: "destructive" });
    } finally {
      setClosingId(null);
      setShowPaymentModal(null);
      setSplitMode(false);
      setSplitCash("");
      setSplitUpi("");
      setLoyaltyPhone("");
      setPointsRedeemed(0);
      setLoyaltyPoints(0);
    }
  };

  const handleClearTableClick = (sessionId: string, customerPhone?: string | null) => {
    const bill = billsMap[sessionId];
    if (bill && bill.totalAmount === 0) {
      handleCloseSession(sessionId, 'none');
    } else {
      setShowPaymentModal(sessionId);
      if (customerPhone && customerPhone !== "0000000000") {
        setLoyaltyPhone(customerPhone);
      } else {
        setLoyaltyPhone("");
      }
    }
  };


  const handleModalSuccess = () => {
    fetchTables();
    onRefresh();
  };

  return (
    <div className="container mx-auto px-4 pb-8 py-2">
      {/* Table Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="text-primary" /> Live Table Status
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettledBills(true)}
              className="px-3 py-1.5 bg-muted/50 hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileText size={14} /> Settled Bills
            </button>
            <button onClick={handleManualRefresh} disabled={isRefreshing} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors" title="Refresh Tables">
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin w-8 h-8 text-primary" />
          </div>
        ) : tables.length === 0 ? (
          <div className="text-center p-16 bg-card border-2 border-dashed border-border rounded-xl text-muted-foreground flex flex-col items-center gap-3">
             <UtensilsCrossed size={32} className="opacity-30" />
             <p className="font-medium text-lg">No tables found</p>
             <p className="text-sm">You haven't added any tables yet. Go to the System tab to set up your floor plan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {tables.map(table => {
              const session = table.activeSession;
              const isTableEditing = session && orders.some(o =>
                (o.tableSessionId === session.id || (o as any).table_session_id === session.id) &&
                editingOrderIds.has(o.id)
              );

              let elapsedString = "";
              if (session?.startTime) {
                const elapsedMs = now - new Date(session.startTime).getTime();
                const totalSecs = Math.max(0, Math.floor(elapsedMs / 1000));
                const h = Math.floor(totalSecs / 3600);
                const m = Math.floor((totalSecs % 3600) / 60);
                const s = totalSecs % 60;

                if (h > 0) {
                  elapsedString = `${h}h ${m}m ${s}s`;
                } else {
                  elapsedString = `${m}m ${s}s`;
                }
              }

              return (
                <motion.div
                  layout
                  key={table.id}
                  className={`relative p-5 rounded-2xl border flex flex-col transition-all ${isTableEditing ? 'border-amber-500 shadow-lg shadow-amber-500/20 bg-amber-500/5' :
                    table.status === 'occupied' ? 'bg-primary/5 border-primary/30 shadow-md' :
                      table.status === 'reserved' ? 'bg-amber-500/5 border-amber-500/30 shadow-md' :
                        'bg-card border-border hover:shadow-lg'
                    }`}
                >
                  {isTableEditing && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg animate-bounce flex items-center gap-1 z-10 whitespace-nowrap">
                      <Loader2 size={10} className="animate-spin" />
                      CUSTOMER EDITING
                    </div>
                  )}

                  {/* 3 Dot Menu at Absolute Top Right */}
                  {session && (
                    <div className="absolute top-4 right-4 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1 hover:bg-muted rounded-md transition text-muted-foreground outline-none">
                          <MoreVertical size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          {(user.role === 'admin' || user.permissions?.canTransferTable) && (
                            <DropdownMenuItem
                              onClick={() => setTransferTableState({ sessionId: session.id, number: table.tableNumber })}
                              className="gap-2 cursor-pointer"
                            >
                              <ArrowLeftRight size={14} className="text-muted-foreground" />
                              <span>Transfer Table</span>
                            </DropdownMenuItem>
                          )}
                          {(user.role === 'admin' || user.permissions?.canClearTable) && (
                            <DropdownMenuItem
                              onClick={() => handleClearTableClick(session.id, session.customerPhone)}
                              disabled={closingId === session.id}
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer md:hidden"
                            >
                              <X size={14} />
                              <span>Clear Table</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mb-4 pr-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg leading-none whitespace-nowrap">Table {table.tableNumber}</h3>
                      {elapsedString && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-background border border-border text-muted-foreground flex items-center gap-1 shadow-sm whitespace-nowrap" title="Time Occupied">
                          <Clock size={10} /> {elapsedString}
                        </span>
                      )}
                    </div>
                    {!(table.status === 'occupied' && session?.status !== 'billing') && (
                      <div>
                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full ${session?.status === 'billing' ? 'bg-purple-600 text-white shadow-sm' :
                          table.status === 'reserved' ? 'bg-amber-500 text-white' :
                            'bg-muted text-muted-foreground'
                          }`}>
                          {session?.status === 'billing' ? "BILLING" : table.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {!session && table.status === 'available' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <UtensilsCrossed className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                      <button
                        onClick={() => setOpenTableState({ id: table.id, number: table.tableNumber })}
                        className="w-full bg-primary/10 text-primary hover:bg-primary/20 py-2 rounded-xl text-sm font-bold border border-primary/20 transition-colors"
                      >
                        Open Table
                      </button>
                    </div>
                  )}

                  {session && (
                    <div className="flex-1 flex flex-col space-y-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-1">
                            {session.customerName}
                            <CheckCircle className="w-3 h-3 text-emerald-600 inline ml-1" />
                          </p>
                          {session.customerPhone && session.customerPhone !== "0000000000" && (
                            <p className="text-xs text-muted-foreground">{session.customerPhone}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-3">
                          {billsMap[session.id] && (
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground/70">Bill Total</p>
                              <p className="text-base font-black text-primary leading-none mt-0.5">₹{billsMap[session.id].totalAmount.toFixed(0)}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {session.status === 'billing' ? (
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                          <p className="text-sm font-bold text-purple-600 mb-2">Customer is Done</p>
                          <p className="text-xs text-muted-foreground mb-3">Please collect payment to free this table.</p>
                          {(user.role === 'admin' || user.permissions?.canClearTable) && (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleClearTableClick(session.id, session.customerPhone)}
                                disabled={closingId === session.id}
                                className="w-full bg-purple-600 text-white py-2 flex items-center justify-center gap-2 rounded-lg text-xs font-bold shadow-md hover:bg-purple-700 transition disabled:opacity-50"
                              >
                                {closingId === session.id ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                Clear Table
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOrderTableState({ sessionId: session.id, number: table.tableNumber, customerName: session.customerName, customerPhone: session.customerPhone })}
                            className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 py-2 px-2 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition shadow-sm leading-tight"
                          >
                            <Plus size={14} className="shrink-0" /> <span className="text-center">Add Items</span>
                          </button>
                          <button
                            onClick={() => setSelectedTable(table)}
                            className="flex-1 bg-muted text-foreground hover:bg-muted/80 py-2 px-2 flex items-center justify-center rounded-xl text-xs font-bold border border-border transition shadow-sm leading-tight text-center"
                          >
                            View Bill
                          </button>
                        </div>
                      )}

                      {(user.role === 'admin' || user.permissions?.canClearTable) && (
                        <div className="hidden md:flex flex-1 flex-col justify-end mt-3">
                          <button
                            onClick={() => handleClearTableClick(session.id, session.customerPhone)}
                            disabled={closingId === session.id}
                            className="w-full border border-destructive/30 text-destructive hover:bg-destructive/10 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                          >
                            {closingId === session.id ? <Loader2 className="animate-spin w-4 h-4" /> : <X size={14} />}
                            Clear Table
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table Detail Modal - shows orders + full bill */}
      {selectedTable && (() => {
        const detailSession = selectedTable.activeSession;
        const detailBill = detailSession ? billsMap[detailSession.id] : null;
        const sessionOrders = orders.filter(o =>
          o.tableSessionId === detailSession?.id ||
          (o as any).table_session_id === detailSession?.id
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedTable(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Table {selectedTable.tableNumber}</h3>
                  {detailSession && <p className="text-sm text-muted-foreground">{detailSession.customerName} · {detailSession.customerPhone}</p>}
                </div>
                <button onClick={() => setSelectedTable(null)} className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted"><X size={20} /></button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {detailBill ? (
                  <>
                    <h4 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">All Items Ordered</h4>
                    <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
                      {detailBill.itemized.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm mb-2">
                          <div>
                            <span>{item.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">₹{item.totalPrice.toFixed(2)}</span>
                            {item.menuItemId && (
                              <button
                                onClick={() => handleReorder(item, detailSession.id, detailSession.customerName, detailSession.customerPhone)}
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
                      {detailBill.sessionDetails && detailBill.sessionDetails.discount > 0 && (
                        <div className="flex justify-between text-sm text-primary font-bold mt-1">
                          <span>Discount ({detailBill.sessionDetails.couponCode})</span>
                          <span>-₹{detailBill.sessionDetails.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-border mt-2 pt-2 flex justify-between font-black text-base">
                        <span>Grand Total</span>
                        <span className="text-primary">₹{detailBill.totalAmount.toFixed(2)}</span>
                      </div>
                      {detailBill.totalPaid > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>Paid (Online)</span>
                          <span>₹{detailBill.totalPaid.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold">
                        <span>Amount Due</span>
                        <span className={detailBill.totalDue > 0.01 ? 'text-destructive' : 'text-emerald-600'}>
                          ₹{detailBill.totalDue.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Order Rounds</h4>
                    {detailBill.orders.map((o: Order & { items: any[], token?: string }, i: number) => (
                      <div key={o.id} className="bg-background rounded-xl border border-border p-3">
                        <div className="flex justify-between items-center text-xs text-muted-foreground mb-2 pb-1 border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">Round {i + 1}</span>
                            <span>· Token #{o.token}</span>
                            <span className="capitalize font-semibold px-2 py-0.5 bg-muted rounded-full ml-1">{o.status}</span>
                          </div>
                          <button
                            onClick={() => {
                              const rd = {
                                token: typeof o.token === "number" ? o.token : parseInt(String(o.token), 10) || 0,
                                customerName: detailBill?.customerName || "",
                                customerPhone: detailBill?.customerPhone || "",
                                items: o.items || [],
                                total: Number(o.total) || 0,
                                paymentMethod: "counter" as "counter",
                                createdAt: new Date().toISOString(),
                                orderType: "dine-in" as const,
                                tableSessionId: selectedTable.activeSession?.id || "",
                                tableNumber: selectedTable.tableNumber || "",
                              };
                              printQueue.enqueue(`manual-kot-${Date.now()}`, "kot", rd);
                            }}
                            className="p-1.5 hover:bg-muted text-foreground rounded-md transition-colors flex items-center gap-1"
                            title="Print KOT"
                          >
                            <Printer size={14} /> <span className="sr-only">Print KOT</span>
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {(o.items || []).map((item: any, j: number) => (
                            <div key={j} className="flex flex-col text-sm py-1 border-b border-border/20 last:border-0">
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1.5">
                                  {item.status === 'ready' ? (
                                    <span title="Ready"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /></span>
                                  ) : (
                                    <span title="Cooking"><Clock className="w-3.5 h-3.5 text-amber-500" /></span>
                                  )}
                                  <span className={item.status === 'ready' ? "text-emerald-700 dark:text-emerald-400" : ""}>{item.name}</span> <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                                </span>
                                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.note && <span className="text-[10px] text-amber-600 font-semibold italic ml-5 mt-0.5">* Note: {item.note}</span>}
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-border mt-1 pt-1 flex justify-between text-sm font-bold">
                          <span>Subtotal</span>
                          <span>₹{Number(o.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No orders yet for this table.</div>
                )}
              </div>

              {detailSession && (
                <div className="p-4 border-t border-border space-y-2">
                  {detailBill && (
                    <button
                      onClick={() => {
                        const rd = {
                          token: 0,
                          customerName: detailSession.customerName || "",
                          customerPhone: detailSession.customerPhone || "",
                          items: detailBill?.itemized || [],
                          total: detailBill?.totalAmount || 0,
                          paymentMethod: "counter" as any,
                          createdAt: new Date().toISOString(),
                          orderType: "dine-in",
                          tableSessionId: detailSession.id,
                          subtotal: detailBill?.sessionDetails?.subtotal || 0,
                          discount: detailBill?.sessionDetails?.discount || 0,
                          cgst: detailBill?.sessionDetails?.cgst || 0,
                          sgst: detailBill?.sessionDetails?.sgst || 0,
                          gst: detailBill?.sessionDetails?.gstTotal || 0,
                          paidAmount: detailBill?.totalPaid || 0,
                        };
                        printQueue.enqueue(`manual-receipt-${Date.now()}`, "receipt", rd);
                      }}
                      className="w-full bg-muted hover:bg-muted/80 text-foreground border border-border py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
                    >
                      <Printer size={15} /> Print Bill
                    </button>
                  )}
                  {(user.role === 'admin' || user.permissions?.canClearTable) && (
                    <button
                      onClick={() => handleClearTableClick(detailSession.id, detailSession.customerPhone)}
                      disabled={closingId === detailSession.id}
                      className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {closingId === detailSession.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                      Mark Paid & Clear Table
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        );
      })()}



      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative">
            <button onClick={() => { setShowPaymentModal(null); setSplitMode(false); }} disabled={!!closingId} className="absolute top-5 right-5 text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors disabled:opacity-50">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black mb-1">Clear Table</h3>
            <p className="text-sm font-semibold text-muted-foreground mb-6">How did the customer pay?</p>

            {billsMap[showPaymentModal] && (() => {
              const baseTotal = billsMap[showPaymentModal].totalAmount;
              const loyaltyDiscountValue = loyaltySettings?.enabled ? (pointsRedeemed * (loyaltySettings.discount_per_point || 1)) : 0;
              const finalTotal = Math.max(0, baseTotal - loyaltyDiscountValue);

              return (
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl mb-6 text-center space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground font-semibold px-4">
                    <span>Subtotal</span>
                    <span>₹{baseTotal.toFixed(2)}</span>
                  </div>
                  {pointsRedeemed > 0 && loyaltySettings?.enabled && (
                    <div className="flex justify-between text-sm text-primary font-bold px-4">
                      <span>Loyalty Reward</span>
                      <span>-₹{loyaltyDiscountValue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-primary/10">
                    <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Total Due</p>
                    <p className="text-4xl font-black text-primary">₹{finalTotal.toFixed(0)}</p>
                  </div>
                </div>
              );
            })()}

            <div className="mb-6 space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground ml-1">Customer Phone (Loyalty)</label>
                <input
                  type="text"
                  maxLength={10}
                  value={loyaltyPhone}
                  onChange={(e) => setLoyaltyPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter phone number..."
                  className="w-full bg-muted border-none rounded-xl p-3 font-semibold focus:ring-2 focus:ring-primary outline-none mt-1"
                />
              </div>

              {checkingLoyalty && <p className="text-xs text-muted-foreground ml-1">Checking loyalty points...</p>}

              {!checkingLoyalty && loyaltyPoints > 0 && loyaltySettings?.enabled && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-orange-600">Loyalty Member</p>
                    <p className="text-sm font-semibold text-orange-700">{loyaltyPoints} points available</p>
                  </div>
                  {pointsRedeemed > 0 ? (
                    <button
                      onClick={() => setPointsRedeemed(0)}
                      className="text-xs font-bold bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const maxPoints = Math.floor(billsMap[showPaymentModal].totalAmount / loyaltySettings.discount_per_point);
                        setPointsRedeemed(Math.min(loyaltyPoints, maxPoints || loyaltyPoints));
                      }}
                      className="text-xs font-bold bg-orange-500 text-white px-3 py-1.5 rounded-lg"
                    >
                      Redeem
                    </button>
                  )}
                </div>
              )}
            </div>

            {!splitMode ? (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: 'cash', label: 'Cash', icon: '💵' },
                  { id: 'upi', label: 'UPI', icon: '📱' },
                  { id: 'card', label: 'Card', icon: '💳' },
                ].map(method => (
                  <button
                    key={method.id}
                    disabled={!!closingId}
                    onClick={() => handleCloseSession(showPaymentModal, method.id)}
                    className="bg-card hover:bg-primary/10 border-2 border-border hover:border-primary text-foreground p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="text-2xl">{method.icon}</span>
                    {method.label}
                  </button>
                ))}
                <button
                  disabled={!!closingId}
                  onClick={() => {
                    setSplitMode(true);
                    setSplitCash("");
                    setSplitUpi("");
                  }}
                  className="bg-card hover:bg-primary/10 border-2 border-border hover:border-primary text-foreground p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="text-2xl">⚖️</span>
                  Split
                </button>
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Cash Received</label>
                    <input
                      type="number"
                      autoFocus
                      placeholder="₹0"
                      className="w-full bg-muted border-none rounded-xl p-3 font-bold text-lg focus:ring-2 focus:ring-primary outline-none"
                      value={splitCash}
                      onChange={(e) => {
                        setSplitCash(e.target.value);
                        const val = parseFloat(e.target.value) || 0;
                        const baseTotal = billsMap[showPaymentModal]?.totalAmount || 0;
                        const loyaltyDiscountValue = loyaltySettings?.enabled ? (pointsRedeemed * (loyaltySettings.discount_per_point || 1)) : 0;
                        const total = Math.max(0, baseTotal - loyaltyDiscountValue);
                        setSplitUpi(Math.max(0, total - val).toString());
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
                        const baseTotal = billsMap[showPaymentModal]?.totalAmount || 0;
                        const loyaltyDiscountValue = loyaltySettings?.enabled ? (pointsRedeemed * (loyaltySettings.discount_per_point || 1)) : 0;
                        const total = Math.max(0, baseTotal - loyaltyDiscountValue);
                        setSplitCash(Math.max(0, total - val).toString());
                      }}
                    />
                  </div>
                </div>
                <button
                  disabled={!!closingId}
                  onClick={() => handleCloseSession(showPaymentModal, 'split')}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold mt-2 hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  Confirm Split
                </button>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center px-4 leading-tight">
              Selecting a payment method will irreversibly close this session and commit it to today's sales report.
            </p>
          </motion.div>
        </div>
      )}
      {/* Add Modals Here */}
      {openTableState && (
        <TableOpenModal
          isOpen={!!openTableState}
          onClose={() => setOpenTableState(null)}
          onSuccess={handleModalSuccess}
          tableId={openTableState.id}
          tableNumber={openTableState.number}
        />
      )}

      {orderTableState && (
        <TableOrderModal
          isOpen={!!orderTableState}
          onClose={() => setOrderTableState(null)}
          onSuccess={handleModalSuccess}
          tableSessionId={orderTableState.sessionId}
          tableNumber={orderTableState.number}
          customerName={orderTableState.customerName}
          customerPhone={orderTableState.customerPhone}
        />
      )}

      {transferTableState && (
        <TableTransferModal
          isOpen={!!transferTableState}
          onClose={() => setTransferTableState(null)}
          sessionId={transferTableState.sessionId}
          currentTableNumber={transferTableState.number}
          availableTables={tables.filter(t => t.status === "available")}
          onSuccess={handleModalSuccess}
        />
      )}

      {showSettledBills && (
        <SettledBillsModal
          isOpen={showSettledBills}
          onClose={() => setShowSettledBills(false)}
        />
      )}
    </div>
  );
}
