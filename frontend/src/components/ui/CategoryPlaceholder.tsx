import {
  CupSoda,
  Soup,
  CakeSlice,
  UtensilsCrossed,
  ChefHat,
  Beef,
  ConciergeBell
} from "lucide-react";

export default function CategoryPlaceholder({ category }: { category?: string }) {
  const cat = (category || "").toLowerCase();

  let Icon = ConciergeBell;
  let bgClass = "bg-primary/5";
  let iconClass = "text-primary/40";

  if (cat.includes("drink") || cat.includes("beverage")) {
    Icon = CupSoda;
    bgClass = "bg-blue-500/5";
    iconClass = "text-blue-500/40";
  } else if (cat.includes("soup")) {
    Icon = Soup;
    bgClass = "bg-orange-500/5";
    iconClass = "text-orange-500/40";
  } else if (cat.includes("dessert") || cat.includes("sweet")) {
    Icon = CakeSlice;
    bgClass = "bg-pink-500/5";
    iconClass = "text-pink-500/40";
  } else if (cat.includes("noodle") || cat.includes("rice")) {
    Icon = UtensilsCrossed;
    bgClass = "bg-secondary/5";
    iconClass = "text-secondary/40";
  } else if (cat.includes("starter") || cat.includes("appetizer") || cat.includes("dim sum")) {
    Icon = ChefHat;
    bgClass = "bg-primary/5";
    iconClass = "text-primary/40";
  } else if (cat.includes("main") || cat.includes("chicken") || cat.includes("beef") || cat.includes("meat")) {
    Icon = Beef;
    bgClass = "bg-red-600/5";
    iconClass = "text-red-600/40";
  }

  return (
    <div className={`w-full h-full flex items-center justify-center transition-colors duration-500 ${bgClass}`}>
      <Icon 
        size={48} 
        className={iconClass} 
        style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.1))" }} 
      />
    </div>
  );
}
