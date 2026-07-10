import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { apiGetActivePromotion } from "@/lib/apiClient";
import { socket } from "@/lib/socket";

const PromotionBanner = () => {
  const [promotion, setPromotion] = useState<{
    id: number;
    message: string;
    expires_at: string;
  } | null>(null);

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loadPromotion = () => {
      apiGetActivePromotion()
        .then((p) => {
          setPromotion(p);
          setDismissed(false);
        })
        .catch(() => {});
    };

    loadPromotion();

    socket.on("promotion-updated", loadPromotion);

    return () => {
      socket.off("promotion-updated", loadPromotion);
    };
  }, []);

  useEffect(() => {
    if (!promotion) return;

    const ms = new Date(promotion.expires_at).getTime() - Date.now();

    if (ms <= 0) {
      setPromotion(null);
      return;
    }

    const timer = setTimeout(() => {
      setPromotion(null);
    }, ms);

    return () => clearTimeout(timer);
  }, [promotion]);

  if (!promotion || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-50 overflow-hidden bg-gradient-to-r from-primary via-primary/90 to-accent"
      >
        {/* shimmer animation */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        />

        <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-3 relative">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Sparkles size={18} className="text-accent-foreground" />
          </motion.div>

          <motion.span
            className="text-center text-sm md:text-base font-semibold text-primary-foreground"
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {promotion.message}
          </motion.span>

          <motion.div
            animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
          >
            <Sparkles size={18} className="text-accent-foreground" />
          </motion.div>

          <button
            onClick={() => setDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/15 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X size={16} className="text-primary-foreground" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PromotionBanner;