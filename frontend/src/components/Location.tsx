import { MapPin, Phone, Clock, Instagram, Navigation } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import { useLocationContent } from "@/hooks/useLocationContent";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const Location = () => {

  const data = useLocationContent();
  const status = useRestaurantStatus(data);
  const { settings } = useBusinessSettings();

  const openMaps = () => {
    if (!data || !data.map_embed_url) return;

    let url = data.map_embed_url;
    const qMatch = url.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${qMatch[1]}`;
    }

    window.open(url, "_blank");
  };

  if (!data) return null;

  return (
    <section id="contact" className="section-padding bg-card">

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6">

        <ScrollReveal>
          <div className="text-center mb-6 md:mb-12">
            <span className="text-secondary font-semibold text-sm uppercase tracking-wider">
              Visit Us
            </span>

            <h2 className="text-3xl md:text-5xl font-heading font-bold mt-3 mb-4">
              Find <span className="text-primary">{settings?.restaurantName || "The Chinese House"}</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-5 items-start">

          {/* MAP */}

          {data.map_embed_url ? (
            <ScrollReveal direction="left">
              <div className="relative rounded-2xl overflow-hidden shadow-lg border border-border h-[220px] md:h-[440px]">

                <iframe
                  src={data.map_embed_url}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  title="The Chinese House Location"
                />

                <button
                  onClick={openMaps}
                  className="absolute bottom-3 right-3 flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full shadow-lg text-sm font-semibold hover:scale-105 transition"
                >
                  <Navigation size={16} />
                  Directions
                </button>

              </div>
            </ScrollReveal>
          ) : (
            <div className="hidden md:block" />
          )}

          {/* INFO */}

          <ScrollReveal direction="right">

            <div className="space-y-3 md:space-y-5">

              {/* Address */}

              <div className="flex items-start gap-3 p-3 md:p-4 bg-background rounded-xl border border-border">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary/20 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="text-primary w-4 h-4 md:w-[22px] md:h-[22px]" />
                </div>

                <div>
                  <h3 className="font-heading font-bold mb-1">Address</h3>
                  <p className="text-muted-foreground text-sm">{data.address}</p>
                </div>
              </div>

              {/* Phone */}

              <div className="flex items-start gap-3 p-3 md:p-4 bg-background rounded-xl border border-border">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary/20 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="text-primary w-4 h-4 md:w-[22px] md:h-[22px]" />
                </div>

                <div>
                  <h3 className="font-heading font-bold mb-1">Phone</h3>
                  <p className="text-muted-foreground text-sm">{data.phone}</p>
                </div>
              </div>

              {/* Opening Hours */}

              <div className="flex items-start gap-3 p-3 md:p-4 bg-background rounded-xl border border-border">

                <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary/20 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="text-primary w-4 h-4 md:w-[22px] md:h-[22px]" />
                </div>

                <div>

                  <h3 className="font-heading font-bold mb-1">Opening Hours</h3>

                  <p className="text-muted-foreground text-sm">
                    {data.opening_hours_display}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-xs font-semibold">

                    <span
                      className={`w-2 h-2 rounded-full ${
                        status.open ? "bg-green-500" : "bg-red-500"
                      }`}
                    />

                    <span
                      className={
                        status.open ? "text-green-500" : "text-red-500"
                      }
                    >
                      {status.message}
                    </span>

                  </div>

                </div>

              </div>

              {/* Instagram */}

              <div className="flex items-start gap-3 p-3 md:p-4 bg-background rounded-xl border border-border">

                <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary/20 rounded-xl flex items-center justify-center shrink-0">
                  <Instagram className="text-primary w-4 h-4 md:w-[22px] md:h-[22px]" />
                </div>

                <div>
                  <h3 className="font-heading font-bold mb-1">Instagram</h3>
                  <p className="text-muted-foreground text-sm">
                    {data.instagram_handle}
                  </p>
                </div>

              </div>

              <a
                href={data.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-secondary hover:text-secondary-foreground transition-all"
              >
                <Instagram size={18} />
                Follow Us on Instagram
              </a>

            </div>

          </ScrollReveal>

        </div>

      </div>

    </section>
  );
};

export default Location;