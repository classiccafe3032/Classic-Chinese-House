import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X, Save } from "lucide-react";

interface ItemNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  itemName: string;
  initialNote?: string;
}

export default function ItemNoteModal({ isOpen, onClose, onSave, itemName, initialNote = "" }: ItemNoteModalProps) {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (isOpen) {
      setNote(initialNote);
    }
  }, [isOpen, initialNote]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(note.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card border border-border/50 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <MessageSquarePlus className="text-amber-500" size={18} />
              Special Note
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSave} className="p-5">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              Add instructions for <span className="text-foreground font-bold">{itemName}</span>
            </p>
            
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Extra spicy, No onions, Less oil..."
              rows={3}
              maxLength={150}
              className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none mb-2"
            />
            <div className="text-right text-[10px] text-muted-foreground mb-4">
              {note.length}/150
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20"
              >
                <Save size={14} />
                Save Note
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
