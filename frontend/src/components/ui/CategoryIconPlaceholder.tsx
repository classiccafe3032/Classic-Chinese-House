import {
  Coffee,
  Soup,
  IceCream,
  ChefHat,
  ConciergeBell,
  GlassWater,
  CupSoda,
  UtensilsCrossed,
} from "lucide-react";

export const CategoryIconPlaceholder = ({ 
  category, 
  className = "w-12 h-12 text-primary/40 group-hover:scale-110 transition-transform duration-500" 
}: { 
  category?: string, 
  className?: string 
}) => {
  const cat = (category || "").toLowerCase();
  
  if (cat.includes("beverage") || cat.includes("drink") || cat.includes("water")) {
    return <GlassWater className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("tea") || cat.includes("coffee")) {
    return <Coffee className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("soup")) {
    return <Soup className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("dessert") || cat.includes("sweet")) {
    return <IceCream className={className} strokeWidth={1.5} />;
  }
  if (cat.includes("starter") || cat.includes("appetizer")) {
    return <UtensilsCrossed className={className} strokeWidth={1.5} />;
  }
  
  return <ConciergeBell className={className} strokeWidth={1.5} />;
};
