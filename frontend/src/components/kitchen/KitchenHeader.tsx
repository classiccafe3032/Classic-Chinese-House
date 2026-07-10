import { motion } from "framer-motion";
import { ChefHat, Maximize, Minimize, Volume2, VolumeX, RefreshCw } from "lucide-react";

interface KitchenHeaderProps {
  orderCount: number;
  isConnected: boolean;
  isFullscreen: boolean;
  soundEnabled: boolean;
  onToggleFullscreen: () => void;
  onToggleSound: () => void;
  onRefresh: () => void;
}

export default function KitchenHeader({
  orderCount,
  isConnected,
  isFullscreen,
  soundEnabled,
  onToggleFullscreen,
  onToggleSound,
  onRefresh,
}: KitchenHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
    >
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-primary">Kitchen</span>{" "}
          <span className="text-secondary">Display</span>
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-destructive"
              }`}
            />
            <p className="text-sm font-medium text-muted-foreground">
              {isConnected ? "Live" : "Disconnected"}
            </p>
          </div>
          <span className="text-muted-foreground/30">•</span>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Order count */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/15 border border-secondary/25">
          <ChefHat size={18} className="text-secondary" />
          <span className="text-sm font-bold text-foreground">
            {orderCount} Preparing
          </span>
        </div>

        {/* Sound toggle */}
        <button
          onClick={onToggleSound}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition"
          title={soundEnabled ? "Mute alerts" : "Enable alerts"}
        >
          {soundEnabled ? (
            <Volume2 size={18} className="text-primary" />
          ) : (
            <VolumeX size={18} className="text-muted-foreground" />
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition"
          title="Refresh orders"
        >
          <RefreshCw size={18} className="text-muted-foreground" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition"
        >
          {isFullscreen ? (
            <Minimize size={18} className="text-muted-foreground" />
          ) : (
            <Maximize size={18} className="text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground hidden sm:inline">
            {isFullscreen ? "Exit" : "Fullscreen"}
          </span>
        </button>
      </div>
    </motion.div>
  );
}
