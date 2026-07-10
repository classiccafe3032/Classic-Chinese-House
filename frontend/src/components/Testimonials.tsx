import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import { apiGetLatestReviews, type Review } from "@/lib/apiClient";
import { useIsMobile } from "@/hooks/use-mobile";

const Testimonials = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    setLoading(true);
    apiGetLatestReviews(8)
      .then((data) => { setReviews(data); setCurrent(0); })
      .catch((err) => console.error("Failed to fetch latest reviews:", err))
      .finally(() => setLoading(false));
  }, []);

  // Auto slide
  useEffect(() => {
    if (reviews.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c === reviews.length - 1 ? 0 : c + 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [reviews]);

  const prev = () => {
    setDirection(-1);
    setCurrent((c) => (c === 0 ? reviews.length - 1 : c - 1));
  };

  const next = () => {
    setDirection(1);
    setCurrent((c) => (c === reviews.length - 1 ? 0 : c + 1));
  };

  const floatingConfigs = [
    { top: "8%", left: "6%", duration: 9 },
    { top: "12%", right: "8%", duration: 11 },
    { bottom: "14%", left: "10%", duration: 13 },
    { bottom: "10%", right: "6%", duration: 10 },
    { top: "55%", left: "3%", duration: 12 },
    { top: "58%", right: "3%", duration: 14 },
  ];

  const renderStars = (rating: number, size = 16) =>
    Array.from({ length: rating }).map((_, i) => (
      <Star key={i} className="fill-secondary text-secondary" size={size} />
    ));

  return (
    <section id="testimonials" className="section-padding waffle-pattern relative overflow-hidden">
      {/* Background blobs - desktop only */}
      {!isMobile && (
        <>
          <motion.div
            className="absolute top-[-80px] left-[-80px] w-72 h-72 bg-primary/20 rounded-full blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 60, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[-80px] right-[-80px] w-80 h-80 bg-secondary/20 rounded-full blur-3xl"
            animate={{ x: [0, -50, 0], y: [0, -40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <div className="container mx-auto relative z-10">
        <ScrollReveal>
          <div className="text-center mb-6 md:mb-12">
            <span className="text-secondary font-semibold text-sm uppercase tracking-wider">Reviews</span>
            <h2 className="text-3xl md:text-5xl font-heading font-bold mt-3 mb-4">
              What Our <span className="text-primary">Guests</span> Say
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Real customer reviews straight from our guests 🍜✨
            </p>
          </div>
        </ScrollReveal>

        {/* Floating cards - desktop only */}
        {!loading && reviews.length > 0 && !isMobile && (
          <div className="absolute inset-0 pointer-events-none z-0 hidden md:block">
            {reviews.slice(0, 6).map((review, i) => {
              const cfg = floatingConfigs[i] || floatingConfigs[0];
               return (
                <motion.div
                  key={review.id || i}
                  className="absolute w-64 bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl p-4 shadow-xl"
                  style={{ top: cfg.top, left: cfg.left, right: cfg.right, bottom: cfg.bottom }}
                  animate={{ y: [0, -12, 0], x: [0, 8, 0], rotate: [0, 1.2, 0] }}
                  transition={{ duration: cfg.duration, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="flex items-center gap-1 mb-2">{renderStars(review.rating)}</div>
                  <p className="text-sm text-foreground/90 leading-snug line-clamp-3 italic">"{review.reviewText}"</p>
                  <p className="mt-3 text-xs font-semibold text-primary">- {review.reviewerName}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{review.itemName}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Main card */}
        <ScrollReveal delay={0.2}>
          <div className="max-w-2xl mx-auto relative z-10">
            <div
              className={`rounded-3xl p-6 md:p-12 border border-border shadow-2xl text-center relative overflow-hidden min-h-[260px] md:min-h-[340px] ${
                isMobile ? "bg-card" : "bg-card/70 backdrop-blur-xl"
              }`}
            >
              {/* Shimmer - desktop only */}
              {!isMobile && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ["-120%", "120%"] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                />
              )}

              {loading && <p className="text-muted-foreground text-lg">Loading latest reviews...</p>}
              {!loading && reviews.length === 0 && <p className="text-muted-foreground text-lg">No reviews yet. Be the first review legend.</p>}

              {!loading && reviews.length > 0 && (
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={current}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -60 }}
                    transition={{ duration: 0.3 }}
                    className="relative z-10"
                  >
                    <div className="flex justify-center gap-1 mb-6">{renderStars(reviews[current].rating, 24)}</div>
                    <p className="text-lg md:text-xl text-foreground/90 leading-relaxed mb-6 italic">"{reviews[current].reviewText}"</p>
                    <p className="font-heading font-bold text-primary text-lg">- {reviews[current].reviewerName}</p>
                    <p className="text-sm text-muted-foreground mt-1">{reviews[current].itemName}</p>
                  </motion.div>
                </AnimatePresence>
              )}

              {!loading && reviews.length > 1 && (
                <div className="flex justify-center gap-4 mt-8 relative z-10">
                  <button onClick={prev} className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors shadow-md">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-2">
                    {reviews.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-primary w-6 shadow-lg" : "bg-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <button onClick={next} className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors shadow-md">
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default Testimonials;
