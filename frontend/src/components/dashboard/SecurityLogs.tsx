import { useState, useEffect, useCallback, useMemo } from "react";
import { Shield, RefreshCw, Search, AlertTriangle, ChevronLeft, ChevronRight, Filter, ArrowUpDown } from "lucide-react";
import { apiGetLoginLogs } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format, isToday, isThisWeek, isThisMonth } from "date-fns";

interface LoginLog {
  success: boolean;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

type StatusFilter = "all" | "success" | "failed";
type DateFilter = "all" | "today" | "week" | "month";
type SortField = "date" | "ip" | "status";
type SortDir = "desc" | "asc";

const PAGE_SIZE = 25;

const SecurityLogs = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await apiGetLoginLogs();
      setLogs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFilter, sortField, sortDir]);

  const suspiciousIps = useMemo(() => {
    const fails: Record<string, number> = {};
    logs.forEach((l) => {
      if (!l.success) fails[l.ip_address] = (fails[l.ip_address] || 0) + 1;
    });
    return new Set(Object.entries(fails).filter(([, c]) => c >= 3).map(([ip]) => ip));
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs.filter((l) => {
      if (statusFilter === "success" && !l.success) return false;
      if (statusFilter === "failed" && l.success) return false;

      if (dateFilter !== "all") {
        const d = new Date(l.created_at);
        if (dateFilter === "today" && !isToday(d)) return false;
        if (dateFilter === "week" && !isThisWeek(d)) return false;
        if (dateFilter === "month" && !isThisMonth(d)) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          l.ip_address.toLowerCase().includes(q) ||
          l.user_agent.toLowerCase().includes(q) ||
          (l.success ? "success" : "failed").includes(q)
        );
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === "ip") cmp = a.ip_address.localeCompare(b.ip_address);
      else if (sortField === "status") cmp = Number(a.success) - Number(b.success);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [logs, search, statusFilter, dateFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  return (
    <div className="container mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          <h2 className="text-lg font-bold">Login Security Logs</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filtered.length} of {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search IP, device, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter size={16} className="mr-1" />
            Filters
          </Button>
          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="h-9 px-3 rounded-xl bg-card border border-border text-foreground/70 hover:bg-muted transition-all flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex flex-wrap items-center gap-3 bg-muted/50 border border-border rounded-xl p-3">
              {/* Status filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Status:</span>
                <div className="flex gap-1">
                  {(["all", "success", "failed"] as StatusFilter[]).map((s) => (
                    <Button
                      key={s}
                      variant={statusFilter === s ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === "all" ? "All" : s === "success" ? "✓ Success" : "✕ Failed"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Date filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Period:</span>
                <div className="flex gap-1">
                  {([
                    { key: "all", label: "All Time" },
                    { key: "today", label: "Today" },
                    { key: "week", label: "This Week" },
                    { key: "month", label: "This Month" },
                  ] as { key: DateFilter; label: string }[]).map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={dateFilter === key ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDateFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Sort:</span>
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="ip">IP Address</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  <ArrowUpDown size={14} className={sortDir === "asc" ? "rotate-180" : ""} />
                  <span className="text-xs ml-1">{sortDir === "asc" ? "Asc" : "Desc"}</span>
                </Button>
              </div>

              {/* Active filter badges */}
              {statusFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs"
                  onClick={() => setStatusFilter("all")}
                >
                  {statusFilter === "success" ? "✓ Success" : "✕ Failed"} ✕
                </Badge>
              )}
              {dateFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs"
                  onClick={() => setDateFilter("all")}
                >
                  {dateFilter === "today" ? "Today" : dateFilter === "week" ? "This Week" : "This Month"} ✕
                </Badge>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={36} className="text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">
            {logs.length === 0 ? "No login activity recorded yet" : "No logs match your filters"}
          </p>
          {logs.length > 0 && (
            <button
              onClick={() => { setStatusFilter("all"); setDateFilter("all"); setSearch(""); }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </motion.div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Device / Browser</TableHead>
                  <TableHead className="text-right">Date & Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {paginated.map((log, i) => (
                    <motion.tr
                      key={`${log.created_at}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b last:border-0 transition-colors hover:bg-muted/50"
                    >
                      <TableCell>
                        <Badge className={log.success
                          ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20"
                          : "bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20"
                        }>
                          {log.success ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <span className="flex items-center gap-1.5">
                          {log.ip_address}
                          {suspiciousIps.has(log.ip_address) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle size={14} className="text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Multiple failed attempts from this IP</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{log.user_agent}</TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </TooltipTrigger>
                            <TooltipContent>{format(new Date(log.created_at), "PPpp")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            <AnimatePresence>
              {paginated.map((log, i) => (
                <motion.div
                  key={`${log.created_at}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge className={log.success
                      ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20"
                      : "bg-destructive/15 text-destructive border-destructive/20"
                    }>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono">{log.ip_address}</span>
                    {suspiciousIps.has(log.ip_address) && (
                      <AlertTriangle size={14} className="text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{log.user_agent}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-all disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "ellipsis" ? (
                      <span key={`e-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-8 min-w-[2rem] rounded-lg text-xs font-medium transition-all ${
                          page === p
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-card border border-border text-foreground/70 hover:bg-muted"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-all disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SecurityLogs;
