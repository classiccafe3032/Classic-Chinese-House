import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiGetTokens } from "@/lib/apiClient";
import { CheckCircle2, Clock, ChefHat, Maximize, Minimize } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BackgroundOrbs from "@/components/BackgroundOrbs";
import { socket } from "@/lib/socket";
import NotFound from "./NotFound";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

type TokenRow = {
  id: string;
  token: number;
  status: "new" | "preparing" | "ready" | "completed";
};

const cardAnim = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.2 } },
};

const tokenOrbs = [
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
    position: {
      bottom: "10%",
      left: "-5%",
      animationDelay: "3s",
      animationDuration: "11s",
    } as React.CSSProperties,
  },
  {
    size: "w-[250px] h-[250px]",
    blur: "blur-[80px]",
    opacity: "opacity-10",
    color: "bg-accent/20",
    position: {
      top: "50%",
      left: "50%",
      animationDelay: "5s",
      animationDuration: "13s",
    } as React.CSSProperties,
  },
];

interface TokenSectionProps {
  title: string;
  icon: ReactNode;
  count: number;
  badgeColor: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  children: ReactNode;
  emptyText?: string;
}

const TokenSection = ({
  title,
  icon,
  count,
  badgeColor,
  scrollRef,
  children,
  emptyText = "-",
}: TokenSectionProps) => (
  <section className="mb-10">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <span
        className={`px-4 py-1 rounded-full text-sm font-semibold ${badgeColor}`}
      >
        {count}
      </span>
    </div>

    <div ref={scrollRef} className="max-h-[260px] overflow-y-auto pr-2">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        <AnimatePresence>{children}</AnimatePresence>

        {count === 0 && (
          <div className="col-span-full bg-card border border-border rounded-2xl py-10 text-center shadow-sm">
            <p className="text-muted-foreground font-medium">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  </section>
);

function useAutoScroll(ref: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    let scrollPos = 0;
    let direction = 1;

    const interval = setInterval(() => {
      if (!container) return;

      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;

      scrollPos += direction;

      if (scrollPos >= maxScroll) direction = -1;
      if (scrollPos <= 0) direction = 1;

      container.scrollTo({ top: scrollPos, behavior: "smooth" });
    }, 80);

    return () => clearInterval(interval);
  }, [ref]);
}

const TokenDisplay = () => {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);

  const prevReadyIdsRef = useRef<Set<string>>(new Set());
  const [flashReadyIds, setFlashReadyIds] = useState<Set<string>>(new Set());

  const readyScrollRef = useRef<HTMLDivElement | null>(null);
  const preparingScrollRef = useRef<HTMLDivElement | null>(null);
  const newScrollRef = useRef<HTMLDivElement | null>(null);



  const { settings: businessSettings, loading: settingsLoading } = useBusinessSettings();

  useAutoScroll(readyScrollRef);
  useAutoScroll(preparingScrollRef);
  useAutoScroll(newScrollRef);

  const fetchTokens = useCallback(async () => {
    try {
      const data = (await apiGetTokens()) as TokenRow[];

      const currentReadyIds = new Set(
        data.filter((o) => o.status === "ready").map((o) => o.id),
      );

      const prevReadyIds = prevReadyIdsRef.current;
      const newlyReadyIds = [...currentReadyIds].filter(
        (id) => !prevReadyIds.has(id),
      );

      if (newlyReadyIds.length > 0) {
        // Browser Notification
        if ("Notification" in window && Notification.permission === "granted") {
          newlyReadyIds.forEach((id) => {
            const readyOrder = data.find((o) => o.id === id);
            if (!readyOrder) return;

            new Notification("Classic Chinese", {
              body: ` Your order with Token #${readyOrder.token} is ready!`,
              icon: "/favicon.png",
            });
          });
        }

        // Mobile Vibration
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
        setFlashReadyIds((prev) => {
          const updated = new Set(prev);
          newlyReadyIds.forEach((id) => updated.add(id));
          return updated;
        });

        setTimeout(() => {
          setFlashReadyIds((prev) => {
            const updated = new Set(prev);
            newlyReadyIds.forEach((id) => updated.delete(id));
            return updated;
          });
        }, 3500);
      }

      prevReadyIdsRef.current = currentReadyIds;
      setTokens(data);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
    }
  }, []);

  // -------- NOTIFICATION PERMISSION --------
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // -------- SOCKET LISTENERS --------
  useEffect(() => {
    fetchTokens();

    const delayedFetch = () => setTimeout(fetchTokens, 300);

    socket.on("new-order", delayedFetch);
    socket.on("order-updated", delayedFetch);
    socket.on("payment-updated", delayedFetch);
    socket.on("connect", fetchTokens);

    return () => {
      socket.off("new-order", delayedFetch);
      socket.off("order-updated", delayedFetch);
      socket.off("payment-updated", delayedFetch);
      socket.off("connect", fetchTokens);
    };
  }, [fetchTokens]);

  // -------- CONNECTION STATUS --------
  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const sortByToken = (a: TokenRow, b: TokenRow) => a.token - b.token;

  const readyOrders = useMemo(
    () => tokens.filter((o) => o.status === "ready").sort(sortByToken),
    [tokens],
  );

  const preparingOrders = useMemo(
    () => tokens.filter((o) => o.status === "preparing").sort(sortByToken),
    [tokens],
  );

  const newOrders = useMemo(
    () => tokens.filter((o) => o.status === "new").sort(sortByToken),
    [tokens],
  );

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // -------- CONDITIONAL RETURNS (after all hooks) --------
  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse font-medium">Entering Restaurant...</p>
        </div>
      </div>
    );
  }

  if (!businessSettings) {
    return <NotFound />;
  }

  const renderTokenCard = (o: TokenRow, label: string, isFlashing = false) => (
    <motion.div
      key={o.id}
      variants={cardAnim}
      initial="hidden"
      animate="show"
      exit="exit"
      className={`rounded-2xl px-4 py-5 text-center shadow-sm border transition ${isFlashing
          ? "bg-secondary/30 border-secondary/50 animate-pulse"
          : "bg-card border-border"
        }`}
    >
      <p className="text-3xl font-extrabold text-foreground">#{o.token}</p>
      <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-6 py-8">
      <BackgroundOrbs orbs={tokenOrbs} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10"
        >
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-primary">
                {businessSettings.restaurantName.split(" ")[0]}
              </span>{" "}
              <span className="text-secondary">
                {businessSettings.restaurantName.split(" ").slice(1).join(" ") || "Dashboard"}
              </span>
            </h1>

            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"
                  }`}
              />
              <p className="text-sm text-muted-foreground">
                {isConnected ? "Live" : "Disconnected"}
              </p>
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition"
          >
            {isFullscreen ? (
              <Minimize size={18} className="text-muted-foreground" />
            ) : (
              <Maximize size={18} className="text-muted-foreground" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </button>
        </motion.div>

        {/* STATS */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <div className="rounded-2xl bg-primary/10 border border-primary/20 px-6 py-5">
            <p className="text-sm text-muted-foreground font-medium">Active</p>
            <p className="text-3xl font-bold mt-1">{readyOrders.length + preparingOrders.length + newOrders.length}</p>
          </div>

          <div className="rounded-2xl bg-green-500/10 border border-green-500/20 px-6 py-5">
            <p className="text-sm text-muted-foreground font-medium">
              Ready Orders
            </p>
            <p className="text-3xl font-bold mt-1">{readyOrders.length}</p>
          </div>

          <div className="rounded-2xl bg-orange-500/10 border border-orange-500/20 px-6 py-5">
            <p className="text-sm text-muted-foreground font-medium">
              Preparing
            </p>
            <p className="text-3xl font-bold mt-1">{preparingOrders.length}</p>
          </div>
        </div> */}

        {/* SECTIONS */}
        <TokenSection
          title="Ready"
          icon={
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center border border-green-500/25">
              <CheckCircle2 size={22} className="text-green-500" />
            </div>
          }
          count={readyOrders.length}
          badgeColor="bg-green-500/15 text-green-600 border border-green-500/25"
          scrollRef={readyScrollRef}
          emptyText="No ready orders yet"
        >
          {readyOrders.map((o) =>
            renderTokenCard(o, "READY", flashReadyIds.has(o.id)),
          )}
        </TokenSection>

        <TokenSection
          title="Preparing"
          icon={
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center border border-orange-500/25">
              <ChefHat size={22} className="text-orange-500" />
            </div>
          }
          count={preparingOrders.length}
          badgeColor="bg-orange-500/15 text-orange-600 border border-orange-500/25"
          scrollRef={preparingScrollRef}
        >
          {preparingOrders.map((o) => renderTokenCard(o, "COOKING"))}
        </TokenSection>

        <TokenSection
          title="New"
          icon={
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center border border-accent/25">
              <Clock size={22} className="text-accent" />
            </div>
          }
          count={newOrders.length}
          badgeColor="bg-accent/15 text-accent border border-accent/25"
          scrollRef={newScrollRef}
        >
          {newOrders.map((o) => renderTokenCard(o, "NEW"))}
        </TokenSection>
      </div>
    </div>
  );
};

export default TokenDisplay;
