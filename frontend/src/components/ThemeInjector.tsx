import { useEffect, useState } from "react";
import { setTenantSlug, apiGetBusinessSettings, type BusinessSettings } from "@/lib/apiClient";
import { socket } from "@/lib/socket";

/**
 * All theme class names the system supports.
 */
const ALL_THEME_CLASSES = [
  "theme-hennys-classic",
  "theme-gourmet-royal",
  "theme-midnight-bistro",
  "theme-summer-cafe",
  "theme-chalkboard",
  "theme-neon-pulse",
  "theme-rose-garden",
  "theme-ocean-breeze",
  "theme-ember-grill",
  "theme-matcha-zen",
  "theme-lavender-dusk",
  "theme-truffle-noir",
];

/**
 * ThemeInjector
 * Fetches single tenant business settings and dynamically applies the theme class to <html>.
 */
const ThemeInjector = () => {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await apiGetBusinessSettings();
        setSettings(data);
      } catch (err) {
        console.error("ThemeInjector: failed to fetch settings", err);
      }
    };

    fetchSettings();

    const handler = () => fetchSettings();
    socket.on("business-settings-updated", handler);
    return () => { socket.off("business-settings-updated", handler); };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // Clear all previous theme classes
    ALL_THEME_CLASSES.forEach((t) => root.classList.remove(t));

    // Determine theme: from API or fallback
    const themeName = settings?.theme || "hennys-classic";
    const themeClass = `theme-${themeName}`;
    root.classList.add(themeClass);

    // Push font CSS vars for Tailwind utilities
    requestAnimationFrame(() => {
      const styles = getComputedStyle(root);
      const headingFont = styles.getPropertyValue("--theme-font-heading").trim();
      const bodyFont = styles.getPropertyValue("--theme-font-body").trim();

      if (headingFont) root.style.setProperty("--font-heading", headingFont);
      if (bodyFont) root.style.setProperty("--font-body", bodyFont);
    });

    return () => {
      root.classList.remove(themeClass);
    };
  }, [settings?.theme]);

  return null;
};

export default ThemeInjector;
