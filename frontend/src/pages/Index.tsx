import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import PromotionBanner from "@/components/PromotionBanner";
import Hero from "@/components/Hero";
import About from "@/components/About";
import MenuSection from "@/components/MenuSection";
import WhyChooseUs from "@/components/WhyChooseUs";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import GiftVoucherCTA from "@/components/GiftVoucherCTA";
import Location from "@/components/Location";
import ReceiptLookup from "@/components/ReceiptLookup";
import Footer from "@/components/Footer";
import MobileOrderButton from "@/components/MobileOrderButton";
import NotFound from "./NotFound";
import { apiGetBusinessSettings, type BusinessSettings } from "@/lib/apiClient";
import { Ban } from "lucide-react";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const Index = () => {
  const { settings: businessSettings, loading } = useBusinessSettings();

  if (loading) {
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

  if (businessSettings && businessSettings.isActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-center">
        <div>
          <Ban className="text-destructive w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Service Suspended</h1>
          <p className="text-muted-foreground">This restaurant's online services are currently unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <PromotionBanner />
      <Hero />
      <About />
      <MenuSection />
      <WhyChooseUs />
      <Gallery />
      <Testimonials />
      {businessSettings?.features?.gift_vouchers_enabled !== false && <GiftVoucherCTA />}
      <Location />
      <ReceiptLookup />
      <Footer />
      {(!businessSettings || businessSettings.features?.qr_digital_ordering) && <MobileOrderButton />}
    </main>
  );
};

export default Index;
