import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Loader2, Type, FileText, Heart, Coffee, Users, Sparkles, ChefHat, Award, Candy, Camera, Star, Utensils, Clock, MapPin, Layout, ImageIcon, Ticket } from "lucide-react";
import { toast } from "sonner";
import { apiAdminGetBusinessSettings, apiAdminUpdateBusinessSettings, type LandingPageContent } from "@/lib/apiClient";
import { Switch } from "@/components/ui/switch";

const iconOptions = [
  "Heart", "Coffee", "Users", "Sparkles", "ChefHat", "Award", "Candy", "Camera", "Star", "Utensils", "Clock", "MapPin"
];

const iconMap: Record<string, any> = {
  Heart, Coffee, Users, Sparkles, ChefHat, Award, Candy, Camera, Star, Utensils, Clock, MapPin
};

const PageContentManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [features, setFeatures] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settings = await apiAdminGetBusinessSettings();
      if (settings.landingPageContent) {
        setContent(settings.landingPageContent);
      }
      if (settings.features) {
        setFeatures(settings.features);
      }
    } catch (err) {
      toast.error("Failed to load page content");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      await apiAdminUpdateBusinessSettings({
        landingPageContent: content,
        features: features
      });
      toast.success("Page content updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update page content");
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (section: keyof LandingPageContent, value: any) => {
    if (!content) return;
    setContent({ ...content, [section]: value });
  };

  const updateAboutCard = (index: number, field: string, value: string) => {
    if (!content) return;
    const newCards = [...content.about_cards];
    newCards[index] = { ...newCards[index], [field]: value };
    updateSection("about_cards", newCards);
  };

  const updateWhyCard = (index: number, field: string, value: string) => {
    if (!content) return;
    const newCards = [...content.why_choose_us_cards];
    newCards[index] = { ...newCards[index], [field]: value };
    updateSection("why_choose_us_cards", newCards);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="container mx-auto px-4 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Layout className="text-primary" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold">Page Content</h2>
              <p className="text-sm text-muted-foreground">Customize text across your landing page</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>

        {/* About Section */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
            <span className="w-2 h-2 bg-primary rounded-full" />
            About Section (Our Story)
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">About Title</label>
              <input
                type="text"
                value={content.about_title}
                onChange={(e) => updateSection("about_title", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">About Description</label>
              <textarea
                value={content.about_description}
                onChange={(e) => updateSection("about_description", e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {content.about_cards.map((card, i) => (
              <div key={i} className="p-4 border border-border rounded-xl bg-muted/30 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Icon</label>
                    <select
                      value={card.icon}
                      onChange={(e) => updateAboutCard(i, "icon", e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm"
                    >
                      {iconOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center mt-4">
                    {(() => {
                      const Icon = iconMap[card.icon];
                      return Icon ? <Icon size={20} className="text-primary" /> : null;
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Card Title</label>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => updateAboutCard(i, "title", e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Card Description</label>
                  <input
                    type="text"
                    value={card.desc}
                    onChange={(e) => updateAboutCard(i, "desc", e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why Choose Us Section */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
            <span className="w-2 h-2 bg-secondary rounded-full" />
            Why Choose Us Section
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Section Title</label>
              <input
                type="text"
                value={content.why_choose_us_title}
                onChange={(e) => updateSection("why_choose_us_title", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {content.why_choose_us_cards.map((card, i) => (
              <div key={i} className="p-4 border border-border rounded-xl bg-muted/30 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Icon</label>
                    <select
                      value={card.icon}
                      onChange={(e) => updateWhyCard(i, "icon", e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm"
                    >
                      {iconOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center mt-4">
                    {(() => {
                      const Icon = iconMap[card.icon];
                      return Icon ? <Icon size={20} className="text-secondary" /> : null;
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Card Title</label>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => updateWhyCard(i, "title", e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Card Description</label>
                  <input
                    type="text"
                    value={card.desc}
                    onChange={(e) => updateWhyCard(i, "desc", e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Section */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
            <Utensils className="text-primary" size={18} />
            Menu Section
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Menu Category Label (e.g., OUR MENU)</label>
              <input
                type="text"
                value={content.menu_title || ""}
                onChange={(e) => updateSection("menu_title", e.target.value)}
                placeholder="OUR MENU"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Main Title (e.g., Signature Waffles)</label>
              <input
                type="text"
                value={content.menu_main_title || ""}
                onChange={(e) => updateSection("menu_main_title", e.target.value)}
                placeholder="The Best Chinese Food in Pune"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Menu Description</label>
              <textarea
                value={content.menu_description || ""}
                onChange={(e) => updateSection("menu_description", e.target.value)}
                placeholder="Authentic flavors crafted with passion"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Gallery & Gift Voucher */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
              <ImageIcon className="text-primary" size={18} />
              Gallery Section
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gallery Title</label>
              <input
                type="text"
                value={content.gallery_title}
                onChange={(e) => updateSection("gallery_title", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
              <Ticket className="text-secondary" size={18} />
              Gift Voucher Section
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                <span className="text-sm text-muted-foreground font-medium">
                  Display on Landing Page & Navbar
                </span>
                <Switch
                  id="gift-vouchers-toggle"
                  checked={features.gift_vouchers_enabled ?? true}
                  onCheckedChange={(checked) =>
                    setFeatures((prev) => ({
                      ...prev,
                      gift_vouchers_enabled: checked,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Voucher Title</label>
                <input
                  type="text"
                  value={content.gift_voucher_title}
                  onChange={(e) => updateSection("gift_voucher_title", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Voucher Description</label>
                <textarea
                  value={content.gift_voucher_description}
                  onChange={(e) => updateSection("gift_voucher_description", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-3 bg-primary text-primary-foreground w-full md:w-auto md:px-20 py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
          >
            {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
            {saving ? "Saving Changes..." : "Save All Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PageContentManager;
