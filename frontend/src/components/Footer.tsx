import { useLocationContent } from "@/hooks/useLocationContent";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const Footer = () => {
  const { settings } = useBusinessSettings();
  const location = useLocationContent();
  const status = useRestaurantStatus(location);

  return (
    <footer className="bg-chocolate text-cream dark:text-foreground">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="max-w-sm">
            <h3 className="font-heading text-2xl font-bold tracking-wide mb-4">
              {settings?.restaurantName || "Classic Chinese"}
            </h3>

            <p className="text-cream/70 dark:text-muted-foreground text-sm leading-relaxed">
              {settings?.address || "Authentic Chinese cuisine. Crafted fresh, balanced perfectly with traditional recipes."}
            </p>
          </div>

          {/* Explore */}
          <div className="md:mx-auto">
            <h4 className="font-heading text-base font-semibold mb-4 tracking-wide">
              Explore
            </h4>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {["Home", "About", "Menu", "Gallery", "Reviews", "Contact"].map(
                (l) => (
                  <a
                    key={l}
                    href={`#${l.toLowerCase()}`}
                    className="text-cream/70 dark:text-muted-foreground hover:text-secondary transition"
                  >
                    {l}
                  </a>
                ),
              )}
            </div>
          </div>

          {/* Hours */}
          {/* Hours */}
          <div className="md:text-right">
            <h4 className="font-heading text-base font-semibold mb-4 tracking-wide">
              Opening Hours
            </h4>

            {location ? (
              <div className="space-y-1 text-sm">
                {/* Hours */}
                <div className="space-y-1 text-secondary font-semibold">
                  {location.opening_hours_display.split("•").map((line, i) => (
                    <p key={i}>{line.trim()}</p>
                  ))}
                </div>

                {/* Status */}
                {/* <p
                  className={`text-xs font-semibold ${
                    status.open ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {status.message}
                </p> */}
              </div>
            ) : (
              <p className="text-cream/70 text-sm">Loading hours...</p>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-cream/10 dark:border-border mt-10 pt-5 flex flex-col md:flex-row justify-between items-center text-xs text-cream/50 dark:text-muted-foreground">
          <p>© {new Date().getFullYear()} {settings?.restaurantName || "Classic Chinese"}. All rights reserved.</p>

          <p className="mt-2 md:mt-0 uppercase tracking-wide">
            {settings?.phone && `Connect with us: ${settings.phone}`}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
