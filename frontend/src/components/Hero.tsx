import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import BackgroundOrbs from "./BackgroundOrbs";
import { apiGetHeroContent, type HeroContent } from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import { Skeleton } from "@/components/ui/skeleton";
import LazyImage from "./ui/LazyImage";

const Hero = () => {
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [loading, setLoading] = useState(true);

  const DEFAULT_HERO = {
    id: 1,
    location_tag: "🍜Pune",
    title: "Authentic <span>Chinese Cuisine</span> in Pune",
    description: "Traditional flavors. Sizzling wok dishes. Fresh ingredients. Experience the finest culinary journey at The Chinese House.",
    image_url: null,
  };

  useEffect(() => {
    apiGetHeroContent()
      .then(setHero)
      .catch((err) => {
        console.warn("Failed to fetch hero content, using fallback:", err);
        setHero(DEFAULT_HERO);
      })
      .finally(() => setLoading(false));

    const handleUpdate = () => {
      apiGetHeroContent()
        .then(setHero)
        .catch(() => { });
    };
    socket.on("hero-updated", handleUpdate);
    return () => {
      socket.off("hero-updated", handleUpdate);
    };
  }, []);

  if (loading) {
    return (
      <section id="home" className="relative min-h-[70vh] md:min-h-screen flex items-center overflow-hidden">
        <BackgroundOrbs showShimmer />
        <div className="container mx-auto grid md:grid-cols-2 gap-4 md:gap-8 items-center pt-20 pb-8 md:pt-24 md:pb-12 px-4 relative z-10">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48 rounded-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-5 w-full max-w-lg" />
            <Skeleton className="h-5 w-2/3 max-w-lg" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-12 w-36 rounded-2xl" />
              <Skeleton className="h-12 w-36 rounded-2xl" />
            </div>
          </div>
          <Skeleton className="h-[280px] md:h-[500px] w-full rounded-3xl" />
        </div>
      </section>
    );
  }

  const activeHero = (hero && hero.title) ? hero : DEFAULT_HERO;

  const locationTag = activeHero.location_tag || DEFAULT_HERO.location_tag;
  const titleRaw = activeHero.title || DEFAULT_HERO.title;
  const description = activeHero.description || DEFAULT_HERO.description;
  const image = activeHero.image_url;

  const activeTableQr = localStorage.getItem("activeTableQr");
  const orderLink = activeTableQr ? `/table/${activeTableQr}` : "/order";
  const orderText = activeTableQr ? "Return to Table" : "Order Now";

  // Parse title: replace <span>...</span> with gradient span
  const renderTitle = () => {
    const parts = titleRaw.split(/(<span>.*?<\/span>)/g);
    return parts.map((part, i) => {
      const match = part.match(/^<span>(.*)<\/span>$/);
      if (match) {
        return <span key={i} className="text-gradient">{match[1]}</span>;
      }
      return part;
    });
  };

  return (
    <section id="home" className="relative min-h-[70vh] md:min-h-screen flex items-center overflow-hidden">
      <BackgroundOrbs showShimmer />

      <div className="container mx-auto grid md:grid-cols-2 gap-4 md:gap-8 items-center pt-20 pb-8 md:pt-24 md:pb-12 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 bg-secondary/20 text-secondary-foreground dark:text-secondary px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
          >
            <Sparkles size={14} className="text-secondary" />
            {locationTag}
          </motion.span>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading font-black leading-tight mb-4 md:mb-6">
            {renderTitle()}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-5 md:mb-8 leading-relaxed">
            {description}
          </p>
          <div className="flex flex-row gap-3 sm:gap-4 w-full">
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="#menu"
              className="flex-1 sm:flex-none block text-center bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-2 sm:px-8 py-3 sm:py-3.5 rounded-2xl font-semibold text-sm sm:text-lg shadow-lg shadow-primary/20 animate-pulse-glow"
            >
              View Menu
            </motion.a>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
              <Link
                to={orderLink}
                className="block text-center border-2 border-primary text-primary px-2 sm:px-8 py-3 sm:py-3.5 rounded-2xl font-semibold text-sm sm:text-lg hover:bg-primary hover:text-primary-foreground transition-all"
              >
                {orderText}
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl">
            <LazyImage
              src={image}
              alt="Delicious Asian cuisine at The Chinese House"
              className="w-full h-[280px] md:h-[500px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/30 rounded-full blur-2xl animate-pulse-glow" />
          <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/20 rounded-full blur-xl animate-pulse-glow" style={{ animationDelay: "2s" }} />
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
