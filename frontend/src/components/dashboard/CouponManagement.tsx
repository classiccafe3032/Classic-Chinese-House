import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Tag,
  Hash,
  Percent,
  DollarSign,
  CalendarDays,
  CheckCircle,
  XCircle,
  Send,
  X,
  Phone,
  CheckSquare,
} from "lucide-react";
import {
  apiAdminCreateCoupon,
  apiAdminListCoupons,
  apiAdminToggleCoupon,
  apiAdminDeleteCoupon,
  apiAdminBulkDeleteCoupons,
  apiAdminShareCouponSMS,
  apiAdminToggleCouponPublic,
  type AdminCoupon,
} from "@/lib/apiClient";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const CouponManagement = () => {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("flat");
  const [value, setValue] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [usageLimit, setUsageLimit] = useState("1");
  const [active, setActive] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<
    "all" | "admin" | "customer"
  >("all");

  // SMS Share state
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const [sharing, setSharing] = useState(false);

  // Multi-select state
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const data = await apiAdminListCoupons();
      setCoupons(data);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const resetForm = () => {
    setCode("");
    setDiscountType("flat");
    setValue("");
    setExpiryDate("");
    setUsageLimit("1");
    setActive(true);
    setIsPublic(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || Number(value) <= 0) {
      toast({ title: "Invalid value", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      await apiAdminCreateCoupon({
        code: code.trim() || undefined,
        discount_type: discountType,
        value: Number(value),
        expiry_date: expiryDate || undefined,
        usage_limit: Number(usageLimit) || 1,
        active,
        is_public: isPublic,
      });
      toast({ title: "Coupon Created ✅" });
      resetForm();
      setShowForm(false);
      await fetchCoupons();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (couponCode: string) => {
    try {
      await apiAdminToggleCoupon(couponCode);
      await fetchCoupons();
      toast({ title: "Status toggled" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleTogglePublic = async (couponCode: string) => {
    try {
      await apiAdminToggleCouponPublic(couponCode);
      await fetchCoupons();
      toast({ title: "Public status toggled" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (couponCode: string) => {
    try {
      await apiAdminDeleteCoupon(couponCode);

      setSelectedCodes((prev) => {
        const next = new Set(prev);
        next.delete(couponCode);
        return next;
      });

      await fetchCoupons();

      toast({ title: "Coupon Deleted 🗑️" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    const codes = Array.from(selectedCodes);
    if (codes.length === 0) return;

    setBulkDeleting(true);

    try {
      const result = await apiAdminBulkDeleteCoupons(codes);

      setSelectedCodes(new Set());

      await fetchCoupons();

      toast({
        title: `${result.count} coupon(s) deleted 🗑️`,
      });
    } catch (err: any) {
      toast({
        title: "Bulk delete failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };
  const toggleSelect = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCodes.size === filteredCoupons.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(filteredCoupons.map((c) => c.code)));
    }
  };

  const handleShareSMS = async () => {
    if (!shareCode || !/^\d{10}$/.test(sharePhone.trim())) {
      toast({
        title: "Enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }
    setSharing(true);
    try {
      await apiAdminShareCouponSMS(shareCode, sharePhone.trim());
      toast({
        title: "SMS Sent ✅",
        description: `Coupon details sent to ${sharePhone}`,
      });
      setShareCode(null);
      setSharePhone("");
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  // Analytics
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.active).length;
  const totalRedemptions = coupons.reduce((s, c) => s + c.used_count, 0);
  const filteredCoupons = coupons
    .filter((c) => {
      const matchesSearch =
        c.code.includes(search) || c.created_by?.includes(search);

      const matchesCreator =
        creatorFilter === "all"
          ? true
          : creatorFilter === "admin"
            ? c.created_by === "admin"
            : c.created_by !== "admin";

      return matchesSearch && matchesCreator;
    })
    .sort((a, b) => {
      // newest first (if you have created_at)
      if (a.created_at && b.created_at) {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      return 0;
    });
  return (
    <div className="container mx-auto px-4 pb-10">
      {/* Analytics Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Coupons", value: totalCoupons, icon: Ticket },
          { label: "Active", value: activeCoupons, icon: CheckCircle },
          { label: "Redemptions", value: totalRedemptions, icon: Hash },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-4"
          >
            <stat.icon size={16} className="text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Create Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 mb-6 transition-all"
      >
        <Plus size={16} /> {showForm ? "Cancel" : "Create Coupon"}
      </motion.button>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <form
              onSubmit={handleCreate}
              className="bg-card border border-border rounded-2xl p-6 space-y-4"
            >
              <h3 className="font-heading text-lg font-bold flex items-center gap-2">
                <Tag size={18} /> New Coupon
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Code */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Code (auto if empty)
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={20}
                    placeholder="e.g. SUMMER20"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </div>

                {/* Discount Type */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Discount Type
                  </label>
                  <div className="flex gap-2">
                    {(["flat", "percent"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDiscountType(t)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${discountType === t
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                      >
                        {t === "flat" ? (
                          <DollarSign size={14} />
                        ) : (
                          <Percent size={14} />
                        )}
                        {t === "flat" ? "Flat (₹)" : "Percent (%)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Value {discountType === "percent" ? "(%)" : "(₹)"}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    min={1}
                    max={discountType === "percent" ? 100 : undefined}
                    placeholder={
                      discountType === "percent" ? "e.g. 15" : "e.g. 50"
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                    required
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Expiry Date (optional)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </div>

                {/* Usage Limit */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    min={1}
                    placeholder="1"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                        : "border-border bg-muted text-muted-foreground"
                      }`}
                  >
                    {active ? (
                      <ToggleRight size={18} />
                    ) : (
                      <ToggleLeft size={18} />
                    )}
                    {active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={`ml-2 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isPublic
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                        : "border-border bg-muted text-muted-foreground"
                      }`}
                  >
                    {isPublic ? (
                      <ToggleRight size={18} />
                    ) : (
                      <ToggleLeft size={18} />
                    )}
                    {isPublic ? "AI Promoted" : "Private"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full md:w-auto px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {creating ? "Creating..." : "Create Coupon"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by code or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none w-full md:w-64"
        />

        {/* Creator Filter */}
        <div className="flex gap-2">
          {(["all", "admin", "customer"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setCreatorFilter(type)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${creatorFilter === type
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
                }`}
            >
              {type === "all" ? "All" : type === "admin" ? "Admin" : "Customer"}
            </button>
          ))}
        </div>
      </div>
      {/* Coupon Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : coupons.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Ticket size={36} className="text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">No coupons yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Create your first coupon above
          </p>
        </motion.div>
      ) : (
        <>
          {/* Bulk Delete Bar */}
          <AnimatePresence>
            {selectedCodes.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl"
              >
                <CheckSquare size={18} className="text-destructive" />
                <span className="text-sm font-semibold">
                  {selectedCodes.size} selected
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={bulkDeleting || selectedCodes.size === 0}
                      className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:bg-destructive/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkDeleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Delete Selected
                    </button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {selectedCodes.size} coupon
                        {selectedCodes.size !== 1 ? "s" : ""}?
                      </AlertDialogTitle>

                      <AlertDialogDescription>
                        This will permanently remove{" "}
                        <span className="font-semibold">
                          {selectedCodes.size} selected coupon
                          {selectedCodes.size !== 1 ? "s" : ""}
                        </span>
                        .
                        <br />
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={bulkDeleting}>
                        Cancel
                      </AlertDialogCancel>

                      <AlertDialogAction
                        onClick={async () => {
                          await handleBulkDelete();
                        }}
                        disabled={bulkDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {bulkDeleting ? (
                          <Loader2 size={14} className="animate-spin mr-2" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <button
                  onClick={() => setSelectedCodes(new Set())}
                  className="px-3 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all"
                >
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            <AnimatePresence>
              {filteredCoupons.map((coupon) => (
                <motion.div
                  key={coupon.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedCodes.has(coupon.code)}
                        onCheckedChange={() => toggleSelect(coupon.code)}
                      />
                      <div>
                        <h3 className="font-mono font-black text-primary text-xl leading-tight">{coupon.code}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-xs font-semibold ${
                            coupon.discount_type === "percent"
                              ? "bg-accent/10 text-accent"
                              : "bg-secondary/10 text-secondary-foreground"
                          }`}
                        >
                          {coupon.discount_type === "percent" ? <Percent size={10} /> : <DollarSign size={10} />}
                          {coupon.discount_type === "percent" ? `${parseFloat(coupon.value)}%` : `₹${parseFloat(coupon.value)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {coupon.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600">
                          <CheckCircle size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                      {coupon.is_public ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600">
                          <CheckCircle size={10} /> Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                          <XCircle size={10} /> Private
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 py-3 border-t border-border/50">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Usage</p>
                      <p className="font-mono text-sm font-semibold">{coupon.used_count}/{coupon.usage_limit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Expiry</p>
                      <p className="text-sm font-medium">
                        {coupon.expiry_date
                          ? new Date(coupon.expiry_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })
                          : "Never"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {coupon.created_by === "admin" ? "By Admin" : `By ${coupon.created_by}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(coupon.code)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        {coupon.active ? (
                          <ToggleRight size={18} className="text-emerald-500" />
                        ) : (
                          <ToggleLeft size={18} className="text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleTogglePublic(coupon.code)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        {coupon.is_public ? (
                          <CheckCircle size={18} className="text-blue-500" />
                        ) : (
                          <XCircle size={18} className="text-muted-foreground" />
                        )}
                      </button>
                      {coupon.created_by === "admin" && (
                        <button
                          onClick={() => {
                            setShareCode(coupon.code);
                            setSharePhone("");
                          }}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Send size={18} />
                        </button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete coupon <span className="font-mono font-semibold text-primary">{coupon.code}</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(coupon.code)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[16px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border bg-muted/30 text-sm md:text-base">
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={
                          filteredCoupons.length > 0 &&
                          selectedCodes.size === filteredCoupons.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">
                      Expiry
                    </th>
                    <th className="px-4 py-3 font-semibold">Usage</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">AI Distribute</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">
                      Created By
                    </th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredCoupons.map((coupon) => (
                      <motion.tr
                        key={coupon.code}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedCodes.has(coupon.code)}
                            onCheckedChange={() => toggleSelect(coupon.code)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-primary text-[15px]">
                            {coupon.code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[14px] font-semibold ${coupon.discount_type === "percent"
                                ? "bg-accent/10 text-accent"
                                : "bg-secondary/10 text-secondary-foreground"
                              }`}
                          >
                            {coupon.discount_type === "percent" ? (
                              <Percent size={10} />
                            ) : (
                              <DollarSign size={10} />
                            )}
                            {coupon.discount_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {coupon.discount_type === "percent"
                            ? `${parseFloat(coupon.value)}%`
                            : `₹${parseFloat(coupon.value)}`}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {coupon.expiry_date
                            ? new Date(coupon.expiry_date).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[14px] font-mono">
                            {coupon.used_count}/{coupon.usage_limit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {coupon.active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[14px] font-semibold bg-emerald-500/10 text-emerald-600">
                              <CheckCircle size={10} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[14px] font-semibold bg-destructive/10 text-destructive">
                              <XCircle size={10} /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {coupon.is_public ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[14px] font-semibold bg-blue-500/10 text-blue-600">
                              <CheckCircle size={10} /> Public
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[14px] font-semibold bg-muted text-muted-foreground">
                              <XCircle size={10} /> Private
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                          <span className="font-mono text-[15px]">
                            {coupon.created_by === "admin"
                              ? "Admin"
                              : `Customer (${coupon.created_by})`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggle(coupon.code)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Toggle active"
                            >
                              {coupon.active ? (
                                <ToggleRight
                                  size={18}
                                  className="text-emerald-500"
                                />
                              ) : (
                                <ToggleLeft
                                  size={18}
                                  className="text-muted-foreground"
                                />
                              )}
                            </button>
                            <button
                              onClick={() => handleTogglePublic(coupon.code)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Toggle AI Distribution"
                            >
                              {coupon.is_public ? (
                                <CheckCircle
                                  size={18}
                                  className="text-blue-500"
                                />
                              ) : (
                                <XCircle
                                  size={18}
                                  className="text-muted-foreground"
                                />
                              )}
                            </button>
                            {coupon.created_by === "admin" && (
                              <button
                                onClick={() => {
                                  setShareCode(coupon.code);
                                  setSharePhone("");
                                }}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Share via SMS"
                              >
                                <Send size={18} />
                              </button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </AlertDialogTrigger>

                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete coupon?
                                  </AlertDialogTitle>

                                  <AlertDialogDescription>
                                    This will permanently delete coupon{" "}
                                    <span className="font-mono font-semibold text-primary">
                                      {coupon.code}
                                    </span>
                                    . This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>

                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>

                                  <AlertDialogAction
                                    onClick={() => handleDelete(coupon.code)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SMS Share Modal */}
      <AnimatePresence>
        {shareCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShareCode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Send size={18} className="text-primary" /> Share Coupon
                </h3>
                <button
                  onClick={() => setShareCode(null)}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                Send coupon{" "}
                <span className="font-mono font-bold text-primary">
                  {shareCode}
                </span>{" "}
                details via SMS
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Phone size={12} /> Customer Phone Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={sharePhone}
                  onChange={(e) =>
                    setSharePhone(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                  autoFocus
                />
                {sharePhone && !/^\d{10}$/.test(sharePhone) && (
                  <p className="text-xs text-destructive">
                    Enter a valid 10-digit number
                  </p>
                )}
              </div>

              <button
                onClick={handleShareSMS}
                disabled={sharing || !/^\d{10}$/.test(sharePhone)}
                className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sharing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {sharing ? "Sending..." : "Send SMS"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CouponManagement;
