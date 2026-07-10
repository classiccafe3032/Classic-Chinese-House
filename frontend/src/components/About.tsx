import { Heart, Coffee, Users, Sparkles, ChefHat, Candy, Award, Camera, Star, Utensils, Clock, MapPin } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const iconMap: Record<string, any> = {
  Heart, Coffee, Users, Sparkles, ChefHat, Candy, Award, Camera, Star, Utensils, Clock, MapPin
};

const About = () => {
  const { settings } = useBusinessSettings();
  const content = settings?.landingPageContent;

  return (
    <section id="about" className="section-padding bg-card">
      <div className="container mx-auto">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center mb-6 md:mb-12">
            <span className="text-secondary font-semibold text-sm uppercase tracking-wider">Our Story</span>
            <h2 
              className="text-3xl md:text-5xl font-heading font-bold mt-2 md:mt-3 mb-3 md:mb-6"
              dangerouslySetInnerHTML={{ __html: content?.about_title || "A Taste of <span class='text-primary'>Chinese</span> Tradition" }}
            />
            
            <p className="text-muted-foreground text-sm md:text-lg leading-relaxed">
              {content?.about_description || `${settings?.restaurantName || "Classic Chinese"} brings authentic Chinese dining culture to you. From classic dim sums to sizzling hot main courses, we serve happiness in every bite.`}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {(content?.about_cards || [
            { icon: "Heart", title: "Authentic Recipes", desc: "Crafted with traditional methods and fresh ingredients" },
            { icon: "Coffee", title: "Warm Ambience", desc: "Elegant oriental setup meets modern comfort" },
            { icon: "Users", title: "Family Dining", desc: "Ideal for sharing delicious moments together" },
            { icon: "Sparkles", title: "Wok Hei Flavor", desc: "Served hot and fresh straight from the sizzling wok" },
          ]).map((item, i) => {
            const IconComponent = iconMap[item.icon] || Sparkles;
            return (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className="bg-background rounded-xl md:rounded-2xl p-3 md:p-6 text-center hover-lift border border-border h-full">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-secondary/20 rounded-lg md:rounded-xl flex items-center justify-center mx-auto mb-2 md:mb-4">
                    <IconComponent className="text-primary w-5 h-5 md:w-7 md:h-7" />
                  </div>
                  <h3 className="font-heading font-bold text-xs md:text-lg mb-1 md:mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-[10px] md:text-sm leading-snug">{item.desc}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default About;
