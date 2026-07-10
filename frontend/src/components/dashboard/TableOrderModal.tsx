import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDynamicMenu, type DynamicMenuItem } from "@/hooks/useDynamicMenu";
import { apiPlaceOrder, type OrderItem } from "@/lib/apiClient";
import { toast } from "sonner";
import { Loader2, X, Plus, Minus, Search, ShoppingCart, Trash2, MessageSquarePlus, LayoutGrid, List } from "lucide-react";
import VariantSelectionModal from "@/components/VariantSelectionModal";
import ItemNoteModal from "./ItemNoteModal";

interface CartItem extends OrderItem {
  note?: string;
}

interface TableOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tableSessionId: string;
  tableNumber: string;
  customerName?: string;
  customerPhone?: string;
}

export default function TableOrderModal({ isOpen, onClose, onSuccess, tableSessionId, tableNumber, customerName, customerPhone }: TableOrderModalProps) {
  const { items: menuItems, categories, loading: menuLoading } = useDynamicMenu();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("table_pos_view_mode") as "grid" | "list") || "grid";
  });

  useEffect(() => {
    localStorage.setItem("table_pos_view_mode", viewMode);
  }, [viewMode]);
  const [placing, setPlacing] = useState(false);
  const [variantModalItem, setVariantModalItem] = useState<DynamicMenuItem | null>(null);
  const [noteModalItem, setNoteModalItem] = useState<{ id: string | number; name: string; note: string } | null>(null);

  const availableItems = useMemo(() => {
    return menuItems
      .filter((i) => i.available)
      .filter((i) => category === "All" || i.category === category)
      .filter(
        (i) =>
          !search ||
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.desc.toLowerCase().includes(search.toLowerCase())
      );
  }, [menuItems, category, search]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (!isOpen) return null;

  const addToCart = (item: DynamicMenuItem) => {
    if (!item.id) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          priceLabel: item.priceLabel,
          quantity: 1,
          image: item.image,
        },
      ];
    });
  };

  const handleVariantAdd = (item: DynamicMenuItem, variant: { name: string; price: number }, quantity: number) => {
    if (!item.id) return;
    setCart((prev) => {
      const id = `${item.id}-${variant.name}`;
      const existing = prev.find((c) => c.id === id);
      if (existing) {
        return prev.map((c) =>
          c.id === id ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [
        ...prev,
        {
          id,
          name: `${item.name} (${variant.name})`,
          price: variant.price,
          priceLabel: `₹${variant.price}`,
          quantity,
          image: item.image,
        },
      ];
    });
    toast.success(`${item.name} (${variant.name}) added`);
  };

  const updateQty = (id: string | number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.id === id ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const updateNote = (id: string | number, note: string) => {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, note } : c))
    );
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      await apiPlaceOrder(
        customerName || "Table Guest",
        customerPhone || "0000000000",
        cart,
        "counter", // Payment method 'counter' just means they pay at the counter later
        undefined,
        "dine-in",
        "",
        "table",
        tableSessionId
      );
      toast.success("Items added to Table " + tableNumber);
      setCart([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add items to table");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        >
          {/* LEFT: Menu Selection */}
          <div className="flex-1 flex flex-col bg-card overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="text-primary" />
                Add Items to Table {tableNumber}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search & Categories */}
            <div className="p-4 border-b border-border space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-base md:text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button
                  onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
                  className="px-3.5 rounded-xl border border-border bg-background text-foreground flex items-center justify-center hover:bg-muted transition shadow-sm"
                  title={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
                >
                  {viewMode === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${category === cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
              {menuLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : availableItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No items found.
                </div>
              ) : (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {availableItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => item.variants?.length ? setVariantModalItem(item) : addToCart(item)}
                        className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col h-full"
                      >
                        <div className="aspect-[4/3] rounded-lg bg-muted mb-3 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 font-bold text-2xl">
                              {item.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-bold text-sm leading-tight line-clamp-2">{item.name}</h3>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="font-bold text-primary text-sm">
                              {item.variants?.length ? "Varied" : `₹${item.price}`}
                            </span>
                            <button className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground p-1.5 rounded-lg transition-colors">
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {availableItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => item.variants?.length ? setVariantModalItem(item) : addToCart(item)}
                        className="bg-card border border-border rounded-xl p-3 flex justify-between items-center hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                      >
                        <div>
                          <h4 className="font-heading font-bold text-sm mb-0.5">{item.name}</h4>
                          <span className="text-xs text-primary font-bold">
                            {item.variants?.length ? "Varied" : `₹${item.price}`}
                          </span>
                        </div>
                        <button className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground p-2 rounded-lg transition-colors">
                          <Plus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* RIGHT: Cart & Checkout */}
          <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-border bg-card flex flex-col shrink-0 max-h-[45vh] md:max-h-none md:h-auto">
            <div className="p-3 md:p-4 border-b border-border bg-muted/20">
              <h3 className="font-bold text-base md:text-lg">Current Cart</h3>
              <p className="text-xs text-muted-foreground">{cart.reduce((s, i) => s + i.quantity, 0)} items selected</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 py-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingCart size={20} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium">Cart is empty</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between gap-3 bg-background border border-border p-3 rounded-xl shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm truncate">{item.name}</p>
                          <button
                            onClick={() => setNoteModalItem({ id: item.id!, name: item.name, note: item.note || "" })}
                            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                            title="Add note"
                          >
                            <MessageSquarePlus size={14} />
                          </button>
                        </div>
                        <p className="text-primary font-semibold text-xs">₹{item.price}</p>
                        {item.note && (
                          <p className="text-[10px] text-amber-600 font-bold italic mt-0.5 line-clamp-1">
                            Note: {item.note}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                        <button
                          onClick={() => updateQty(item.id!, -1)}
                          className="p-1 hover:bg-background rounded-md transition-colors text-muted-foreground hover:text-foreground"
                        >
                          {item.quantity === 1 ? <Trash2 size={14} className="text-destructive" /> : <Minus size={14} />}
                        </button>
                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id!, 1)}
                          className="p-1 hover:bg-background rounded-md transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-3 md:p-4 border-t border-border bg-muted/20 space-y-3 md:space-y-4">
              <div className="flex justify-between items-center text-base md:text-lg font-black">
                <span>Total</span>
                <span className="text-primary">₹{cartTotal.toFixed(0)}</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || placing}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {placing ? <Loader2 className="animate-spin" /> : "Send to Kitchen"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Variant Modal */}
        {variantModalItem && (
          <VariantSelectionModal
            item={variantModalItem as any}
            isOpen={!!variantModalItem}
            onClose={() => setVariantModalItem(null)}
            onAdd={handleVariantAdd as any}
          />
        )}

        {/* Note Modal */}
        <ItemNoteModal
          isOpen={!!noteModalItem}
          onClose={() => setNoteModalItem(null)}
          onSave={(note) => {
            if (noteModalItem) updateNote(noteModalItem.id, note);
          }}
          itemName={noteModalItem?.name || ""}
          initialNote={noteModalItem?.note || ""}
        />
      </div>
    </AnimatePresence>
  );
}
