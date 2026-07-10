import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Crown, ShoppingBag, Sparkles, Loader2, UserCheck, UserX,
  TrendingUp,
} from "lucide-react";
import {
  apiGetCustomerAnalytics,
  type CustomerAnalytics as CustomerAnalyticsType,
} from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(262 83% 58%)",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("spent")
            ? `₹${p.value.toLocaleString("en-IN")}`
            : p.value}
        </p>
      ))}
    </div>
  );
};

// const maskPhone = (phone: string) =>
//   phone.length > 4 ? phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4) : phone;

const CustomerAnalytics = () => {
  const [data, setData] = useState<CustomerAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "spend" | "variety">("orders");

  const fetch = async () => {
    try {
      const result = await apiGetCustomerAnalytics();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch customer analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const refresh = () => fetch();
    socket.on("new-order", refresh);
    socket.on("order-updated", refresh);
    return () => {
      socket.off("new-order", refresh);
      socket.off("order-updated", refresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  if (!data || data.totalCustomers === 0) {
    return (
      <div className="text-center py-12">
        <Users size={40} className="mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">No customer data yet</p>
        <p className="text-muted-foreground/60 text-sm mt-1">
          Customer analytics will appear once orders are placed
        </p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Customers",
      value: data.totalCustomers,
      icon: Users,
      gradient: "from-primary/15 to-primary/5",
      iconColor: "text-primary",
      border: "border-primary/20",
    },
    {
      label: "Avg Orders / Customer",
      value: data.avgOrdersPerCustomer,
      icon: TrendingUp,
      gradient: "from-emerald-500/15 to-emerald-500/5",
      iconColor: "text-emerald-500",
      border: "border-emerald-500/20",
    },
    {
      label: "Repeat Customers",
      value: data.repeatCustomers,
      icon: UserCheck,
      gradient: "from-amber-500/15 to-amber-500/5",
      iconColor: "text-amber-500",
      border: "border-amber-500/20",
    },
    {
      label: "One-time Customers",
      value: data.oneTimeCustomers,
      icon: UserX,
      gradient: "from-rose-500/15 to-rose-500/5",
      iconColor: "text-rose-500",
      border: "border-rose-500/20",
    },
  ];

  const repeatPieData = [
    { name: "Repeat", value: data.repeatCustomers, color: CHART_COLORS[1] },
    { name: "One-time", value: data.oneTimeCustomers, color: CHART_COLORS[2] },
  ];

  const tabs = [
    { key: "orders" as const, label: "By Orders", icon: ShoppingBag },
    { key: "spend" as const, label: "By Spend", icon: Crown },
    { key: "variety" as const, label: "By Variety", icon: Sparkles },
  ];

  const activeList =
    tab === "orders"
      ? data.topByOrders
      : tab === "spend"
      ? data.topBySpend
      : null;

  const barData =
    tab === "variety"
      ? data.topByVariety.map((c) => ({
          name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
          "Unique Items": c.uniqueItems,
          Orders: c.totalOrders,
        }))
      : (activeList || []).map((c) => ({
          name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
          Orders: c.totalOrders,
          "Total Spent": c.totalSpent,
        }));

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Users size={18} className="text-primary" />
        <h3 className="text-lg font-bold">Customer Analytics</h3>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-gradient-to-br ${card.gradient} border ${card.border} rounded-2xl p-4`}
          >
            <div className={`p-1.5 rounded-lg bg-background/60 w-fit mb-2 ${card.iconColor}`}>
              <card.icon size={16} />
            </div>
            <p className="text-xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Top Customers Chart + Repeat Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 10 Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h4 className="font-semibold text-sm">Top 10 Customers</h4>
            <div className="flex gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <t.icon size={12} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip content={<CustomTooltip />} />
              {tab === "variety" ? (
                <>
                  <Bar dataKey="Unique Items" fill={CHART_COLORS[3]} radius={[0, 6, 6, 0]} barSize={18} />
                  <Bar dataKey="Orders" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} barSize={18} />
                </>
              ) : (
                <Bar
                  dataKey={tab === "spend" ? "Total Spent" : "Orders"}
                  fill={tab === "spend" ? CHART_COLORS[1] : CHART_COLORS[0]}
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Repeat vs One-time Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <h4 className="font-semibold text-sm mb-3">Repeat vs One-time</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={repeatPieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {repeatPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 mt-2">
            {repeatPieData.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-muted-foreground">
                  {p.name} ({p.value})
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-2xl p-5 overflow-x-auto"
      >
        <h4 className="font-semibold text-sm mb-3">
          {tab === "variety" ? "Top 10 by Menu Variety" : tab === "spend" ? "Top 10 by Spend" : "Top 10 by Orders"}
        </h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 pr-4 font-medium">#</th>
              <th className="text-left py-2 pr-4 font-medium">Customer</th>
              <th className="text-left py-2 pr-4 font-medium">Phone</th>
              <th className="text-right py-2 pr-4 font-medium">Orders</th>
              {tab === "variety" ? (
                <th className="text-right py-2 font-medium">Unique Items</th>
              ) : (
                <th className="text-right py-2 font-medium">Total Spent</th>
              )}
            </tr>
          </thead>
          <tbody>
            {(tab === "variety" ? data.topByVariety : (activeList || [])).map((c, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                <td className="py-2.5 pr-4 font-medium truncate max-w-[140px]">{c.name}</td>
                <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">
                  {(c.phone)}
                </td>
                <td className="py-2.5 pr-4 text-right">{c.totalOrders}</td>
                {tab === "variety" ? (
                  <td className="py-2.5 text-right font-semibold">
                    {"uniqueItems" in c ? c.uniqueItems : "—"}
                  </td>
                ) : (
                  <td className="py-2.5 text-right font-semibold">
                    {"totalSpent" in c ? `₹${c.totalSpent.toLocaleString("en-IN")}` : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default CustomerAnalytics;
