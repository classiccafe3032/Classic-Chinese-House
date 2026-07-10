import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  apiGetTableByQr, apiReserveTable, apiSessionDone,
  apiGetSessionBill, apiSessionPay, apiGetBusinessSettings,
  apiCancelSession, apiApplySessionCoupon, apiRemoveSessionCoupon,
  setTenantSlug as setGlobalTenantSlug,
  type Table, type SessionBill,
} from "@/lib/apiClient";
import OrderPage from "./OrderPage";
import { validateName, validateMobile } from "@/lib/validators";
import BillDocument, { downloadBillPrint } from "@/components/BillDocument";
import { Loader2, QrCode, CheckCircle, CreditCard, Banknote, Download, ArrowLeft, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import NotFound from "./NotFound";

type PayStep = "bill" | "choose" | "cash-pending" | "online-processing" | "done";

export default function TableOrderPage() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<Table | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [reserving, setReserving] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [bill, setBill] = useState<SessionBill | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [payStep, setPayStep] = useState<PayStep>("bill");
  const { settings: business, loading: settingsLoading } = useBusinessSettings();

  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Prevent over-fetching bill
  const billFetchedRef = useRef(false);
  // Persist bill after session closes (for Thank You + Download screen)
  const finalBillRef = useRef<SessionBill | null>(null);
  const payStepRef = useRef<PayStep>("bill");

  useEffect(() => {
    if (!qrCode) return;
    fetchTable();
    const interval = setInterval(() => {
      // Stop polling once payment is done — session is closed and we want to keep bill visible
      if (payStepRef.current !== "done") fetchTable();
    }, 5000);
    return () => clearInterval(interval);
  }, [qrCode]);

  // Keep payStepRef in sync
  useEffect(() => { payStepRef.current = payStep; }, [payStep]);
  // Keep finalBillRef in sync whenever bill changes
  useEffect(() => { if (bill) finalBillRef.current = bill; }, [bill]);

  // Sync activeTableQr with localStorage
  useEffect(() => {
    if (!qrCode || !table) return;

    if (table.activeSession && table.activeSession.status !== "completed") {
      localStorage.setItem("activeTableQr", qrCode);
    } else {
      localStorage.removeItem("activeTableQr");
    }
  }, [qrCode, table]);

  useEffect(() => {
    const session = table?.activeSession;
    if (session?.status === "billing" && !billFetchedRef.current && !loadingBill) {
      billFetchedRef.current = true;
      fetchBill(session.id, session);
    }
  }, [table?.activeSession?.status]);

  const fetchTable = async () => {
    try {
      if (qrCode) {
        const t = await apiGetTableByQr(qrCode);
        setTable(t);
        // If session is now completed, update state
        if (t.activeSession?.status === "completed") {
          setPayStep("done");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBill = async (sessionId: string, session?: any) => {
    setLoadingBill(true);
    try {
      const b = await apiGetSessionBill(sessionId);
      // Attach customer info from session
      if (session) {
        b.customerName = session.customerName;
        b.customerPhone = session.customerPhone;
      }
      setBill(b);
    } catch (err) {
      console.error("Failed to fetch bill", err);
      billFetchedRef.current = false; // allow retry
      toast({ title: "Could not load bill. Please wait...", variant: "destructive" });
    } finally {
      setLoadingBill(false);
    }
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();

    const nErr = validateName(name, false);
    const pErr = validateMobile(phone, false);

    if (nErr || pErr) {
      setNameError(nErr || "");
      setPhoneError(pErr || "");
      return;
    }

    setReserving(true);
    try {
      await apiReserveTable(table!.id, name, phone);
      await fetchTable();
    } catch (err: any) {
      toast({ title: err.message || "Failed to reserve", variant: "destructive" });
    } finally {
      setReserving(false);
    }
  };

  const handleDone = async () => {
    if (!table?.activeSession?.id) return;
    setMarkingDone(true);
    try {
      await apiSessionDone(table.activeSession.id);
      billFetchedRef.current = false;
      await fetchTable();
    } catch (err: any) {
      toast({ title: "Failed to end session", variant: "destructive" });
    } finally {
      setMarkingDone(false);
    }
  };

  const handleCancelSession = async () => {
    if (!table?.activeSession?.id) return;
    setCancelling(true);
    try {
      await apiCancelSession(table.activeSession.id);
      toast({ title: "Table released", description: "Your session has been cancelled." });
      localStorage.removeItem("tableSessionId");
      localStorage.removeItem("tableCustomerPhone");
      localStorage.removeItem("activeTableQr");
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Cannot cancel", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handlePayOnline = async () => {
    if (!table?.activeSession?.id) return;
    setPayStep("online-processing");
    try {
      // Placeholder: In production, launch Razorpay SDK here first
      // For now, simulate a 1.5s payment process
      await new Promise(r => setTimeout(r, 1500));
      await apiSessionPay(table.activeSession.id);
      // Refresh bill to show fully paid
      const updatedBill = await apiGetSessionBill(table.activeSession.id).catch(() => bill);
      if (updatedBill) setBill(updatedBill as SessionBill);
      setPayStep("done");
      toast({ title: "Payment successful! Thank you 🎉" });
    } catch (err: any) {
      setPayStep("choose");
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApplyCoupon = async () => {
    if (!table?.activeSession?.id || !couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      await apiApplySessionCoupon(table.activeSession.id, couponInput);
      toast({ title: "Coupon Applied", description: "Discount added to your bill." });
      setCouponInput("");
      billFetchedRef.current = false;
      fetchBill(table.activeSession.id, table.activeSession);
    } catch (err: any) {
      setCouponError(err.message || "Failed to apply coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    if (!table?.activeSession?.id) return;
    try {
      await apiRemoveSessionCoupon(table.activeSession.id);
      toast({ title: "Coupon Removed" });
      billFetchedRef.current = false;
      fetchBill(table.activeSession.id, table.activeSession);
    } catch (err: any) {
      toast({ title: "Failed to remove coupon", variant: "destructive" });
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse font-medium">Entering Restaurant...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return <NotFound />;
  }

  if (!table) {
    return <div className="h-screen flex items-center justify-center"><h2>Table Not Found</h2></div>;
  }

  // ─── Done: Payment complete — show Thank You + Download before session null check ───
  if (payStep === "done") {
    const doneBill = finalBillRef.current;
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 text-center shadow-2xl space-y-5"
        >
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 rounded-full mb-2">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
          </motion.div>
          <h2 className="text-2xl font-black">Payment Successful!</h2>
          {table && <p className="text-muted-foreground text-sm">Table {table.tableNumber} • Session closed</p>}
          <p className="text-muted-foreground text-sm">Thank you for dining with us. We hope to see you again! 🙏</p>

          {doneBill ? (
            <button
              onClick={() => downloadBillPrint(doneBill, business)}
              className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 py-3 rounded-xl text-sm font-bold transition-all"
            >
              <Download size={16} /> Download / Print Bill
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">Bill loading...</p>
          )}
        </motion.div>
      </div>
    );
  }

  const session = table.activeSession;

  // ─── State 1: No active session ───
  if (!session) {
    if (table.qrRoutingMode === 'waiter_unlock') {
      return (
        <OrderPage
          isTableMode={true}
          tableNumber={table.tableNumber}
          isTableLocked={true}
        />
      );
    }
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="w-full max-w-sm bg-card p-6 rounded-2xl shadow-xl border border-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-3">
              <QrCode className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Table {table.tableNumber}</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your details to start ordering.</p>
          </div>
          <form onSubmit={handleReserve} className="space-y-4">
            <div>
              <Label>Name (Optional)  </Label>
              <Input
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
                onBlur={e => setNameError(validateName(e.target.value, false) || "")}
                placeholder="Your Name"
                className={nameError ? "border-red-500" : ""}
              />
              {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
            </div>
            <div>
              <Label>Phone Number (Optional)</Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  if (phoneError) setPhoneError("");
                }}
                onBlur={e => setPhoneError(validateMobile(e.target.value, false) || "")}
                placeholder="10-digit number"
                className={phoneError ? "border-red-500" : ""}
              />
              {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>
            <Button type="submit" disabled={reserving} className="w-full">
              {reserving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
              Start Session
            </Button>
          </form>
        </div>
      </div>
    );
  }




  // ─── State 3: Billing Flow ───
  if (session.status === "billing") {
    const sessionInfo = session;
    const billData = bill ? {
      ...bill,
      customerName: bill.customerName || sessionInfo.customerName,
      customerPhone: bill.customerPhone || sessionInfo.customerPhone,
    } : null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 flex flex-col items-center justify-start pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-4"
        >
          {/* ─── Bill + Payment Steps ─── */}
          <>
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-3">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-black mb-1">Your Bill</h2>
              {bill?.tableNumber && (
                <span className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">
                  🪑 Table {bill.tableNumber}
                </span>
              )}
            </div>

            {/* Bill Details Card */}
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
              {loadingBill && !bill ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="animate-spin" size={18} /> Loading your bill...
                </div>
              ) : billData ? (
                <BillDocument bill={billData} business={business} showDownloadButton={payStep === "bill"} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Unable to load bill.{" "}
                  <button className="text-primary underline" onClick={() => { billFetchedRef.current = false; fetchBill(session.id, session); }}>
                    Retry
                  </button>
                </p>
              )}
            </div>

            {/* Coupon Section */}
            {payStep === "bill" && billData && billData.totalDue > 0.01 && (
              <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                <label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Tag size={16} className="text-primary" />
                  Have a coupon?
                </label>

                {billData.sessionDetails?.couponCode ? (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <div>
                      <span className="font-bold text-primary text-sm">
                        {billData.sessionDetails.couponCode}
                      </span>
                      <span className="text-muted-foreground text-xs ml-2">
                        -₹{billData.sessionDetails.discount}
                      </span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-muted-foreground hover:text-destructive transition-colors"
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
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm uppercase tracking-wider"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponInput.trim()}
                      className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
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
                  <p className="text-destructive text-xs font-medium mt-2">
                    {couponError}
                  </p>
                )}
              </div>
            )}

            {/* ─── Step: choose payment method ─── */}
            <AnimatePresence mode="wait">
              {payStep === "bill" && billData && billData.totalDue > 0.01 && (
                <motion.div key="bill-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setPayStep("choose")}
                    className="w-full bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-4 rounded-2xl font-bold text-base shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                  >
                    Proceed to Pay · ₹{billData.totalDue.toFixed(2)}
                  </motion.button>
                </motion.div>
              )}

              {payStep === "choose" && billData && (
                <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <p className="text-center text-sm font-semibold text-muted-foreground">How would you like to pay?</p>

                  {/* Online Pay */}
                  {business.features?.isOnlinePaymentEnabled !== false && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handlePayOnline}
                        className="w-full bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-4 rounded-2xl font-bold text-base shadow-lg shadow-primary/25 flex items-center justify-center gap-3"
                      >
                        <CreditCard size={20} />
                        Pay Online · ₹{billData.totalDue.toFixed(2)}
                      </motion.button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-semibold">OR</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    </>
                  )}

                  {/* Cash */}
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setPayStep("cash-pending")}
                    className="w-full bg-muted border border-border text-foreground py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 hover:bg-muted/60 transition-all"
                  >
                    <Banknote size={20} /> Pay at Counter
                  </motion.button>

                  <button onClick={() => setPayStep("bill")} className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 py-1">
                    <ArrowLeft size={12} /> Back to Bill
                  </button>
                </motion.div>
              )}

              {payStep === "cash-pending" && (
                <motion.div key="cash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center space-y-3"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/15 rounded-full">
                    <Banknote className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">Please Pay at Counter</h3>
                  <p className="text-sm text-muted-foreground">Pay ₹{billData?.totalDue.toFixed(2)} via Cash or UPI/QR scanner at the counter. Staff will clear your table once done.</p>
                  <button onClick={() => setPayStep("choose")} className="text-xs text-muted-foreground flex items-center justify-center gap-1 mx-auto">
                    <ArrowLeft size={12} /> Change payment method
                  </button>
                </motion.div>
              )}

              {payStep === "online-processing" && (
                <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-2xl p-6 text-center space-y-3"
                >
                  <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                  <p className="font-semibold">Processing payment...</p>
                  <p className="text-xs text-muted-foreground">Please do not close this page.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        </motion.div>
      </div>
    );
  }

  // ─── State 4: Session completed ───
  if (session.status === "completed") {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="w-full max-w-sm bg-card p-8 rounded-2xl shadow-xl border border-border text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-muted-foreground">Your visit to Table {table.tableNumber} is complete. We hope to see you again!</p>
        </div>
      </div>
    );
  }

  // ─── State 5: Active & verified → Render full menu ───
  return (
    <OrderPage
      isTableMode={true}
      tableSessionId={session.id}
      tableNumber={table.tableNumber}
      defaultName={session.customerName}
      defaultPhone={session.customerPhone}
      onSessionDone={handleDone}
      markingDone={markingDone}
      onCancelSession={handleCancelSession}
      cancellingSession={cancelling}
    />
  );
}
