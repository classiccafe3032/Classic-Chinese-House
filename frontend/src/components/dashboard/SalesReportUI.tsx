import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { printQueue } from "@/lib/printQueue";
import { type ZReportData } from "@/lib/receiptGenerator";
import { TrendingUp, DollarSign, BarChart3, CalendarDays, Download, Share2, Printer } from "lucide-react";
import { apiGetSalesReport } from "@/lib/apiClient";
import type { SalesReportData, SalesReportType } from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import { toast } from "sonner";

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const SalesReportUI = () => {
  const [reportType, setReportType] = useState<SalesReportType>("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "dine-in" | "takeaway" | "delivery">("all");
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for order events to trigger refresh
  useEffect(() => {
    const handleRefresh = () => setRefreshKey((k) => k + 1);
    socket.on("new-order", handleRefresh);
    socket.on("order-updated", handleRefresh);
    socket.on("payment-updated", handleRefresh);
    return () => {
      socket.off("new-order", handleRefresh);
      socket.off("order-updated", handleRefresh);
      socket.off("payment-updated", handleRefresh);
    };
  }, []);

  // Consolidated single useEffect for fetching
  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = {};

        if (reportType === "daily") params.date = selectedDate;
        if (reportType === "monthly") { params.year = selectedYear; params.month = selectedMonth; }
        if (reportType === "yearly") params.year = selectedYear;
        if (orderTypeFilter !== "all") params.orderType = orderTypeFilter;

        const res = await apiGetSalesReport(reportType, params);
        setData(res);
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportType, selectedDate, selectedYear, selectedMonth, orderTypeFilter, refreshKey]);

  const getReportLabel = () => {
    if (reportType === "daily") return `Daily_${selectedDate}`;
    if (reportType === "weekly") return `Weekly_${data?.weekStart ?? ""}`;
    if (reportType === "monthly") return `Monthly_${selectedYear}-${selectedMonth}`;
    if (reportType === "yearly") return `Yearly_${selectedYear}`;
    return "Daywise_All";
  };

  const buildCSVRows = (): string[][] => {
    if (!data) return [];
    const rows: string[][] = [];

    if (reportType === "yearly" && data.months) {
      rows.push(["Month", "Orders", "Revenue"]);
      data.months.forEach((m) => rows.push([m.month, String(m.orders), String(m.revenue)]));
    } else if (data.days) {
      rows.push(["Date", "Orders", "Revenue"]);
      data.days.forEach((d) => rows.push([d.date, String(d.orders), String(d.revenue)]));
    }

    rows.push([]);
    rows.push(["Total Orders", String(data.totalOrders)]);
    rows.push(["Total Revenue", String(data.totalRevenue)]);
    if (data.paidRevenue !== undefined) rows.push(["Paid Revenue", String(data.paidRevenue)]);
    if (data.pendingRevenue !== undefined) rows.push(["Pending Revenue", String(data.pendingRevenue)]);

    return rows;
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = buildCSVRows();
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sales_Report_${getReportLabel()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const label = getReportLabel().replace(/_/g, " ");
    let text = `📊 *Sales Report - ${label}*\n\n`;
    text += `🛒 Total Orders: ${data.totalOrders}\n`;
    text += `💰 Total Revenue: ₹${data.totalRevenue}\n`;
    if (data.paidRevenue !== undefined) text += `✅ Paid: ₹${data.paidRevenue}\n`;
    if (data.pendingRevenue !== undefined) text += `⏳ Pending: ₹${data.pendingRevenue}\n`;
    text += `📈 Avg Order: ₹${data.totalOrders > 0 ? Math.round(data.totalRevenue / data.totalOrders) : 0}\n`;

    if (reportType === "yearly" && data.months) {
      text += "\n*Monthly Breakdown:*\n";
      data.months.forEach((m) => { text += `${m.month}: ${m.orders} orders • ₹${m.revenue}\n`; });
    } else if (data.days && data.days.length <= 31) {
      text += "\n*Daily Breakdown:*\n";
      data.days.forEach((d) => { text += `${d.date}: ${d.orders} orders • ₹${d.revenue}\n`; });
    }

    const encoded = encodeURIComponent(text);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile ? `whatsapp://send?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  const handlePrintSummary = () => {
    if (!data) return;
    const label = getReportLabel().replace(/_/g, " ");
    const reportData: ZReportData = {
      label,
      totalOrders: data.totalOrders,
      totalRevenue: data.totalRevenue,
      paidRevenue: data.paidRevenue,
      pendingRevenue: data.pendingRevenue
    };
    printQueue.enqueue(`manual-zreport-${Date.now()}`, "zreport", reportData);
  };

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="container mx-auto px-4 pb-10 py-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">Sales Reports</h2>
          <p className="text-muted-foreground text-sm">Daily, weekly, monthly, yearly and complete day-wise performance reports</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["daily", "weekly", "monthly", "yearly", "daywise"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setReportType(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${reportType === key
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-card border border-border hover:bg-muted text-muted-foreground"
                }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1).replace("wise", "-wise")}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {!loading && data && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card border border-border hover:bg-muted text-muted-foreground transition-all"
          >
            <Download size={16} /> Download CSV
          </button>
          <button
            onClick={shareWhatsApp}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card border border-border hover:bg-muted text-muted-foreground transition-all"
          >
            <Share2 size={16} /> Share
          </button>
          <button
            onClick={handlePrintSummary}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <Printer size={16} /> Print Summary
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {reportType === "daily" && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 w-full md:w-auto">
            <CalendarDays size={18} className="text-muted-foreground" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent outline-none text-sm" />
          </div>
        )}

        {(reportType === "yearly" || reportType === "monthly") && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 w-full md:w-auto">
            <BarChart3 size={18} className="text-muted-foreground" />
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent outline-none text-sm">
              {Array.from({ length: 6 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        )}

        {reportType === "monthly" && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 w-full md:w-auto">
            <CalendarDays size={18} className="text-muted-foreground" />
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none text-sm">
              {MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
            </select>
          </div>
        )}

        {/* Order Type Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "dine-in", "takeaway", "delivery"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderTypeFilter === t
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-card border border-border hover:bg-muted text-muted-foreground"
                }`}
            >
              {t === "all" ? "All Types" : t === "dine-in" ? "Dine-in" : t === "takeaway" ? "Takeaway" : "Delivery"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-muted-foreground">
          Loading report...
        </motion.div>
      )}

      {/* No Data */}
      {!loading && !data && (
        <div className="py-16 text-center text-muted-foreground">No data available</div>
      )}

      {/* Report Cards */}
      {!loading && data && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <TrendingUp size={18} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-3xl font-bold">{data.totalOrders || 0}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <DollarSign size={18} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold text-emerald-600">₹{data.totalRevenue?.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <BarChart3 size={18} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Avg Order Value</p>
              <p className="text-3xl font-bold">₹{data.totalOrders > 0 ? Math.round((data.totalRevenue || 0) / data.totalOrders) : 0}</p>
            </div>
          </div>

          {/* Daily extra */}
          {reportType === "daily" && data.paidRevenue !== undefined && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-sm text-muted-foreground">Paid Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">₹{data.paidRevenue || 0}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-sm text-muted-foreground">Pending Revenue</p>
                <p className="text-2xl font-bold text-secondary">₹{data.pendingRevenue || 0}</p>
              </div>
            </div>
          )}

          {/* Weekly */}
          {reportType === "weekly" && data.days && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Week Report ({data.weekStart} → {data.weekEnd})</h3>
              <div className="space-y-3">
                {data.days.map((d) => (
                  <div key={d.date} className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-sm">{formatDate(d.date)}</span>
                    <span className="text-sm font-semibold">{d.orders} orders • ₹{d.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly */}
          {reportType === "monthly" && data.days && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Monthly Report ({data.month}/{data.year})</h3>
              <div className="space-y-3">
                {data.days.map((d) => (
                  <div key={d.date} className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-sm">{formatDate(d.date)}</span>
                    <span className="text-sm font-semibold">{d.orders} orders • ₹{d.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yearly */}
          {reportType === "yearly" && data.months && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Yearly Report ({data.year})</h3>
              <div className="space-y-3">
                {data.months.map((m) => (
                  <div key={m.monthNumber} className="flex justify-between border-b border-border/30 pb-2">
                    <span className="text-sm">{m.month}</span>
                    <span className="text-sm font-semibold">{m.orders} orders • ₹{m.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daywise */}
          {reportType === "daywise" && data.days && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Day-wise Full Sales</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border/40">
                      <th className="py-2">Date</th>
                      <th className="py-2">Orders</th>
                      <th className="py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((d) => (
                      <tr key={d.date} className="border-b border-border/20">
                        <td className="py-2">{formatDate(d.date)}</td>
                        <td className="py-2 font-semibold">{d.orders}</td>
                        <td className="py-2 font-bold text-emerald-600">₹{d.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default SalesReportUI;
