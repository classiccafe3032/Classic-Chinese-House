import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Trash2,
  Star,
  MessageSquare,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  CheckSquare,
} from "lucide-react";
import {
  apiAdminSearchReviews,
  apiAdminDeleteReview,
  apiAdminBulkDeleteReviews,
  type Review,
} from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 15;

type SortField = "date" | "rating" | "name" | "item";
type SortDir = "desc" | "asc";
type RatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

const ReviewManagement = () => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters & sort
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiAdminSearchReviews(debouncedSearch, 200, 0);
      setReviews(data.reviews);
      setTotal(data.total);
      setSelectedIds(new Set());
    } catch {
      toast({ title: "Error", description: "Failed to load reviews", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, toast]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Client-side filter + sort
  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    if (ratingFilter !== "all") {
      const r = parseInt(ratingFilter);
      result = result.filter((rev) => rev.rating === r);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "rating":
          cmp = a.rating - b.rating;
          break;
        case "name":
          cmp = a.reviewerName.localeCompare(b.reviewerName);
          break;
        case "item":
          cmp = a.itemName.localeCompare(b.itemName);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [reviews, ratingFilter, sortField, sortDir]);

  // Paginate filtered
  const paginatedReviews = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredReviews.slice(start, start + PAGE_SIZE);
  }, [filteredReviews, page]);

  const totalPages = Math.ceil(filteredReviews.length / PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [ratingFilter, sortField, sortDir]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiAdminDeleteReview(deleteTarget.id as number);
      toast({ title: "Deleted", description: `Review by ${deleteTarget.reviewerName} removed` });
      setDeleteTarget(null);
      fetchReviews();
    } catch {
      toast({ title: "Error", description: "Failed to delete review", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await apiAdminBulkDeleteReviews(ids);
      toast({ title: "Deleted", description: `${ids.length} reviews removed` });
      setBulkDeleteOpen(false);
      fetchReviews();
    } catch {
      toast({ title: "Error", description: "Failed to bulk delete", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedReviews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedReviews.map((r) => r.id as number)));
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-primary" />
          <h2 className="text-lg font-bold">Review Management</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredReviews.length} of {total}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by item, name, or text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-base md:text-sm"
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
              {/* Rating filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Rating:</span>
                <div className="flex gap-1">
                  {(["all", "5", "4", "3", "2", "1"] as RatingFilter[]).map((r) => (
                    <Button
                      key={r}
                      variant={ratingFilter === r ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setRatingFilter(r)}
                    >
                      {r === "all" ? "All" : (
                        <span className="flex items-center gap-0.5">
                          {r} <Star size={10} className="fill-yellow-400 text-yellow-400" />
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Sort:</span>
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="name">Reviewer</SelectItem>
                    <SelectItem value="item">Item</SelectItem>
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

              {/* Active filters */}
              {ratingFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs"
                  onClick={() => setRatingFilter("all")}
                >
                  {ratingFilter}★ filter ✕
                </Badge>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
              <CheckSquare size={16} className="text-destructive" />
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 size={14} className="mr-1" />
                Delete Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : paginatedReviews.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No reviews found</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            {debouncedSearch || ratingFilter !== "all" ? "Try adjusting your filters" : "No reviews yet"}
          </p>
        </div>
      ) : (
        <>
          {/* Select all toggle */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <Checkbox
              checked={selectedIds.size === paginatedReviews.length && paginatedReviews.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Select all on page</span>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {paginatedReviews.map((review) => (
                <motion.div
                  key={review.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className={`bg-card border rounded-xl p-4 flex items-start gap-3 group transition-colors ${
                    selectedIds.has(review.id as number)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(review.id as number)}
                    onCheckedChange={() => toggleSelect(review.id as number)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{review.reviewerName}</span>
                      {renderStars(review.rating)}
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {review.itemName}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{review.reviewText}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => setDeleteTarget(review)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Delete Review
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete review by <strong>{deleteTarget?.reviewerName}</strong> on <strong>{deleteTarget?.itemName}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Delete {selectedIds.size} Reviews
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{selectedIds.size}</strong> selected reviews? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size} Reviews`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReviewManagement;
