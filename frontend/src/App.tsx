import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import { lazy, Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import ThemeInjector from "@/components/ThemeInjector";
import AiChatbot from "@/components/AiChatbot";
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

const Index = lazy(() => import("./pages/Index"));
const OrderPage = lazy(() => import("./pages/OrderPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TokenDisplay = lazy(() => import("./pages/TokenDisplay"));
const ItemReviewsPage = lazy(() => import("./pages/ItemReviewsPage"));
const GiftVoucher = lazy(() => import("./pages/GiftVoucher"));
const KitchenDisplay = lazy(() => import("./pages/KitchenDisplay"));
const TableOrderPage = lazy(() => import("./pages/TableOrderPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 size={32} className="animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

function ThemeInit() {
  useEffect(() => {
    if (localStorage.getItem("theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
    
    // Keep tablet screen awake indefinitely
    if (Capacitor.isNativePlatform()) {
      KeepAwake.keepAwake().catch(err => console.error("KeepAwake failed:", err));
    }
  }, []);
  return null;
}

import { ErrorBoundary } from "@/components/ErrorBoundary";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>
            {/* Direct Chinese House Routes */}
            <Route path="/" element={<PageTransition><Index /></PageTransition>} />
            <Route path="/order" element={<PageTransition><OrderPage /></PageTransition>} />
            <Route path="/reviews" element={<PageTransition><ItemReviewsPage /></PageTransition>} />
            <Route path="/token-display" element={<PageTransition><TokenDisplay /></PageTransition>} />
            <Route path="/gift-voucher" element={<PageTransition><GiftVoucher /></PageTransition>} />
            <Route path="/table/:qrCode" element={<PageTransition><TableOrderPage /></PageTransition>} />
            <Route path="/kitchen" element={<PageTransition><KitchenDisplay /></PageTransition>} />
            <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
            
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AnimatePresence>
  );
}

function GlobalChatbot() {
  const location = useLocation();
  // Hide chatbot on admin/staff pages
  const isAdminPage = location.pathname.startsWith('/dashboard') || 
                      location.pathname.startsWith('/kitchen') || 
                      location.pathname.startsWith('/token-display');
                      
  if (isAdminPage) return null;
  return <AiChatbot />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeInit />
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <ThemeInjector />
        <GlobalChatbot />
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
