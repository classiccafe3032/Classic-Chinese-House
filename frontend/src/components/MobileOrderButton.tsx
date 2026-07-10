import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

const MobileOrderButton = () => {
  const activeTableQr = localStorage.getItem("activeTableQr");
  const orderLink = activeTableQr ? `/table/${activeTableQr}` : "/order";
  const orderText = activeTableQr ? "Return to Table" : "Order Now";

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 p-3 bg-gradient-to-t from-background via-background to-transparent">
      <Link
        to={orderLink}
        className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-lg shadow-xl"
      >
        <ShoppingCart size={20} />
        {orderText}
      </Link>
    </div>
  );
};

export default MobileOrderButton;
