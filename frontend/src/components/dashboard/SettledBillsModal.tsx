import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, FileText, ChevronLeft, ChevronRight, Clock, User, Printer } from "lucide-react";
import { apiGetSettledSessions, apiGetSessionBill, type SettledSession, type SessionBill } from "@/lib/apiClient";
import BillDocument, { downloadBillPrint } from "@/components/BillDocument";
import { printQueue } from "@/lib/printQueue";
import { toast } from "sonner";

interface SettledBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettledBillsModal({ isOpen, onClose }: SettledBillsModalProps) {
  const [sessions, setSessions] = useState<SettledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedSession, setSelectedSession] = useState<SettledSession | null>(null);
  const [detailBill, setDetailBill] = useState<SessionBill | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSessions(page);
    }
  }, [isOpen, page]);

  const fetchSessions = async (p: number) => {
    try {
      setLoading(true);
      setError("");
      const res = await apiGetSettledSessions(p, 25);
      setSessions(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load settled bills");
    } finally {
      setLoading(false);
    }
  };

  const handleViewBill = async (session: SettledSession) => {
    try {
      setSelectedSession(session);
      setLoadingBill(true);
      const bill = await apiGetSessionBill(session.session_id);
      setDetailBill(bill);
    } catch (err: any) {
      setError(err.message || "Failed to load bill details");
      setSelectedSession(null);
    } finally {
      setLoadingBill(false);
    }
  };

  const handleThermalPrint = () => {
    if (!detailBill || !selectedSession) return;
    
    const rd = {
      token: parseInt(selectedSession.session_id.slice(0, 4), 16) || 0,
      customerName: selectedSession.customer_name || "Guest",
      customerPhone: selectedSession.customer_phone || "",
      items: detailBill.itemized?.map((i) => ({
        id: String(i.menuItemId || i.name || Date.now()),
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        priceLabel: `₹${i.price}`,
        note: ""
      })) || [],
      total: detailBill.totalAmount,
      paymentMethod: "counter" as const,
      createdAt: selectedSession.end_time || new Date().toISOString(),
      orderType: "dine-in" as const,
      paymentStatus: "paid" as const,
      tableSessionId: selectedSession.session_id,
      subtotal: detailBill.sessionDetails?.subtotal || 0,
      discount: detailBill.sessionDetails?.discount || 0,
      cgst: detailBill.sessionDetails?.cgst || 0,
      sgst: detailBill.sessionDetails?.sgst || 0,
      gst: detailBill.sessionDetails?.gstTotal || 0,
      paidAmount: detailBill.totalAmount,
    };
    
    printQueue.enqueue(`reprint-${Date.now()}`, "receipt", rd);
    toast.success("Receipt sent to thermal printer");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card w-full max-w-4xl border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-muted/20 shrink-0">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-2">
                <FileText className="text-primary" /> Settled Bills History
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Total completed sessions: {totalCount}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
            {/* Left: List of Sessions */}
            <div className={`flex-1 flex flex-col border-r border-border overflow-hidden ${selectedSession ? 'hidden md:flex' : 'flex'}`}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                {loading && (
                  <div className="absolute inset-0 bg-card/50 flex items-center justify-center z-10">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                )}
                
                {error && <p className="text-destructive text-center p-4">{error}</p>}
                
                {!loading && sessions.length === 0 && !error && (
                  <div className="text-center py-12 text-muted-foreground">
                    No settled bills found.
                  </div>
                )}

                {sessions.map((session) => (
                  <div
                    key={session.session_id}
                    onClick={() => handleViewBill(session)}
                    className={`p-3 md:p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedSession?.session_id === session.session_id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md font-black text-sm">
                          Table {session.table_number}
                        </span>
                        <div className="flex items-center text-xs text-muted-foreground gap-1">
                          <User size={12} /> {session.customer_name}
                        </div>
                      </div>
                      <span className="font-bold text-foreground">
                        ₹{session.raw_total ? parseFloat(session.raw_total).toFixed(2) : "0.00"}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-2 border-t border-border/50 pt-2">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(session.end_time).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        Paid
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between shrink-0">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Right: Bill Detail */}
            <div className={`w-full md:w-[400px] bg-muted/5 flex flex-col ${!selectedSession ? 'hidden md:flex' : 'flex'}`}>
              {selectedSession ? (
                <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-4 md:hidden">
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="text-primary text-sm font-bold flex items-center gap-1"
                    >
                      <ChevronLeft size={16} /> Back to List
                    </button>
                  </div>

                  <h3 className="font-black text-lg mb-4 text-center">Receipt Viewer</h3>
                  
                  <div className="flex-1 overflow-y-auto bg-background rounded-xl border border-border p-4 shadow-sm relative no-scrollbar">
                    {loadingBill ? (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="animate-spin text-primary" size={32} />
                      </div>
                    ) : detailBill ? (
                      <div className="scale-95 origin-top">
                        <BillDocument
                          bill={{
                            ...detailBill,
                            customerName: selectedSession.customer_name,
                            customerPhone: selectedSession.customer_phone,
                            tableNumber: selectedSession.table_number
                          }}
                          showDownloadButton={false}
                        />
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground mt-10">Bill not loaded</div>
                    )}
                  </div>

                  {detailBill && (
                    <div className="mt-4 pt-4 border-t border-border flex gap-2">
                      <button
                        onClick={handleThermalPrint}
                        className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
                      >
                        <Printer size={16} /> Print Receipt
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <FileText size={24} className="opacity-50" />
                  </div>
                  <p className="font-medium">Select a past session to view its receipt</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
