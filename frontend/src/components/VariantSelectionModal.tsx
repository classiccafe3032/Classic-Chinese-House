import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus } from "lucide-react";
import { useState } from "react";
import type { MenuItem } from "@/lib/apiClient";

interface VariantSelectionModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: MenuItem, variant: { name: string; price: number }, quantity: number) => void;
}

export default function VariantSelectionModal({ item, isOpen, onClose, onAdd }: VariantSelectionModalProps) {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);

  if (!item || !isOpen) return null;

  const handleAdd = () => {
    if (item.variants && item.variants.length > 0) {
      onAdd(item, item.variants[selectedVariantIdx], quantity);
    }
    setQuantity(1);
    setSelectedVariantIdx(0);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-4 sm:p-0"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl pb-10 sm:pb-6 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-muted/50 hover:bg-muted rounded-full transition-colors"
          >
            <X size={20} className="text-foreground" />
          </button>

          <h3 className="text-xl font-bold font-heading pr-10 mb-1">{item.name}</h3>
          <p className="text-sm text-muted-foreground mb-6">Select a portion size</p>

          <div className="space-y-3 mb-8">
            {item.variants?.map((v, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedVariantIdx(idx)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  selectedVariantIdx === idx
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedVariantIdx === idx ? "border-primary" : "border-muted-foreground/30"
                  }`}>
                    {selectedVariantIdx === idx && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                  </div>
                  <span className="font-semibold">{v.name}</span>
                </div>
                <span className="font-bold">₹{v.price}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-muted/50 p-2 rounded-xl">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shadow-sm"
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-lg w-4 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shadow-sm"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <button
              onClick={handleAdd}
              className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex justify-between items-center px-6"
            >
              <span>Add to Order</span>
              <span>₹{item.variants ? item.variants[selectedVariantIdx].price * quantity : 0}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
