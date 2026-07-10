import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Image, Save, Loader2, Upload, MapPin, Type, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiGetHeroContent, apiUpdateHeroContent, type HeroContent } from "@/lib/apiClient";

const HeroManager = () => {
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationTag, setLocationTag] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHero();
  }, []);

  const fetchHero = async () => {
    try {
      const data = await apiGetHeroContent();
      setHero(data);
      setLocationTag(data.location_tag || "");
      setTitle(data.title || "");
      setDescription(data.description || "");
      setImagePreview(data.image_url || null);
    } catch {
      toast.error("Failed to load hero content");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiUpdateHeroContent({
        location_tag: locationTag,
        title,
        description,
        image: imageFile || undefined,
      });
      setHero(updated);
      setImageFile(null);
      setImagePreview(updated.image_url || null);
      toast.success("Hero section updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update hero");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Image className="text-primary" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold">Hero Section</h2>
            <p className="text-sm text-muted-foreground">Update homepage hero content</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload size={14} /> Hero Image
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative cursor-pointer rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden bg-muted/30"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Hero preview"
                  className="w-full h-48 md:h-64 object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Upload size={32} className="mb-2" />
                  <p className="text-sm">Click to upload hero image</p>
                  <p className="text-xs mt-1">JPG, PNG, WebP • Max 5MB</p>
                </div>
              )}
              {imagePreview && (
                <div className="absolute inset-0 bg-foreground/0 hover:bg-foreground/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 hover:opacity-100 text-white font-semibold text-sm bg-foreground/60 px-4 py-2 rounded-xl">
                    Change Image
                  </span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Location Tag */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin size={14} /> Location Tag
            </label>
            <input
              type="text"
              value={locationTag}
              onChange={(e) => setLocationTag(e.target.value)}
              placeholder="Vishal Nagar, Pune"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Type size={14} /> Hero Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='The Best Chinese Food in Pune'
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              Wrap text in <code className="bg-muted px-1 rounded">&lt;span&gt;</code> tags for gradient highlight, e.g. <code className="bg-muted px-1 rounded">Fresh &lt;span&gt;Belgian Waffles&lt;/span&gt;</code>
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText size={14} /> Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Authentic flavors crafted with passion"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none resize-none"
            />
          </div>

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> Saving...</>
            ) : (
              <><Save size={18} /> Save Changes</>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default HeroManager;
