import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Star, Share2, Search, UtensilsCrossed, Ban, X } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { apiGetReviewSummary, type ReviewSummary } from "@/lib/apiClient";
import { useDynamicMenu, type DynamicMenuItem } from "@/hooks/useDynamicMenu";
import LazyImage from "./ui/LazyImage";

const ITEMS_PER_PAGE = 6;

const MenuSection = () => {
  const { settings } = useBusinessSettings();
  const content = settings?.landingPageContent;

  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");
  const [summaries, setSummaries] = useState<Record<string, ReviewSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<DynamicMenuItem | null>(null);

  const {
    items: menuItems,
    categories,
    loading: loadingMenu,
  } = useDynamicMenu();

  useEffect(() => {
    apiGetReviewSummary()
      .then(setSummaries)
      .catch(console.error)
      .finally(() => setLoadingSummaries(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [active, search]);

  const shareOnWhatsApp = (item: DynamicMenuItem) => {
    const link = `${window.location.origin}/order?item=${encodeURIComponent(item.slug)}`;

    const text = `🧇 ${item.name} (${item.priceLabel})

${item.desc}

Order here 👇
${link}`;

    const encodedText = encodeURIComponent(text);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const url = isMobile
      ? `whatsapp://send?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.location.href = url;
  };

  const isLoading = loadingSummaries || loadingMenu;

  const filtered = (
    active === "All"
      ? menuItems
      : menuItems.filter((m) => m.category === active)
  )
    .filter((m) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => {
      const rA = summaries[a.name]?.avgRating ?? 0;
      const rB = summaries[b.name]?.avgRating ?? 0;
      return rB - rA;
    });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const paginatedItems = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  return (
    <section id="menu" className="section-padding waffle-pattern">
      <div className="container mx-auto px-2 md:px-6 lg:px-8">

        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-6 md:mb-12">
            <span className="text-secondary font-semibold text-sm uppercase tracking-wider">
              {content?.menu_title || "Our Menu"}
            </span>

            <h2 
              className="text-3xl md:text-5xl font-heading font-bold mt-3 mb-4"
              dangerouslySetInnerHTML={{ 
                __html: content?.menu_main_title || `Signature <span class="text-primary">Dishes</span>` 
              }}
            />

            <p className="text-muted-foreground max-w-md mx-auto">
              {content?.menu_description || "From classic starters to sizzling main courses, every dish is a masterpiece. Sorted by highest ratings."}
            </p>
          </div>
        </ScrollReveal>

        {/* Search */}
        {!isLoading && menuItems.length > 0 && (
          <>
            <ScrollReveal delay={0.05}>
              <div className="max-w-md mx-auto mb-6">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search dishes by name or ingredients..."
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none transition-shadow"
                  />
                </div>
              </div>
            </ScrollReveal>

            {/* Categories */}
            <ScrollReveal delay={0.1}>
              <div
                className="mb-10 overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="flex gap-3 w-max px-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActive(cat)}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                        active === cat
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "bg-card text-foreground/70 hover:bg-muted border border-border"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">

          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl overflow-hidden border border-border"
              >
                <Skeleton className="h-48 w-full rounded-none" />
              </div>
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {paginatedItems.map((item) => {
                const summary = summaries[item.name];

                return (
                  <motion.div
                    key={item.name}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => setSelectedItem(item)}
                    className={`bg-card rounded-2xl overflow-hidden border border-border hover-lift group cursor-pointer flex flex-col h-full ${
                      !item.available ? "opacity-70" : ""
                    }`}
                  >

                    {/* Image */}
                    <div className="relative overflow-hidden h-32 sm:h-48">
                      <LazyImage
                        src={item.image}
                        alt={item.name}
                        category={item.category}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />

                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-secondary text-secondary-foreground px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-bold">
                        {item.priceLabel}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-5 flex flex-col flex-grow">

                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-heading font-bold text-sm sm:text-lg leading-tight line-clamp-1">
                          {item.name}
                        </h3>

                        <button
                          onClick={(e) => { e.stopPropagation(); shareOnWhatsApp(item); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1 sm:gap-2 mb-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              className={
                                summary && i < Math.round(summary.avgRating)
                                  ? "fill-secondary text-secondary"
                                  : "text-muted-foreground/30"
                              }
                            />
                          ))}
                        </div>

                        <span className="text-xs text-muted-foreground">
                          {summary
                            ? `${summary.avgRating} (${summary.reviewCount})`
                            : "No reviews"}
                        </span>
                      </div>

                      <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-2">
                        {item.desc}
                      </p>

                      <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>

                        {!item.available ? (
                          <div className="flex-1 bg-destructive/10 text-destructive py-2 rounded-xl text-xs text-center flex items-center justify-center gap-1">
                            <Ban size={12} /> Out of Stock
                          </div>
                        ) : (
                          <Link
                            to={`/order?item=${encodeURIComponent(item.slug)}`}
                            className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-xs text-center hover:bg-secondary hover:text-secondary-foreground"
                          >
                            Order Now
                          </Link>
                        )}

                        <Link
                          to={`/reviews?item=${encodeURIComponent(item.name)}`}
                          className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted"
                        >
                          Reviews
                        </Link>

                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-10">

            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-40"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  page === i + 1
                    ? "bg-primary text-primary-foreground"
                    : "border border-border"
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>

          </div>
        )}

        {/* Item Detail Modal */}
        <AnimatePresence>
          {selectedItem && (() => {
            const summary = summaries[selectedItem.name];
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedItem(null)}
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                >
                  {/* Close button */}
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
                  >
                    <X size={18} />
                  </button>

                  {/* Image */}
                  <div className="relative h-56 sm:h-72 overflow-hidden">
                    <img
                      src={selectedItem.image}
                      alt={selectedItem.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-bold">
                        {selectedItem.priceLabel}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-5 sm:p-6 space-y-4">
                    <div>
                      <h3 className="font-heading font-bold text-xl sm:text-2xl mb-1">
                        {selectedItem.name}
                      </h3>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {selectedItem.category}
                      </span>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={
                              summary && i < Math.round(summary.avgRating)
                                ? "fill-secondary text-secondary"
                                : "text-muted-foreground/30"
                            }
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {summary
                          ? `${summary.avgRating} (${summary.reviewCount} reviews)`
                          : "No reviews yet"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {selectedItem.desc}
                    </p>

                    {/* Availability */}
                    {!selectedItem.available && (
                      <div className="bg-destructive/10 text-destructive py-2 px-3 rounded-xl text-sm flex items-center gap-2">
                        <Ban size={14} /> Currently out of stock
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      {selectedItem.available ? (
                        <Link
                          to={`/order?item=${encodeURIComponent(selectedItem.slug)}`}
                          className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold text-center hover:bg-secondary hover:text-secondary-foreground transition-colors"
                        >
                          Order Now
                        </Link>
                      ) : (
                        <div className="flex-1 bg-muted text-muted-foreground py-3 rounded-xl text-sm font-semibold text-center cursor-not-allowed">
                          Unavailable
                        </div>
                      )}
                      <Link
                        to={`/reviews?item=${encodeURIComponent(selectedItem.name)}`}
                        className="px-5 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Reviews
                      </Link>
                      <button
                        onClick={() => shareOnWhatsApp(selectedItem)}
                        className="px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

      </div>
    </section>
  );
};

export default MenuSection;