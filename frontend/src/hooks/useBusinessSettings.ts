import { useEffect, useState } from "react";
import { apiGetBusinessSettings, type BusinessSettings } from "@/lib/apiClient";
import { socket } from "@/lib/socket";

export const useBusinessSettings = () => {
  const DEFAULT_SETTINGS: BusinessSettings = {
    restaurantName: "The Chinese House",
    gstin: null,
    address: "Vishal Nagar, Pune",
    phone: "+91 7045339273",
    email: "thechinesehouse@gmail.com",
    isGstEnabled: true,
    cgstRate: 2.5,
    sgstRate: 2.5,
    kitchenPin: "1234",
    theme: "gourmet-royal",
    landingPageContent: {
      about_title: "A Taste of <span class='text-primary'>Chinese</span> Tradition",
      about_description: "The Chinese House brings authentic Chinese dining culture to you. From classic dim sums to sizzling hot main courses, we serve happiness in every bite.",
      about_cards: [
        { icon: "Heart", title: "Authentic Recipes", desc: "Crafted with traditional methods and fresh ingredients" },
        { icon: "Coffee", title: "Warm Ambience", desc: "Elegant oriental setup meets modern comfort" },
        { icon: "Users", title: "Family Dining", desc: "Ideal for sharing delicious moments together" },
        { icon: "Sparkles", title: "Wok Hei Flavor", desc: "Served hot and fresh straight from the sizzling wok" }
      ],
      why_choose_us_title: "Why Choose <span class='text-secondary'>The Chinese House</span>",
      why_choose_us_cards: [
        { icon: "ChefHat", title: "Freshly Prepared", desc: "Every dish prepared fresh from the wok" },
        { icon: "Award", title: "Authentic Ingredients", desc: "Traditional Chinese herbs and spices" },
        { icon: "Utensils", title: "Skilled Chefs", desc: "Trained wok masters perfecting the heat" },
        { icon: "Camera", title: "Perfect Ambience", desc: "Elegant and comfortable oriental vibes" }
      ],
      gallery_title: "A Glimpse of <span class='text-primary'>The Chinese House</span>",
      gift_voucher_title: "Gift a Dining Voucher 🧧",
      gift_voucher_description: "Surprise someone special with a The Chinese House gift voucher. Choose any amount starting from ₹100, customize the code, and share it instantly via WhatsApp!",
      menu_title: "OUR MENU",
      menu_main_title: "Signature <span class='text-primary'>Dishes</span>",
      menu_description: "From classic starters to sizzling main courses, every dish is a masterpiece. Sorted by highest ratings."
    }
  };

  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await apiGetBusinessSettings();
      setSettings(data);
      setError(null);
    } catch (err: any) {
      console.warn("Failed to fetch business settings, using fallback:", err);
      setError(err);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    const handler = () => fetchSettings();
    socket.on("business-settings-updated", handler);

    return () => {
      socket.off("business-settings-updated", handler);
    };
  }, []);

  return { settings: settings || DEFAULT_SETTINGS, loading, error };
};
