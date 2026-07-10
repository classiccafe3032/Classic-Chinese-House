import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { apiGetGalleryImages, type GalleryImage } from "@/lib/apiClient";
import { socket } from "@/lib/socket";
import ScrollReveal from "./ScrollReveal";

import galleryStorefront from "@/assets/gallery-storefront.jpg";
import galleryMaking from "@/assets/gallery-making.jpg";
import galleryCloseup from "@/assets/gallery-closeup.jpg";
import galleryCounter from "@/assets/gallery-counter.jpg";

import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const FALLBACK_IMAGES: GalleryImage[] = [
  { id: 1, image_url: galleryStorefront, alt_text: "Our Storefront", display_order: 1, created_at: "" },
  { id: 2, image_url: galleryMaking, alt_text: "Preparing Dumplings", display_order: 2, created_at: "" },
  { id: 3, image_url: galleryCloseup, alt_text: "Authentic Chinese Dishes", display_order: 3, created_at: "" },
  { id: 4, image_url: galleryCounter, alt_text: "The Counter", display_order: 4, created_at: "" },
];

const Gallery = () => {
  const { settings } = useBusinessSettings();
  const [images, setImages] = useState<GalleryImage[]>(FALLBACK_IMAGES);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const content = settings?.landingPageContent;

  const fetchGallery = async () => {
    try {
      const data = await apiGetGalleryImages();
      if (data && data.length > 0) {
        setImages(data);
      }
    } catch (err) {
      console.error("Failed to fetch gallery, using fallback images:", err);
    }
  };

  useEffect(() => {
    fetchGallery();

    const handler = () => fetchGallery();

    socket.on("gallery-updated", handler);

    return () => {
      socket.off("gallery-updated", handler);
    };
  }, []);

  const openLightbox = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prev = () =>
    setLightboxIndex((i) =>
      i !== null ? (i - 1 + images.length) % images.length : null
    );
  const next = () =>
    setLightboxIndex((i) =>
      i !== null ? (i + 1) % images.length : null
    );

  if (images.length === 0) return null;

  return (
    <section id="gallery" className="section-padding bg-card">
      <div className="container mx-auto px-2 md:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-6 md:mb-12">
            <span className="text-secondary font-semibold text-sm uppercase tracking-wider">Gallery</span>
            <h2 
              className="text-3xl md:text-5xl font-heading font-bold mt-3 mb-4"
              dangerouslySetInnerHTML={{ __html: content?.gallery_title || `A Glimpse of <span class='text-primary'>${settings?.restaurantName || "The Chinese House"}</span>` }}
            />
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-4">
          {images.map((img, i) => (
            <ScrollReveal key={img.id} delay={i * 0.08}>
              <div
                className="relative rounded-2xl overflow-hidden group cursor-pointer aspect-square"
                onClick={() => openLightbox(i)}
              >
                <img
                  src={img.image_url}
                  alt={img.alt_text || "Gallery image"}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-chocolate/0 group-hover:bg-chocolate/50 transition-colors duration-300 flex items-center justify-center">
                  <span className="text-primary-foreground font-heading font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm md:text-base text-center px-2">
                    {img.alt_text || "Gallery image"}
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition"
              aria-label="Close lightbox"
            >
              <X size={20} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 z-10 w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 z-10 w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition"
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>

            <motion.div
              key={lightboxIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl max-h-[85vh] w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[lightboxIndex].image_url}
                alt={images[lightboxIndex].alt_text || "Gallery image"}
                className="w-full h-full object-contain rounded-2xl"
              />
              <p className="text-center text-muted-foreground mt-4 font-heading font-semibold">
                {images[lightboxIndex].alt_text || "Gallery image"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Gallery;
