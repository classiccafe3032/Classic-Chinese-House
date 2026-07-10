import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  UserPlus,
  Shield,
  Users,
  ToggleLeft,
  ToggleRight,
  Pencil,
  X,
  Phone
} from "lucide-react";
import {
  apiAdminListStaff,
  apiAdminCreateStaff,
  apiAdminUpdateStaff,
  apiAdminDeleteStaff,
  apiGetStaffPerformance,
  type StaffMember,
  type StaffPerformance
} from "@/lib/apiClient";
import { validateName, validateMobile } from "@/lib/validators";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const StaffManager = () => {
  const [staff, setStaff] = useState<(StaffMember & { performance?: StaffPerformance })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "waiter" | "kitchen">("waiter");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const defaultPermissions = {
    canClearTable: false,
    canTransferTable: false,
    canViewOrderStats: false,
    tabs: {
      orders: true, tables: false, sales: false, analytics: false, content: false, management: false, system: false, staff: false
    },
    orders: {
      active: true, pos: true, history: true
    }
  };
  const [permissions, setPermissions] = useState<any>(defaultPermissions);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const [data, perfData] = await Promise.all([
        apiAdminListStaff(),
        apiGetStaffPerformance().catch(() => [])
      ]);
      const merged = data.map(member => ({
        ...member,
        performance: perfData.find(p => p.id === member.id)
      }));
      setStaff(merged);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load staff",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!pin && !editingStaff) || !role) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    if (pin && (pin.length !== 4 || !/^\d+$/.test(pin))) {
      toast({ title: "Validation Error", description: "PIN must be 4 digits", variant: "destructive" });
      return;
    }

    const nErr = validateName(name, true);
    const pErr = validateMobile(phone, false); // Phone is optional

    if (nErr || pErr) {
      setNameError(nErr || "");
      setPhoneError(pErr || "");
      return;
    }

    setSubmitting(true);
    try {
      if (editingStaff) {
        await apiAdminUpdateStaff(editingStaff.id, { name, role, pin: pin || undefined, phone: phone || undefined, permissions });
        toast({ title: "Success", description: "Staff updated successfully" });
      } else {
        await apiAdminCreateStaff(name, pin, role, phone || undefined, permissions);
        toast({ title: "Success", description: "Staff added successfully" });
      }
      setShowAddModal(false);
      setEditingStaff(null);
      resetForm();
      loadStaff();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Operation failed",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    try {
      await apiAdminUpdateStaff(member.id, { is_active: !member.is_active });
      toast({ title: "Status Updated", description: `${member.name} is now ${!member.is_active ? 'active' : 'inactive'}` });
      loadStaff();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
      await apiAdminDeleteStaff(id);
      toast({ title: "Deleted", description: "Staff member removed" });
      loadStaff();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setName("");
    setRole("waiter");
    setPin("");
    setPhone("");
    setNameError("");
    setPhoneError("");
    setPermissions(defaultPermissions);
  };

  const openEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setName(member.name);
    setRole(member.role);
    setPin("");
    setPhone(member.phone || "");
    setPermissions(member.permissions || defaultPermissions);
    setShowAddModal(true);
  };

  const handlePermissionChange = (field: string, value: boolean) => {
    if (field.startsWith('tabs.')) {
      const tabName = field.split('.')[1];
      setPermissions((prev: any) => ({ ...prev, tabs: { ...(prev?.tabs || {}), [tabName]: value } }));
    } else if (field.startsWith('orders.')) {
      const subTab = field.split('.')[1];
      setPermissions((prev: any) => ({ ...prev, orders: { ...(prev?.orders || {}), [subTab]: value } }));
    } else {
      setPermissions((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  const roleColors: Record<string, string> = {
    manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    waiter: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    kitchen: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
  };

  return (
    <div className="container mx-auto px-4 pb-12 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading">Staff Management</h1>
          <p className="text-muted-foreground text-sm">Manage employee roles and access PINs</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingStaff(null); setShowAddModal(true); }}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all whitespace-nowrap"
        >
          <UserPlus size={18} />
          Add Staff
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No staff members found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {staff.map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-card border ${member.is_active ? 'border-border/50' : 'border-destructive/20 opacity-75'} rounded-3xl p-5 shadow-sm hover:shadow-md transition-all`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Shield className="text-primary" size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(member)}
                      className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(member)}
                      className={`p-2 rounded-xl transition-colors ${member.is_active ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {member.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="p-2 hover:bg-destructive/10 rounded-xl transition-colors text-destructive"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-lg">{member.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider ${roleColors[member.role]}`}>
                    {member.role}
                  </span>
                  {!member.is_active && (
                    <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-lg text-xs font-bold">
                      INACTIVE
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  Joined: {new Date(member.created_at).toLocaleDateString()}
                </p>
                {member.phone && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 opacity-80">
                    <Phone size={12} /> {member.phone}
                  </p>
                )}

                {member.role === "waiter" && member.performance && (
                  <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Orders (Month)</span>
                      <span className="font-bold">{member.performance.totalOrders}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs text-muted-foreground">Sales (Month)</span>
                      <span className="font-bold text-emerald-600">₹{member.performance.totalSales.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border p-8 rounded-[2rem] shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold font-heading mb-6">
                {editingStaff ? "Edit Staff" : "Add New Staff"}
              </h2>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const nErr = validateName(name, true);
                const pErr = validateMobile(phone, false);
                if (nErr || pErr) {
                  setNameError(nErr || "");
                  setPhoneError(pErr || "");
                  return;
                }
                await handleSubmit(e);
              }} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    onBlur={(e) => setNameError(validateName(e.target.value, true) || "")}
                    placeholder="E.g. Rahul Sharma"
                    className={`w-full bg-background border ${nameError ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                  />
                  {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-ring transition-all outline-none"
                  >
                    <option value="manager">Manager</option>
                    <option value="waiter">Waiter</option>
                    <option value="kitchen">Kitchen Staff</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                      if (phoneError) setPhoneError("");
                    }}
                    onBlur={(e) => setPhoneError(validateMobile(e.target.value, false) || "")}
                    placeholder="10-digit number"
                    className={`w-full bg-background border ${phoneError ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                  />
                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1">
                    {editingStaff ? "New PIN (leave blank to keep current)" : "4-Digit PIN"}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required={!editingStaff}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234"
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-ring transition-all outline-none tracking-[0.5em] text-center font-mono text-lg"
                  />
                </div>

                {/* PERMISSIONS CHECKLIST */}
                <div className="space-y-3 mt-4 pt-4 border-t border-border">
                  <label className="text-sm font-semibold ml-1 block">Staff Permissions</label>
                  <div className="bg-muted/50 p-4 rounded-xl space-y-4">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Actions</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={permissions?.canClearTable || false} onChange={(e) => handlePermissionChange('canClearTable', e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4" />
                          Clear Table
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={permissions?.canTransferTable || false} onChange={(e) => handlePermissionChange('canTransferTable', e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4" />
                          Transfer Table
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={permissions?.canViewOrderStats || false} onChange={(e) => handlePermissionChange('canViewOrderStats', e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4" />
                          View Order Stats
                        </label>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Dashboard Tabs</p>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 items-start">
                        {['orders', 'tables', 'sales', 'analytics', 'content', 'management', 'system', 'staff'].map(tab => (
                          <div key={tab} className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer capitalize font-medium">
                              <input type="checkbox" checked={permissions?.tabs?.[tab] || false} onChange={(e) => handlePermissionChange(`tabs.${tab}`, e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4" />
                              {tab}
                            </label>
                            {tab === 'orders' && permissions?.tabs?.orders && (
                              <div className="flex flex-col gap-2 ml-6 mt-1">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input type="checkbox" checked={permissions?.orders?.active || false} onChange={(e) => handlePermissionChange('orders.active', e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                                  <span className="text-xs text-muted-foreground font-medium">Active Orders</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input type="checkbox" checked={permissions?.orders?.pos || false} onChange={(e) => handlePermissionChange('orders.pos', e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                                  <span className="text-xs text-muted-foreground font-medium">New Order</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input type="checkbox" checked={permissions?.orders?.history || false} onChange={(e) => handlePermissionChange('orders.history', e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                                  <span className="text-xs text-muted-foreground font-medium">History</span>
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 mt-4"
                >
                  {submitting ? "Processing..." : editingStaff ? "Update Staff" : "Confirm Addition"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffManager;
