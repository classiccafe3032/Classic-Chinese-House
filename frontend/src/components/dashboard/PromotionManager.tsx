import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ToggleLeft, ToggleRight, Megaphone, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  apiAdminListPromotions,
  apiAdminCreatePromotion,
  apiAdminTogglePromotion,
  apiAdminDeletePromotion,
} from "@/lib/apiClient";

interface Promotion {
  id: number;
  message: string;
  bg_color: string;
  text_color: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
  created_at: string;
}

const PromotionManager = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPromotions = async () => {
    try {
      const data = await apiAdminListPromotions();
      setPromotions(data);
    } catch {
      toast.error("Failed to load promotions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  // Convert datetime-local value (treated as IST) to ISO string with +05:30 offset
  const toIST = (localDatetime: string) => {
    if (!localDatetime) return "";
    return localDatetime + ":00+05:30";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !expiresAt) {
      toast.error("Message and expiry time are required");
      return;
    }
    setCreating(true);
    try {
      await apiAdminCreatePromotion({
        message: message.trim(),
        starts_at: startsAt ? toIST(startsAt) : new Date().toISOString(),
        expires_at: toIST(expiresAt),
      });
      toast.success("Promotion created");
      setMessage("");
      setStartsAt("");
      setExpiresAt("");
      fetchPromotions();
    } catch (err: any) {
      toast.error(err.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await apiAdminTogglePromotion(id);
      fetchPromotions();
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiAdminDeletePromotion(id);
      toast.success("Deleted");
      fetchPromotions();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const isActive = (p: Promotion) => p.active && !isExpired(p.expires_at) && new Date(p.starts_at) <= new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Create form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus size={18} className="text-primary" /> New Promotion
        </h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="🎉 20% OFF on Belgian Waffles Today!"
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Starts At</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to start immediately</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Expires At *</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                required
              />
            </div>
          </div>


          {/* Live preview */}
          {message && (
            <div className="rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium bg-primary text-primary-foreground">
                <Megaphone size={14} />
                <span>{message}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Promotion"}
          </button>
        </form>
      </div>

      {/* Promotions list */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-foreground">All Promotions ({promotions.length})</h3>
        {promotions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No promotions yet</p>
        ) : (
          <AnimatePresence>
            {promotions.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`bg-card border rounded-2xl p-4 ${
                  isActive(p) ? "border-primary/40" : isExpired(p.expires_at) ? "border-border opacity-60" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Preview strip */}
                    <div className="rounded-lg overflow-hidden mb-3">
                      <div className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-medium bg-primary text-primary-foreground">
                        <Megaphone size={12} />
                        <span className="truncate">{p.message}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>{new Date(p.starts_at).toLocaleString()}</span>
                      <span>→</span>
                      <span>{new Date(p.expires_at).toLocaleString()}</span>
                      {isActive(p) && (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-semibold">LIVE</span>
                      )}
                      {isExpired(p.expires_at) && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold">EXPIRED</span>
                      )}
                      {!p.active && !isExpired(p.expires_at) && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">DISABLED</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggle(p.id)}
                      className="p-2 rounded-lg hover:bg-muted transition"
                      title={p.active ? "Disable" : "Enable"}
                    >
                      {p.active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this promotion?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the promotion. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(p.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default PromotionManager;
