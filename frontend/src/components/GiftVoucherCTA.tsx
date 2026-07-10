import { Link } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react"; // Added ArrowRight
import { Button } from "@/components/ui/button";
import ScrollReveal from "./ScrollReveal";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const GiftVoucherCTA = () => {
  const { settings } = useBusinessSettings();
  const content = settings?.landingPageContent;

  return (
    <section className="py-10 md:py-16 bg-primary/5">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 max-w-4xl mx-auto bg-card border border-border rounded-2xl p-5 md:p-12 shadow-lg">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-2xl font-bold text-foreground mb-2">
                  {content?.gift_voucher_title || "Gift a Voucher 🎁"}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {content?.gift_voucher_description || `Surprise someone special with a ${settings?.restaurantName || "The Chinese House"} gift voucher. Choose any amount starting from ₹100, customize the code, and share it instantly via WhatsApp!`}
                </p>
              </div>
            </div>
            <Link to="/gift-voucher">
              <Button size="lg" className="whitespace-nowrap gap-2">
                <Gift className="w-4 h-4" />
                Buy Gift Voucher
              </Button>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default GiftVoucherCTA;
