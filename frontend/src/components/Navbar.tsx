import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const sectionIds = ["home", "about", "menu", "gallery", "contact"];

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Menu", href: "#menu" },
  { label: "Gallery", href: "#gallery" },
  { label: "Reviews", href: "/reviews", isRoute: true },
  { label: "Gift Voucher", href: "/gift-voucher", isRoute: true },
  { label: "Contact", href: "#contact" },
] as const;

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [showNav, setShowNav] = useState(true);
  const { settings } = useBusinessSettings();

  const navRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);

  const isActive = (href: string) => href === `#${activeSection}`;

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;

      setScrolled(currentScroll > 40);

      if (currentScroll > lastScrollY.current && currentScroll > 120) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }

      lastScrollY.current = currentScroll;

      let current = "home";

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) {
          current = id;
        }
      }

      setActiveSection(current);
      setOpen(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
  }, [open]);

  return (
    <>
      <nav
        className={`fixed top-4 left-0 right-0 z-50 flex justify-center transition-transform duration-300 ${
          showNav ? "translate-y-0" : "-translate-y-[120%]"
        }`}
      >
        <div
          ref={navRef}
          className={`w-[92%] max-w-6xl px-6 py-3 rounded-2xl border transition-all duration-300 ${
            scrolled
              ? "bg-white/70 dark:bg-black/60 backdrop-blur-xl shadow-lg border-white/20"
              : "bg-white/40 dark:bg-black/40 backdrop-blur-lg border-transparent"
          }`}
        >
          <div className="flex items-center justify-between">

            {/* Logo */}
            <a
              href="#home"
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
              className="font-heading text-xl font-bold text-primary"
            >
              {settings?.restaurantName || "Classic Chinese"}
            </a>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks
                .filter((l) => l.href !== "/gift-voucher" || settings?.features?.gift_vouchers_enabled !== false)
                .map((l) =>
                "isRoute" in l && l.isRoute ? (
                  <Link
                    key={l.href}
                    to={l.href}
                    className="text-sm font-medium text-foreground/80 hover:text-primary transition"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    className={`relative text-sm font-medium transition ${
                      isActive(l.href)
                        ? "text-primary"
                        : "text-foreground/80 hover:text-primary"
                    }`}
                  >
                    {l.label}

                    {isActive(l.href) && (
                      <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-primary rounded-full" />
                    )}
                  </a>
                )
              )}

              <ThemeToggle />

              <Link
                to="/order"
                className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-secondary hover:text-secondary-foreground transition"
              >
                Order Now
              </Link>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex items-center gap-3">
              <ThemeToggle />

              <button
                onClick={() => setOpen(!open)}
                aria-label="Toggle Menu"
              >
                {open ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ${
              open ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-4 pt-4 border-t border-border">
              {navLinks
                .filter((l) => l.href !== "/gift-voucher" || settings?.features?.gift_vouchers_enabled !== false)
                .map((l) =>
                "isRoute" in l && l.isRoute ? (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="text-foreground/80 hover:text-primary"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="text-foreground/80 hover:text-primary"
                  >
                    {l.label}
                  </a>
                )
              )}

              <Link
                to="/order"
                onClick={() => setOpen(false)}
                className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-center font-semibold"
              >
                Order Now
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" />
      )}
    </>
  );
};

export default Navbar;