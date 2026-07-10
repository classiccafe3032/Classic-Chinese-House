import { useState, useEffect } from "react";
import { apiAdminGetTables, apiAdminCreateTable, apiDeleteTable, type Table } from "@/lib/apiClient";
import { Printer, QrCode, Loader2, Plus, X, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { printQRCodeNative } from "@/lib/thermalPrinter";

export default function TableQRCodes() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [addingTable, setAddingTable] = useState(false);
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const data = await apiAdminGetTables();
      setTables(data);
    } catch (err: any) {
      toast({ title: "Failed to load tables", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTable = async () => {
    if (!newTableNumber.trim()) return;
    setAddingTable(true);
    try {
      await apiAdminCreateTable(newTableNumber.trim());
      await fetchTables();
      setShowAddTableModal(false);
      setNewTableNumber("");
      toast({ title: "Table successfully created" });
    } catch (err: any) {
      toast({ title: "Failed to create table", description: err.message, variant: "destructive" });
    } finally {
      setAddingTable(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this table?")) return;
    setDeletingTableId(id);
    try {
      await apiDeleteTable(id);
      toast({ title: "Table deleted successfully", className: "bg-emerald-500 text-white border-none" });
      await fetchTables();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete table", variant: "destructive" });
    } finally {
      setDeletingTableId(null);
    }
  };

  const printSingleQR = async (table: Table) => {
    const url = window.location.origin + '/table/' + table.qrCode;
    
    if (Capacitor.isNativePlatform()) {
      const success = await printQRCodeNative(url, `Table ${table.tableNumber}`);
      if (!success) toast({ title: "Printer Error", description: "Failed to connect to Bluetooth printer.", variant: "destructive" });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Print QR - Table ${table.tableNumber}</title></head>
          <body style="text-align: center; font-family: system-ui, sans-serif; padding-top: 50px;">
            <h1 style="font-size: 48px; margin-bottom: 5px;">Table ${table.tableNumber}</h1>
            <p style="font-size: 24px; color: #666; margin-top: 0; font-weight: bold;">Scan to view menu & order!</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}" style="width: 400px; height: 400px; margin-top: 30px;" />
            <script>
              window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const printAllQRs = async () => {
    if (tables.length === 0) {
      toast({ title: "No tables available to print" });
      return;
    }
    
    if (Capacitor.isNativePlatform()) {
      let failed = 0;
      for (const table of tables) {
        const url = window.location.origin + '/table/' + table.qrCode;
        const success = await printQRCodeNative(url, `Table ${table.tableNumber}`);
        if (!success) failed++;
        // Give printer a tiny break between prints
        await new Promise(r => setTimeout(r, 1000));
      }
      if (failed > 0) toast({ title: "Printer Error", description: `Failed to print ${failed} QR codes.`, variant: "destructive" });
      else toast({ title: "Successfully printed all QRs!" });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let htmlContent = `
        <html>
          <head>
            <title>Print All QRs</title>
            <style>
              @media print {
                .page-break { page-break-after: always; }
              }
              body { text-align: center; font-family: system-ui, sans-serif; margin: 0; padding: 0; }
              .page { padding-top: 100px; height: 100vh; box-sizing: border-box; }
            </style>
          </head>
          <body>
      `;

      tables.forEach((table, index) => {
        htmlContent += `
          <div class="page ${index !== tables.length - 1 ? 'page-break' : ''}">
            <h1 style="font-size: 64px; margin-bottom: 10px;">Table ${table.tableNumber}</h1>
            <p style="font-size: 32px; color: #666; margin-top: 0; font-weight: bold;">Scan to view menu & order!</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(window.location.origin + '/table/' + table.qrCode)}" style="width: 500px; height: 500px; margin-top: 50px;" />
          </div>
        `;
      });

      htmlContent += `
            <script>
              window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 1000); }
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Table Setup & QR Codes</h2>
          <p className="text-muted-foreground text-sm">Create, delete, and print QR codes for tables</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={printAllQRs}
            className="flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
          >
            <Printer size={16} /> Print All QRs
          </button>
          <button
            onClick={() => setShowAddTableModal(true)}
            className="flex-1 sm:flex-none bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
          >
            <Plus size={16} /> Add Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tables.map(table => (
          <div key={table.id} className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm relative">
            <button
              onClick={() => handleDeleteTable(table.id)}
              disabled={deletingTableId === table.id}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition disabled:opacity-50"
              title="Delete Table"
            >
              {deletingTableId === table.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
            <h3 className="font-bold text-lg mb-4">Table {table.tableNumber}</h3>
            <div className="bg-muted p-2 rounded-xl inline-block mb-4">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=000000&data=${encodeURIComponent(window.location.origin + '/table/' + table.qrCode)}`}
                alt={`Table ${table.tableNumber} QR`}
                className="w-32 h-32 rounded-lg mix-blend-multiply"
              />
            </div>
            <button
              onClick={() => printSingleQR(table)}
              className="w-full bg-secondary/10 text-secondary-foreground hover:bg-secondary/20 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <Printer size={16} /> Print QR
            </button>
          </div>
        ))}

        {tables.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
            <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tables created yet.</p>
          </div>
        )}
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowAddTableModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold mb-4">Add New Table</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Table Number / Label</label>
                <input
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="e.g. 5, Balcony 1"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
                  autoFocus
                />
              </div>
              <button
                onClick={handleAddTable}
                disabled={addingTable || !newTableNumber.trim()}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingTable ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
