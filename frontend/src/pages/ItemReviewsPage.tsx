import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  Star,
  ArrowLeft,
  Send,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiGetItemReviews, apiAddReview, type Review } from "@/lib/apiClient";
import { useDynamicMenu } from "@/hooks/useDynamicMenu";

type SortType = "latest" | "highest" | "lowest";

const PAGE_SIZE = 6;

/* ⭐ Premium Half Star + Glow Component */
const PremiumStar = ({
  value,
  index,
  size = 18,
}: {
  value: number;
  index: number;
  size?: number;
}) => {
  const fillLevel =
    value >= index + 1 ? 100 : value >= index + 0.5 ? 50 : 0;

  return (
    <motion.div
      className="relative"
      initial={{ scale: 0.9, opacity: 0.6 }}
      animate={{
        scale: fillLevel > 0 ? 1.12 : 1,
        opacity: fillLevel > 0 ? 1 : 0.4,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
    >
      {/* Empty star */}
      <Star size={size} className="text-muted-foreground/30" />

      {/* Filled star overlay */}
      {fillLevel > 0 && (
        <motion.div
          className="absolute top-0 left-0 overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${fillLevel}%` }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <motion.div
            animate={{
              filter: [
                "drop-shadow(0px 0px 0px rgba(255,200,0,0))",
                "drop-shadow(0px 0px 10px rgba(255,200,0,0.65))",
                "drop-shadow(0px 0px 6px rgba(255,200,0,0.45))",
              ],
            }}
            transition={{ duration: 0.8 }}
          >
            <Star size={size} className="fill-secondary text-secondary" />
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

const ReviewSkeleton = () => {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-muted" />
          <div>
            <div className="h-4 w-32 bg-muted rounded-md mb-2" />
            <div className="h-3 w-20 bg-muted rounded-md" />
          </div>
        </div>
        <div className="h-4 w-20 bg-muted rounded-md" />
      </div>

      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded-md" />
        <div className="h-3 w-[90%] bg-muted rounded-md" />
        <div className="h-3 w-[75%] bg-muted rounded-md" />
      </div>
    </div>
  );
};

/* 🎉 Confetti Component */
const ConfettiBurst = () => {
  const pieces = Array.from({ length: 18 });

  return (
    <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-[9999]">
      {pieces.map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            backgroundColor: `hsl(${Math.random() * 360}, 90%, 60%)`,
          }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: (Math.random() - 0.5) * 500,
            y: (Math.random() - 1) * 400,
            rotate: Math.random() * 720,
            scale: Math.random() * 1.2 + 0.4,
          }}
          transition={{
            duration: 1.6,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        />
      ))}
    </div>
  );
};

/* ✅ TS-safe Framer Motion Variants */
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 12,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const ItemReviewsPage = () => {
  const { items: dynamicMenuItems } = useDynamicMenu();
  const ITEMS_LIST = dynamicMenuItems.map((item) => item.name);
  const [searchParams] = useSearchParams();
  const initialItem = searchParams.get("item") || ITEMS_LIST[0] || "";

  const [selectedItem, setSelectedItem] = useState(initialItem);

  // Sync selectedItem if ITEMS_LIST loads asynchronously and selectedItem is empty
  useEffect(() => {
    if (!selectedItem && ITEMS_LIST.length > 0) {
      setSelectedItem(ITEMS_LIST[0]);
    }
  }, [ITEMS_LIST, selectedItem]);

  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("latest");

  const [page, setPage] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; text?: string }>({});

  const fetchReviews = async (item: string) => {
    if (!item?.trim()) return;
    setLoading(true);

    try {
      const data = await apiGetItemReviews(item, 200, 0);

      setAllReviews(data.reviews);
      setTotal(data.summary.reviewCount);
      setAvgRating(data.summary.avgRating);
      setPage(1);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(selectedItem);
  }, [selectedItem]);

  const filteredSortedReviews = useMemo(() => {
    let list = [...allReviews];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (r) =>
          r.reviewerName.toLowerCase().includes(q) ||
          r.reviewText.toLowerCase().includes(q)
      );
    }

    if (sortBy === "latest") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "highest") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "lowest") {
      list.sort((a, b) => a.rating - b.rating);
    }

    return list;
  }, [allReviews, searchText, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSortedReviews.length / PAGE_SIZE)
  );

  const paginatedReviews = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSortedReviews.slice(start, start + PAGE_SIZE);
  }, [filteredSortedReviews, page]);

  const ratingStats = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    allReviews.forEach((r) => {
      counts[r.rating as 1 | 2 | 3 | 4 | 5]++;
    });

    return counts;
  }, [allReviews]);

  const maxCount = Math.max(
    ratingStats[1],
    ratingStats[2],
    ratingStats[3],
    ratingStats[4],
    ratingStats[5],
    1
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: { name?: string; text?: string } = {};

    if (!name.trim() || name.trim().length > 100) {
      errs.name = "Enter a valid name (max 100 chars)";
    }

    if (!text.trim() || text.trim().length > 500) {
      errs.text = "Enter a review (max 500 chars)";
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);

    try {
      await apiAddReview(selectedItem, name, rating, text);

      setSubmitted(true);
      setName("");
      setText("");
      setRating(5);

      await fetchReviews(selectedItem);

      setTimeout(() => setSubmitted(false), 2500);
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* 🎉 Confetti */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ConfettiBurst />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 py-4 px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted hover:bg-muted/70 transition"
            >
              <ArrowLeft size={20} className="text-foreground/80" />
            </Link>

            <div>
              <h1 className="font-heading text-xl md:text-2xl font-extrabold tracking-tight">
                <span className="text-primary">Reviews</span>{" "}
                <span className="text-muted-foreground">& Ratings</span>
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Honest customer feedback for Henny’s items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="px-4 py-2 rounded-xl bg-background border border-border text-sm font-semibold shadow-sm focus:ring-2 focus:ring-ring outline-none max-w-[180px] md:max-w-none truncate"
            >
              {ITEMS_LIST.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8">
          {/* LEFT SIDE (Reviews List) - order 2 on mobile, order 1 on desktop */}
          <div className="order-2 lg:order-1">
            {/* Search + Sort */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="flex items-center gap-2 flex-1 bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                <Search size={18} className="text-muted-foreground" />
                <input
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search reviews by name or text..."
                  className="w-full bg-transparent outline-none text-base md:text-sm"
                />
              </div>

              <div className="flex items-center gap-2 bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                <SlidersHorizontal size={18} className="text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortType);
                    setPage(1);
                  }}
                  className="bg-transparent outline-none text-sm font-semibold"
                >
                  <option value="latest">Latest</option>
                  <option value="highest">Highest Rated</option>
                  <option value="lowest">Lowest Rated</option>
                </select>
              </div>
            </div>

            {/* Reviews Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl md:text-2xl font-bold">
                Customer Reviews
              </h2>

              <span className="text-sm text-muted-foreground">
                {loading ? (
                  <span className="animate-pulse bg-muted rounded-md h-4 w-16 inline-block" />
                ) : (
                  <>
                    {filteredSortedReviews.length} review
                    {filteredSortedReviews.length !== 1 ? "s" : ""}
                  </>
                )}
              </span>
            </div>

            {/* Reviews List */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <ReviewSkeleton key={i} />
                ))}

              {!loading && (
                <AnimatePresence mode="popLayout">
                  {paginatedReviews.map((review) => {
                    const initial =
                      review.reviewerName?.charAt(0)?.toUpperCase() || "U";

                    return (
                      <motion.div
                        key={review.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-extrabold text-primary">
                              {initial}
                            </div>

                            <div>
                              <p className="font-heading font-bold text-foreground text-lg">
                                {review.reviewerName}
                              </p>

                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(review.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-1 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <PremiumStar
                                key={i}
                                index={i}
                                value={review.rating}
                                size={16}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-foreground/80 text-sm leading-relaxed">
                          {review.reviewText}
                        </p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              {!loading && filteredSortedReviews.length === 0 && (
                <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
                  <Star size={48} className="mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">No reviews yet for this item</p>
                  <p className="text-muted-foreground/60 text-sm mt-1">Be the first to share your experience!</p>
                </div>
              )}

              {/* Pagination */}
              {!loading && filteredSortedReviews.length > 0 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/70 transition font-semibold disabled:opacity-50"
                  >
                    <ChevronLeft size={18} />
                    Prev
                  </button>

                  <span className="text-sm font-bold">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/70 transition font-semibold disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* RIGHT SIDE (Summary & Form) - order 1 on mobile, order 2 on desktop */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-[95px] h-fit space-y-6">
            {/* Rating Summary */}
            <motion.div
              key={selectedItem}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm"
            >
              <h3 className="font-heading text-xl font-extrabold mb-1">
                {selectedItem}
              </h3>

              <p className="text-sm text-muted-foreground mb-4">
                Average customer rating
              </p>

              <div className="flex items-center gap-4 mb-6">
                <div className="text-5xl font-black">
                  {avgRating > 0 ? avgRating.toFixed(1) : "-"}
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <PremiumStar
                        key={i}
                        index={i}
                        value={avgRating}
                        size={22}
                      />
                    ))}
                  </div>

                  <div className="text-sm text-muted-foreground font-semibold">
                    {loading ? (
                      <span className="animate-pulse bg-muted rounded-md h-4 w-16 inline-block" />
                    ) : (
                      <>
                        {total} review{total !== 1 ? "s" : ""}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingStats[star as 1 | 2 | 3 | 4 | 5];
                  const percent = (count / maxCount) * 100;

                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="text-sm font-bold w-10">{star}★</span>

                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{
                            duration: 0.7,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          className="h-2 rounded-full bg-secondary"
                        />
                      </div>

                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Write Review Form */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm"
            >
              <h3 className="font-heading text-xl font-bold mb-4">
                Write a Review
              </h3>

              {submitted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-primary/10 text-primary rounded-xl p-3 mb-4 text-sm font-semibold text-center"
                >
                  ✓ Thank you for your review!
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">
                    Your Name *
                  </label>

                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none transition-shadow"
                  />

                  {errors.name && (
                    <p className="text-destructive text-xs mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1.5 block">
                    Rating *
                  </label>

                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1"
                      >
                        <motion.div
                          whileHover={{ scale: 1.35, rotate: 4 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <Star
                            size={36}
                            className={
                              star <= (hoverRating || rating)
                                ? "fill-secondary text-secondary drop-shadow-md"
                                : "text-muted-foreground/30"
                            }
                          />
                        </motion.div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1.5 block">
                    Your Review *
                  </label>

                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Tell us about your experience…"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none transition-shadow resize-none"
                  />

                  <div className="flex justify-between mt-1">
                    {errors.text && (
                      <p className="text-destructive text-xs">{errors.text}</p>
                    )}

                    <span className="text-xs text-muted-foreground ml-auto">
                      {text.length}/500
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting ? "Submitting…" : "Submit Review"}
                </motion.button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemReviewsPage;
