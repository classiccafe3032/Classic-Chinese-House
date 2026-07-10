import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Star, IndianRupee, Search, Award } from "lucide-react";


interface Customer {
  id: string;
  name: string;
  phone: string;
  points_balance: number;
  total_spent: string;
  last_visit: string;
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${search}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error("Failed to fetch customers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers & Loyalty</h2>
          <p className="text-muted-foreground mt-1">
            Manage your loyalty program members and view top spenders.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by phone or name..."
          className="w-full pl-10 pr-4 py-2 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-card border rounded-2xl">No customers found.</div>
        ) : (
          customers.map((customer) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={customer.id}
              className="bg-card border rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0">
                    {customer.name ? customer.name.charAt(0).toUpperCase() : "G"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{customer.name || "Guest"}</h3>
                    <p className="text-muted-foreground text-sm mt-0.5">{customer.phone}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-600 font-bold text-xs">
                    <Star className="w-4 h-4 fill-current" />
                    {customer.points_balance} pts
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Lifetime Value</p>
                  <p className="font-black text-emerald-600 text-base">₹{parseFloat(customer.total_spent).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Last Visit</p>
                  <p className="font-medium text-sm">{new Date(customer.last_visit).toLocaleDateString()}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-card border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Points Balance</th>
                <th className="px-4 py-3">Lifetime Value</th>
                <th className="px-4 py-3">Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {customer.name ? customer.name.charAt(0).toUpperCase() : "G"}
                      </div>
                      {customer.name || "Guest"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 font-semibold text-xs">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {customer.points_balance} pts
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald-600">
                      ₹{parseFloat(customer.total_spent).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(customer.last_visit).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
