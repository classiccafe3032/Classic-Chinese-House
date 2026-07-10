import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Trash2, X } from "lucide-react";
import { useDynamicMenu, type DynamicMenuItem } from "@/hooks/useDynamicMenu";
import { toast } from "@/hooks/use-toast";
import type { Order, AuthUser } from "@/lib/apiClient";
import VariantSelectionModal from "@/components/VariantSelectionModal";

export type EditItem = {
  id: number | string; // menu_item_id
  name: string;
  price: number;
  priceLabel: string;
  quantity: number;
  image?: string;
  note?: string;
};

interface EditOrderModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onSave: (items: EditItem[]) => Promise<void>;
  user?: AuthUser | null;
}

const EditOrderModal = ({ open, onClose, order, onSave, user }: EditOrderModalProps) => {
  const { items: menuItems } = useDynamicMenu();
  const [items, setItems] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");
  const [variantModalItem, setVariantModalItem] = useState<DynamicMenuItem | null>(null);

  useEffect(() => {
    if (order) {
      setItems(order.items.map((i) => ({ ...i })));
    }
  }, [order]);

  if (!open || !order) return null;

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const increaseQty = (id: number | string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i))
    );
  };

  const decreaseQty = (id: number | string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: number | string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddNewItem = () => {
    if (!selectedItem) return;
    const menuItem = menuItems.find((m) => String(m.id) === selectedItem);
    if (!menuItem || !menuItem.id) return;

    if (menuItem.variants && menuItem.variants.length > 0) {
      setVariantModalItem(menuItem);
      return;
    }

    setItems((prev) => {
      const existing = prev.find((x) => x.id === menuItem.id);
      if (existing) {
        return prev.map((x) =>
          x.id === menuItem.id ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      return [
        ...prev,
        {
          id: menuItem.id!,
          name: menuItem.name,
          price: menuItem.price,
          priceLabel: menuItem.priceLabel || "",
          quantity: 1,
          image: menuItem.image,
        },
      ];
    });
    setSelectedItem("");
  };

  const handleVariantAdd = (item: DynamicMenuItem, variant: { name: string; price: number }, quantity: number) => {
    const newItemId = `${item.id}-${variant.name}`;
    setItems((prev) => {
      const existing = prev.find((x) => x.id === newItemId);
      if (existing) {
        return prev.map((x) =>
          x.id === newItemId ? { ...x, quantity: x.quantity + quantity } : x
        );
      }
      return [
        ...prev,
        {
          id: newItemId,
          name: `${item.name} (${variant.name})`,
          price: variant.price,
          priceLabel: `₹${variant.price}`,
          quantity: quantity,
          image: item.image || "/placeholder.svg",
        },
      ];
    });
    setSelectedItem("");
    setVariantModalItem(null);
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    try {
      setSaving(true);
      await onSave(items);
      onClose();
    } catch (err) {
      console.error("Failed to update order:", err);
      toast({
        title: "Update Failed",
        description: "Failed to update order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold">Edit Order #{order.token}</h2>
            {(user?.role === "admin" || user?.role === "manager") ? (
              <p className="text-sm text-emerald-600 font-semibold">Admin Override: Post-payment edits allowed</p>
            ) : (
              <p className="text-sm text-muted-foreground">Allowed only before Preparing stage</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition">
            <X size={18} />
          </button>
        </div>

        {/* Items list */}
        <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border border-border rounded-2xl p-3">
              <div className="flex items-center gap-3">
                {item.image && (
                  <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                )}
                <div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">₹{item.price} each</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => decreaseQty(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/70">
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                <button onClick={() => increaseQty(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus size={14} />
                </button>
                <button onClick={() => removeItem(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No items left. Add at least 1 item.</p>
          )}
        </div>

        {/* Add new item */}
        <div className="border-t border-border mt-4 pt-4">
          <p className="text-sm font-semibold mb-2">Add New Item</p>
          <div className="flex gap-2">
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none"
            >
              <option value="">Select item...</option>
              {menuItems.map((m) => (
                <option key={m.id} value={String(m.id)}>{m.name} - ₹{m.price}</option>
              ))}
            </select>
            <button
              onClick={handleAddNewItem}
              disabled={!selectedItem}
              className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        <div className="border-t border-border mt-5 pt-4 flex items-center justify-between">
          <p className="font-bold text-lg">Total: ₹{total}</p>
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </motion.div>

      <VariantSelectionModal
        item={variantModalItem as any}
        isOpen={!!variantModalItem}
        onClose={() => setVariantModalItem(null)}
        onAdd={handleVariantAdd as any}
      />
    </div>
  );
};

export default EditOrderModal;
