import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChefHat, Lock, Loader2 } from "lucide-react";
import { apiKitchenVerifyPin } from "@/lib/apiClient";
import BackgroundOrbs from "@/components/BackgroundOrbs";

const SESSION_KEY = "kitchen_pin_verified";

const kitchenOrbs = [
  {
    size: "w-[400px] h-[400px]",
    blur: "blur-[100px]",
    opacity: "opacity-15",
    color: "bg-primary/30",
    position: { top: "5%", right: "-5%" } as React.CSSProperties,
  },
  {
    size: "w-[350px] h-[350px]",
    blur: "blur-[100px]",
    opacity: "opacity-10",
    color: "bg-secondary/30",
    position: { bottom: "10%", left: "-5%", animationDelay: "3s" } as React.CSSProperties,
  },
];

export { SESSION_KEY, kitchenOrbs };

export default function KitchenPinGate({ onVerified }: { onVerified: () => void }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      await apiKitchenVerifyPin(pin);
      sessionStorage.setItem(SESSION_KEY, "true");
      onVerified();
    } catch {
      setError("Invalid PIN. Please try again.");
      setPin("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <BackgroundOrbs orbs={kitchenOrbs} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock size={32} className="text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Kitchen Display
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter PIN to access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter PIN"
              className="w-full text-center text-2xl font-bold tracking-[0.5em] bg-muted border border-border rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition placeholder:text-muted-foreground/50 placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
            />
            {error && (
              <p className="text-destructive text-sm text-center font-medium">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <ChefHat size={20} />
                  Enter Kitchen
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
