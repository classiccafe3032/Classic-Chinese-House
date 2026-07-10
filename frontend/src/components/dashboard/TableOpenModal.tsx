import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, Users, Phone, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiAdminOpenTableSession } from "@/lib/apiClient";
import { validateName, validateMobile } from "@/lib/validators";

interface TableOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tableId: string;
  tableNumber: string;
}

export default function TableOpenModal({ isOpen, onClose, onSuccess, tableId, tableNumber }: TableOpenModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nErr = validateName(customerName, false);
    const pErr = validateMobile(customerPhone, false);

    if (nErr || pErr) {
      setNameError(nErr || "");
      setPhoneError(pErr || "");
      return;
    }

    setLoading(true);
    try {
      await apiAdminOpenTableSession(tableId, customerName, customerPhone);
      toast({ title: `Table ${tableNumber} is now Occupied!` });
      onSuccess();
      onClose();
      // Reset state for next time
      setCustomerName("");
      setCustomerPhone("");
      setNameError("");
      setPhoneError("");
    } catch (err: any) {
      toast({ title: "Failed to open table", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border border-border/50 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="text-primary" size={20} />
              Open Table {tableNumber}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-sm text-muted-foreground mb-6">
              Enter customer details to start a dining session. These fields are optional but recommended.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Customer Name (Optional)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="E.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    onBlur={(e) => setNameError(validateName(e.target.value, false) || "")}
                    className={`w-full bg-background border ${nameError ? 'border-red-500' : 'border-border'} rounded-xl pl-10 pr-4 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all`}
                  />
                </div>
                {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      if (phoneError) setPhoneError("");
                    }}
                    onBlur={(e) => setPhoneError(validateMobile(e.target.value, false) || "")}
                    className={`w-full bg-background border ${phoneError ? 'border-red-500' : 'border-border'} rounded-xl pl-10 pr-4 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all`}
                  />
                </div>
                {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "Start Session"}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
