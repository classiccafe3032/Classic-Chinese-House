import { useState, useEffect } from "react";
import { apiGetTableAnalytics, apiGetTableHistory, type TableAnalyticsData, type TableHistorySession } from "@/lib/apiClient";
import { Loader2, Calendar, X, ChevronRight, ChevronDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

export default function TableAnalytics() {
  const [data, setData] = useState<TableAnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Date range state
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "all" | "custom">("30days");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Drill-down state
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableHistory, setTableHistory] = useState<TableHistorySession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      let start, end;
      if (dateRange === "today") {
        const today = new Date();
        start = today.toISOString().split("T")[0];
        end = today.toISOString().split("T")[0];
      } else if (dateRange === "custom") {
        start = customStart || undefined;
        end = customEnd || undefined;
      } else if (dateRange !== "all") {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - (dateRange === "7days" ? 7 : 30));
        start = past.toISOString().split("T")[0];
        end = today.toISOString().split("T")[0];
      }
      
      const res = await apiGetTableAnalytics(start, end);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load table analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (tableNumber: string) => {
    setSelectedTable(tableNumber);
    setLoadingHistory(true);
    setTableHistory([]);
    try {
      let start, end;
      if (dateRange !== "all") {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - (dateRange === "7days" ? 7 : 30));
        start = past.toISOString().split("T")[0];
        end = today.toISOString().split("T")[0];
      }
      const history = await apiGetTableHistory(tableNumber, start, end);
      setTableHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.totalOrders, 0);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-heading">Table Analytics</h2>
          <p className="text-sm text-muted-foreground">Track revenue and order volume by physical table.</p>
        </div>
        
        <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-muted p-1 rounded-xl w-full overflow-x-auto">
            {[
              { id: "today", label: "Today" },
              { id: "7days", label: "Last 7 Days" },
              { id: "30days", label: "Last 30 Days" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom" }
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id as any)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  dateRange === range.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 w-full sm:w-auto justify-end">
              <input 
                type="date" 
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
              />
              <span className="text-muted-foreground">to</span>
              <input 
                type="date" 
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
              />
              <button 
                onClick={fetchData}
                disabled={!customStart || !customEnd}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-center">
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          No table data found for the selected period.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-muted-foreground font-medium">Total Table Revenue</p>
              <p className="text-2xl font-bold mt-1">₹{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-muted-foreground font-medium">Total Table Orders</p>
              <p className="text-2xl font-bold mt-1">{totalOrders}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-muted-foreground font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold mt-1">
                ₹{totalOrders > 0 ? Math.round(totalRevenue / totalOrders).toLocaleString() : 0}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-muted-foreground font-medium">Active Tables</p>
              <p className="text-2xl font-bold mt-1">{data.length}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Revenue by Table</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis 
                    dataKey="tableNumber" 
                    tickFormatter={(val) => `T-${val}`}
                    axisLine={false} 
                    tickLine={false} 
                    dy={10}
                    className="text-xs sm:text-sm font-medium"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => `₹${val}`}
                    className="text-xs sm:text-sm"
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--primary)', opacity: 0.1 }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`₹${value}`, 'Revenue']}
                    labelFormatter={(label) => `Table ${label}`}
                  />
                  <Bar 
                    dataKey="totalRevenue" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    name="Revenue" 
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground text-sm">
                    <th className="p-4 font-semibold whitespace-nowrap">Table No.</th>
                    <th className="p-4 font-semibold whitespace-nowrap text-right">Total Sessions</th>
                    <th className="p-4 font-semibold whitespace-nowrap text-right">Total Orders</th>
                    <th className="p-4 font-semibold whitespace-nowrap text-right">Avg Order Value</th>
                    <th className="p-4 font-semibold whitespace-nowrap text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((row) => (
                    <tr 
                      key={row.tableNumber} 
                      onClick={() => handleRowClick(row.tableNumber)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-bold flex items-center gap-2">
                        Table {row.tableNumber}
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                      <td className="p-4 text-right">{row.totalSessions}</td>
                      <td className="p-4 text-right font-medium text-primary">{row.totalOrders}</td>
                      <td className="p-4 text-right">
                        ₹{row.totalOrders > 0 ? Math.round(row.totalRevenue / row.totalOrders).toLocaleString() : 0}
                      </td>
                      <td className="p-4 text-right font-bold text-green-600 dark:text-green-400">
                        ₹{row.totalRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* History Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center p-6 border-b border-border bg-muted/20">
              <div>
                <h3 className="text-xl font-bold font-heading">Table {selectedTable} History</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {dateRange === "7days" ? "Last 7 Days" : dateRange === "30days" ? "Last 30 Days" : "All Time"}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTable(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-background">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : tableHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No sessions found for this table in the selected period.
                </div>
              ) : (
                <div className="space-y-6">
                  {tableHistory.map((session) => (
                    <div key={session.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                      <div 
                        className="flex justify-between items-center cursor-pointer group"
                        onClick={() => toggleSession(session.id)}
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 flex-1">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base group-hover:text-primary transition-colors">{session.customerName || "Anonymous"}</span>
                              {session.customerPhone && session.customerPhone !== "0000000000" && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                  {session.customerPhone}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(session.startTime).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-left sm:text-right sm:mr-4">
                            <p className="text-sm text-muted-foreground">Session Total</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">₹{session.totalBill.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="ml-2 flex items-center justify-center bg-muted/50 w-8 h-8 rounded-full group-hover:bg-muted transition-colors">
                          <motion.div
                            animate={{ rotate: expandedSessions.has(session.id) ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={18} className="text-muted-foreground" />
                          </motion.div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedSessions.has(session.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4 mt-4 border-t border-border/50">
                              {session.orders.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No paid orders found for this session.</p>
                              ) : (
                                <div className="space-y-4">
                                  {session.orders.map((order, idx) => (
                                    <div key={order.orderId} className="bg-muted/30 rounded-lg p-3 text-sm">
                                      <div className="flex justify-between items-center mb-2 font-medium">
                                        <span>Order #{idx + 1}</span>
                                        <span>₹{Number(order.total).toLocaleString()}</span>
                                      </div>
                                      <ul className="space-y-1">
                                        {order.items.map((item, i) => (
                                          <li key={i} className="flex justify-between text-muted-foreground">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span>₹{Number(item.price) * item.quantity}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
