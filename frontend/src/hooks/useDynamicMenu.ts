import { useState, useEffect } from "react";
import { apiGetMenuItems } from "@/lib/apiClient";
import { socket } from "@/lib/socket";

export interface DynamicMenuItem {
  id?: number;
  name: string;
  slug: string;
  desc: string;
  price: number;
  priceLabel: string;
  image: string;
  category: string;
  available: boolean;
  diet_type?: "veg" | "non-veg" | "egg" | "none";
  variants?: { name: string; price: number }[];
}

export function useDynamicMenu() {
  const [items, setItems] = useState<DynamicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const CACHE_KEY = "menu_cache_v2";
  const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

  const fetchMenu = async () => {
    try {
      const data = await apiGetMenuItems();

      const formatted = (data || []).map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        desc: d.description,
        price: Number(d.price),
        priceLabel: d.price_label,
        image: d.image_url || "/placeholder.svg",
        category: d.category,
        available: d.available,
        diet_type: d.diet_type,
        variants: d.variants || [],
      }));

      setItems(formatted);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ time: Date.now(), data: formatted }),
      );
    } catch (err) {
      console.error("Menu API failed", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.time < CACHE_TIME) {
        setItems(parsed.data);
        setLoading(false);
      }
    }

    fetchMenu();

    socket.on("menu-updated", () => {
      console.log("Menu updated, refreshing...");
      fetchMenu();
    });

    return () => {
      socket.off("menu-updated");
    };
  }, []);

  const categories = [
    "All",
    ...Array.from(new Set(items.map((i) => i.category))),
  ];

  return { items, categories, loading, refetch: fetchMenu };
}
