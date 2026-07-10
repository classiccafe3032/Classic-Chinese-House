import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRightLeft, X } from "lucide-react";
import { apiAdminTransferTableSession } from "@/lib/apiClient";
import { toast } from "sonner";
import type { Table } from "@/lib/apiClient";

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sessionId: string;
  currentTableNumber: string;
  availableTables: Table[];
}

export default function TableTransferModal({
  isOpen,
  onClose,
  onSuccess,
  sessionId,
  currentTableNumber,
  availableTables,
}: TableTransferModalProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!selectedTableId) {
      toast.error("Please select a destination table");
      return;
    }
    
    setLoading(true);
    try {
      await apiAdminTransferTableSession(sessionId, selectedTableId);
      toast.success(`Table transferred successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer table");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="text-primary" />
              Transfer Table {currentTableNumber}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Select an available table to move the active session and bill.
            </p>

            {availableTables.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-border border-dashed">
                No tables are currently available to transfer to.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6 max-h-60 overflow-y-auto pr-2">
                {availableTables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTableId(t.id)}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                      selectedTableId === t.id
                        ? "ring-4 ring-primary bg-primary/20 text-primary scale-105 shadow-md z-10"
                        : "bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20"
                    }`}
                  >
                    <span className="text-sm font-semibold opacity-80 uppercase tracking-widest">TBL</span>
                    <span className="text-3xl font-black">{t.tableNumber}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleTransfer}
              disabled={loading || !selectedTableId}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Confirm Transfer"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
