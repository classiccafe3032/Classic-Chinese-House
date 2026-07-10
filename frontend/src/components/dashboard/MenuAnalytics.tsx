import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy, TrendingUp, TrendingDown, Loader2, BarChart3,
  Clock, CreditCard, PieChart as PieIcon, Activity, LayoutGrid, LineChart as LineChartIcon, Users,
  UtensilsCrossed,
} from "lucide-react";
import SalesAnalyticsTabs from "./SalesAnalyticsTabs";
import CustomerAnalytics from "./CustomerAnalytics";
import { apiGetMenuAnalytics, type MenuAnalytics as MenuAnalyticsType } from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(262 83% 58%)",
];

const STATUS_COLORS: Record<string, string> = {
  new: "hsl(217 91% 60%)",
  preparing: "hsl(38 92% 50%)",
  ready: "hsl(142 71% 45%)",
  completed: "hsl(var(--primary))",
  cancelled: "hsl(0 84% 60%)",
};

const formatHour = (h: number) => {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
};

const formatDay = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue") ? `₹${p.value.toLocaleString("en-IN")}` : p.value}
        </p>
      ))}
    </div>
  );
};

const MenuAnalytics = () => {
  const [data, setData] = useState<MenuAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"overview" | "sales" | "customers">("overview");

  const fetchAnalytics = async () => {
    try {
      const result = await apiGetMenuAnalytics();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch menu analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const refresh = () => fetchAnalytics();
    socket.on("new-order", refresh);
    socket.on("order-updated", refresh);
    return () => {
      socket.off("new-order", refresh);
      socket.off("order-updated", refresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!data || (!data.mostOrdered && !data.mostProfitable && !data.leastOrdered)) {
    return (
      <div className="text-center py-16">
        <BarChart3 size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">No analytics data yet</p>
        <p className="text-muted-foreground/60 text-sm mt-1">Analytics will appear once orders are placed</p>
      </div>
    );
  }

  const highlightCards = [
    {
      title: "Most Ordered",
      icon: Trophy,
      name: data.mostOrdered?.name || "-",
      value: data.mostOrdered ? `${data.mostOrdered.total_orders} orders` : "-",
      gradient: "from-amber-500/15 to-amber-500/5",
      iconColor: "text-amber-500",
      borderColor: "border-amber-500/20",
    },
    {
      title: "Most Profitable",
      icon: TrendingUp,
      name: data.mostProfitable?.name || "-",
      value: data.mostProfitable ? `₹${Number(data.mostProfitable.total_revenue).toLocaleString("en-IN")}` : "-",
      gradient: "from-emerald-500/15 to-emerald-500/5",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
    },
    {
      title: "Least Ordered",
      icon: TrendingDown,
      name: data.leastOrdered?.name || "-",
      value: data.leastOrdered ? `${data.leastOrdered.total_orders} orders` : "-",
      gradient: "from-rose-500/15 to-rose-500/5",
      iconColor: "text-rose-500",
      borderColor: "border-rose-500/20",
    },
  ];

  // Prepare chart data
  const topItemsData = (data.topItems || []).map((item) => ({
    name: item.name.length > 14 ? item.name.slice(0, 14) + "…" : item.name,
    Orders: item.total_orders,
    Revenue: parseFloat(String(item.total_revenue)),
  }));

  const statusData = (data.statusDistribution || []).map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    color: STATUS_COLORS[s.status] || CHART_COLORS[0],
  }));

  // Fill all 24 hours
  const hourMap = new Map((data.hourlyDistribution || []).map((h) => [h.hour, h.orders]));
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: formatHour(i),
    Orders: hourMap.get(i) || 0,
  }));

  const trendData = (data.weeklyTrend || []).map((d) => ({
    day: formatDay(d.day),
    Orders: d.orders,
    Revenue: d.revenue,
  }));

  const paymentData = (data.paymentSplit || []).map((p) => ({
    name: p.method === "counter" ? "Counter" : p.method === "online" ? "Online" : p.method,
    value: p.count,
    revenue: p.revenue,
    color: p.method === "counter" ? CHART_COLORS[3] : CHART_COLORS[2],
  }));

  const ORDER_TYPE_COLORS: Record<string, string> = {
    "dine-in": "hsl(var(--primary))",
    "takeaway": "hsl(38 92% 50%)",
    "delivery": "hsl(262 83% 58%)",
  };
  const orderTypeData = (data.orderTypeDistribution || []).map((t) => ({
    name: t.type === "dine-in" ? "Dine-in" : t.type === "takeaway" ? "Takeaway" : t.type === "delivery" ? "Delivery" : t.type,
    value: t.count,
    revenue: t.revenue,
    color: ORDER_TYPE_COLORS[t.type] || CHART_COLORS[0],
  }));

  return (
    <div className="container mx-auto px-4 pb-8 space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-primary" />
          <h2 className="text-xl font-bold">Menu Performance & Analytics</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("overview")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              view === "overview"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <LayoutGrid size={14} />
            Overview
          </button>
          <button
            onClick={() => setView("sales")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              view === "sales"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <LineChartIcon size={14} />
            Sales Analytics
          </button>
          <button
            onClick={() => setView("customers")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              view === "customers"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Users size={14} />
            Customers
          </button>
        </div>
      </div>

      {view === "sales" ? (
        <SalesAnalyticsTabs />
      ) : view === "customers" ? (
        <CustomerAnalytics />
      ) : (
        <>

      {/* Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {highlightCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`bg-gradient-to-br ${card.gradient} border ${card.borderColor} rounded-2xl p-5`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-xl bg-background/60 ${card.iconColor}`}>
                <card.icon size={18} />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">{card.title}</span>
            </div>
            <p className="text-lg font-bold truncate" title={card.name}>{card.name}</p>
            <p className="text-sm text-muted-foreground mt-1">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1: Top Items Bar + Order Status Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Items */}
        {topItemsData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-primary" />
              <h3 className="font-semibold text-sm">Top 5 Items by Orders</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topItemsData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Orders" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Order Status Distribution */}
        {statusData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieIcon size={16} className="text-primary" />
              <h3 className="font-semibold text-sm">Order Status Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Charts Row 2: 7-Day Trend + Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-Day Trend */}
        {trendData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-primary" />
              <h3 className="font-semibold text-sm">Last 7 Days Trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                <Area yAxisId="left" type="monotone" dataKey="Orders" stroke="hsl(var(--primary))" fill="url(#gradOrders)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="Revenue" stroke="hsl(142 71% 45%)" fill="url(#gradRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Hourly Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-primary" />
            <h3 className="font-semibold text-sm">Today's Hourly Orders</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                interval={2}
              />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Payment Split + Order Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {paymentData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-primary" />
            <h3 className="font-semibold text-sm">Payment Method Split</h3>
          </div>
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
        </motion.div>
      )}

      {orderTypeData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <UtensilsCrossed size={16} className="text-primary" />
            <h3 className="font-semibold text-sm">Order Type Distribution</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {orderTypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {orderTypeData.map((p) => (
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
        </motion.div>
      )}
      </div>
      </>
      )}
    </div>
  );
};

export default MenuAnalytics;
