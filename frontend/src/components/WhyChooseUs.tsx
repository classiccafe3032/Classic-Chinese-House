import { ChefHat, Candy, Award, Camera, Heart, Coffee, Users, Sparkles, Star, Utensils, Clock, MapPin } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const iconMap: Record<string, any> = {
  ChefHat, Candy, Award, Camera, Heart, Coffee, Users, Sparkles, Star, Utensils, Clock, MapPin
};

const WhyChooseUs = () => {
  const { settings } = useBusinessSettings();
  const content = settings?.landingPageContent;

  const reasons = content?.why_choose_us_cards || [
    { icon: "ChefHat", title: "Freshly Prepared", desc: "Every dish prepared fresh from the wok" },
    { icon: "Award", title: "Authentic Ingredients", desc: "Traditional Chinese herbs and spices" },
    { icon: "Utensils", title: "Skilled Chefs", desc: "Trained wok masters perfecting the heat" },
    { icon: "Camera", title: "Perfect Ambience", desc: "Elegant and comfortable oriental vibes" },
  ];

  return (
    <section className="section-padding bg-chocolate text-cream dark:text-foreground">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-6 md:mb-12">
            <span className="text-secondary font-semibold text-sm uppercase tracking-wider">Why Us</span>
            <h2 
              className="text-3xl md:text-5xl font-heading font-bold mt-3 mb-4"
              dangerouslySetInnerHTML={{ __html: content?.why_choose_us_title || `Why Choose <span class='text-secondary'>${settings?.restaurantName || "The Chinese House"}</span>` }}
            />
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-6">
          {reasons.map((r, i) => {
            const IconComponent = iconMap[r.icon] || Award;
            return (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className="text-center group">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary/20 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-4 group-hover:bg-secondary/40 transition-colors">
                    <IconComponent className="text-secondary w-5 h-5 md:w-[30px] md:h-[30px]" />
                  </div>
                  <h3 className="font-heading font-bold text-sm md:text-base mb-1 md:mb-2">{r.title}</h3>
                  <p className="text-cream/70 dark:text-muted-foreground text-xs md:text-sm">{r.desc}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
