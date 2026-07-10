import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, CalendarDays, CalendarRange, Calendar, CalendarClock,
  TrendingUp, ShoppingCart, IndianRupee, ArrowUpRight, ArrowDownRight,
  Crown, TrendingDown,
} from "lucide-react";
import {
  apiGetSalesReport,
  type SalesReportData,
  type SalesReportType,
} from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, Cell, PieChart, Pie,
} from "recharts";

const PERIOD_TABS: { key: SalesReportType; label: string; icon: typeof CalendarDays }[] = [
  { key: "daily", label: "Daily", icon: CalendarDays },
  { key: "weekly", label: "Weekly", icon: CalendarRange },
  { key: "monthly", label: "Monthly", icon: Calendar },
  { key: "yearly", label: "Yearly", icon: CalendarClock },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TOP_COLORS = [
  "hsl(142 71% 45%)", "hsl(198 80% 50%)", "hsl(262 80% 55%)",
  "hsl(38 92% 50%)", "hsl(330 80% 55%)",
];

const LEAST_COLORS = [
  "hsl(0 72% 55%)", "hsl(25 90% 55%)", "hsl(45 90% 50%)",
  "hsl(15 80% 50%)", "hsl(350 70% 50%)",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue")
            ? `₹${p.value.toLocaleString("en-IN")}`
            : p.value}
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, subtitle, trend }: {
  title: string; value: string; icon: typeof TrendingUp; subtitle?: string; trend?: "up" | "down" | "neutral";
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-2xl p-4"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="p-1.5 rounded-lg bg-primary/10">
        <Icon size={14} className="text-primary" />
      </div>
    </div>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
    {subtitle && (
      <div className="flex items-center gap-1 mt-1">
        {trend === "up" && <ArrowUpRight size={12} className="text-emerald-500" />}
        {trend === "down" && <ArrowDownRight size={12} className="text-rose-500" />}
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    )}
  </motion.div>
);

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-2xl p-5"
  >
    <h3 className="font-semibold text-sm mb-4 text-foreground">{title}</h3>
    {children}
  </motion.div>
);

/* ── Item popularity horizontal bar charts ── */
const ItemPopularityCharts = ({ topItems, leastItems, periodLabel }: {
  topItems?: { name: string; qty: number }[];
  leastItems?: { name: string; qty: number }[];
  periodLabel: string;
}) => {
  if ((!topItems || topItems.length === 0) && (!leastItems || leastItems.length === 0)) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {topItems && topItems.length > 0 && (
        <ChartCard title={`🏆 Most Sold - ${periodLabel}`}>
          <ResponsiveContainer width="100%" height={topItems.length * 52 + 20}>
            <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="qty" name="Quantity Sold" radius={[0, 6, 6, 0]} barSize={24}>
                {topItems.map((_, i) => (
                  <Cell key={i} fill={TOP_COLORS[i % TOP_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {leastItems && leastItems.length > 0 && (
        <ChartCard title={`📉 Least Sold - ${periodLabel}`}>
          <ResponsiveContainer width="100%" height={leastItems.length * 52 + 20}>
            <BarChart data={leastItems} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="qty" name="Quantity Sold" radius={[0, 6, 6, 0]} barSize={24}>
                {leastItems.map((_, i) => (
                  <Cell key={i} fill={LEAST_COLORS[i % LEAST_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
};

const SalesAnalyticsTabs = () => {
  const [activeTab, setActiveTab] = useState<SalesReportType>("daily");
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "dine-in" | "takeaway" | "delivery">("all");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeTab === "daily") params.date = selectedDate;
      if (activeTab === "monthly") {
        params.year = String(selectedYear);
        params.month = String(selectedMonth);
      }
      if (activeTab === "yearly") params.year = String(selectedYear);
      if (orderTypeFilter !== "all") params.orderType = orderTypeFilter;

      const result = await apiGetSalesReport(activeTab, params);
      setData(result);
    } catch (err) {
      console.error("Failed to fetch sales analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate, selectedYear, selectedMonth, orderTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const refresh = () => fetchData();
    socket.on("new-order", refresh);
    socket.on("order-updated", refresh);
    socket.on("payment-updated", refresh);
    return () => {
      socket.off("new-order", refresh);
      socket.off("order-updated", refresh);
      socket.off("payment-updated", refresh);
    };
  }, [fetchData]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const formatDay = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

  const aov = data && data.totalOrders > 0
    ? Math.round(data.totalRevenue / data.totalOrders)
    : 0;

  const getPeriodLabel = () => {
    if (activeTab === "daily") return selectedDate;
    if (activeTab === "weekly") return "This Week";
    if (activeTab === "monthly") return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
    return String(selectedYear);
  };

  return (
    <div className="space-y-5">
      {/* Period Tabs */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {activeTab === "daily" && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm"
          />
        )}
        {(activeTab === "monthly" || activeTab === "yearly") && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
        {activeTab === "monthly" && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        )}
        {/* Order Type Filter */}
        <div className="flex gap-1.5 items-center">
          {(["all", "dine-in", "takeaway", "delivery"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                orderTypeFilter === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "all" ? "All Types" : t === "dine-in" ? "Dine-in" : t === "takeaway" ? "Takeaway" : "Delivery"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </motion.div>
        ) : !data ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-16 text-muted-foreground">
            No data available for this period
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard title="Total Orders" value={String(data.totalOrders)} icon={ShoppingCart} />
              <StatCard title="Total Revenue" value={`₹${data.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} />
              <StatCard title="Avg Order Value" value={`₹${aov.toLocaleString("en-IN")}`} icon={TrendingUp} />
              {activeTab === "daily" && data.paidRevenue !== undefined && (
                <StatCard
                  title="Paid / Pending"
                  value={`₹${data.paidRevenue.toLocaleString("en-IN")}`}
                  icon={IndianRupee}
                  subtitle={`₹${(data.pendingRevenue ?? 0).toLocaleString("en-IN")} pending`}
                  trend={data.pendingRevenue && data.pendingRevenue > 0 ? "down" : "up"}
                />
              )}
              {activeTab === "weekly" && (
                <StatCard
                  title="Week Range"
                  value={`${data.weekStart ? formatDay(data.weekStart) : "-"}`}
                  icon={CalendarRange}
                  subtitle={`to ${data.weekEnd ? formatDay(data.weekEnd) : "-"}`}
                />
              )}
              {(activeTab === "monthly" || activeTab === "yearly") && (
                <StatCard
                  title="Period"
                  value={activeTab === "monthly" ? MONTHS[selectedMonth - 1] : String(selectedYear)}
                  icon={Calendar}
                  subtitle={activeTab === "monthly" ? String(selectedYear) : "Full Year"}
                />
              )}
            </div>

            {/* Item Popularity Charts */}
            <ItemPopularityCharts
              topItems={data.topItems}
              leastItems={data.leastItems}
              periodLabel={getPeriodLabel()}
            />

            {/* Period-specific Charts */}
            {renderCharts(activeTab, data, formatDay)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function renderCharts(
  type: SalesReportType,
  data: SalesReportData,
  formatDay: (d: string) => string
) {
  if (type === "weekly" && data.days && data.days.length > 0) {
    const chartData = data.days.map((d) => ({
      day: formatDay(d.date),
      Orders: d.orders,
      Revenue: d.revenue,
    }));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily Orders This Week">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily Revenue This Week">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="weekRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Revenue" stroke="hsl(142 71% 45%)" fill="url(#weekRevGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  if (type === "monthly" && data.days && data.days.length > 0) {
    const chartData = data.days.map((d) => ({
      day: formatDay(d.date),
      Orders: d.orders,
      Revenue: d.revenue,
    }));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Orders Trend (This Month)">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="monthOrdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Orders" stroke="hsl(var(--primary))" fill="url(#monthOrdGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue Trend (This Month)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Revenue" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 71% 45%)", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  if (type === "yearly" && data.months && data.months.length > 0) {
    const chartData = data.months.map((m) => ({
      month: m.month,
      Orders: m.orders,
      Revenue: m.revenue,
    }));

    return (
      <ChartCard title="Monthly Breakdown">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
            <Bar yAxisId="left" dataKey="Orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={28} />
            <Line yAxisId="right" type="monotone" dataKey="Revenue" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 71% 45%)", r: 3 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (type === "daily") {
    if (data.totalOrders === 0) return null;

    const paidPct = data.totalRevenue > 0
      ? Math.round(((data.paidRevenue ?? 0) / data.totalRevenue) * 100)
      : 0;
    const pendingPct = 100 - paidPct;

    // Hourly data - fill all 24 hours
    const hourMap = new Map((data.hourlyDistribution || []).map((h) => [h.hour, h]));
    const formatHour = (h: number) => {
      if (h === 0) return "12 AM";
      if (h < 12) return `${h} AM`;
      if (h === 12) return "12 PM";
      return `${h - 12} PM`;
    };
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: formatHour(i),
      Orders: hourMap.get(i)?.orders || 0,
      Revenue: hourMap.get(i)?.revenue || 0,
    }));

    // Payment split
    const paymentData = (data.paymentSplit || []).map((p) => ({
      name: p.method === "counter" ? "Counter" : p.method === "online" ? "Online" : p.method,
      value: p.count,
      revenue: p.revenue,
      color: p.method === "counter" ? "hsl(38 92% 50%)" : "hsl(142 71% 45%)",
    }));

    return (
      <div className="space-y-4">
        {/* Hourly Orders Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Hourly Orders Distribution">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Hourly Revenue Trend">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="dailyRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke="hsl(142 71% 45%)" fill="url(#dailyRevGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Revenue Breakdown + Payment Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Revenue Breakdown">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid Revenue</span>
                  <span className="font-semibold" style={{ color: "hsl(142 71% 45%)" }}>₹{(data.paidRevenue ?? 0).toLocaleString("en-IN")} ({paidPct}%)</span>
                </div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${paidPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: "hsl(142 71% 45%)" }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Revenue</span>
                  <span className="font-semibold" style={{ color: "hsl(38 92% 50%)" }}>₹{(data.pendingRevenue ?? 0).toLocaleString("en-IN")} ({pendingPct}%)</span>
                </div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pendingPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    className="h-full rounded-full"
                    style={{ background: "hsl(38 92% 50%)" }}
                  />
                </div>
              </div>
            </div>
          </ChartCard>

          {paymentData.length > 0 && (
            <ChartCard title="Payment Method Split">
              <div className="flex items-center gap-6">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {paymentData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {paymentData.map((p) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.value} orders • ₹{p.revenue.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default SalesAnalyticsTabs;
