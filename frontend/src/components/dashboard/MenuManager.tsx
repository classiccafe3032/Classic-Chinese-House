import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ToggleLeft,
  ToggleRight,
  UtensilsCrossed,
  RefreshCw,
  X,
  ImageIcon,
  Loader2,
  Tag,
  Check,
  CheckSquare,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import { CategoryIconPlaceholder } from "@/components/ui/CategoryIconPlaceholder";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  apiGetMenuItems,
  apiCreateMenuItem,
  apiUpdateMenuItem,
  apiDeleteMenuItem,
  apiBulkDeleteMenuItems,
  apiToggleMenuItem,
  apiReorderMenu,
  apiGetCategories,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  type MenuItem,
  type MenuCategory,
} from "@/lib/apiClient";

interface FormData {
  name: string;
  description: string;
  price: string;
  price_label: string;
  category: string;
  image?: File | null;
  available: boolean;
  diet_type: "veg" | "non-veg" | "egg" | "none";
  variants: { name: string; price: number }[];
}

const emptyForm: FormData = {
  name: "",
  description: "",
  price: "",
  price_label: "",
  category: "",
  image: null,
  available: true,
  diet_type: "none",
  variants: [],
};
// ─── Sortable Desktop Row ───
interface SortableRowProps {
  item: MenuItem;
  selected: boolean;
  dragDisabled?: boolean;
  orderNumber: string;
  onOrderNumberChange: (val: string) => void;
  onToggleSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const SortableDesktopRow = ({
  item,
  selected,
  dragDisabled,
  orderNumber,
  onOrderNumberChange,
  onToggleSelect,
  onToggle,
  onEdit,
  onDelete,
}: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/50 transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/30"}`}
    >
      <td className="py-3 pr-1">
        {!dragDisabled ? (
          <button
            {...attributes}
            {...listeners}
            className="p-1 cursor-grab active:cursor-grabbing rounded hover:bg-muted transition-colors"
          >
            <GripVertical size={16} className="text-muted-foreground" />
          </button>
        ) : (
          <span className="p-1 opacity-30">
            <GripVertical size={16} className="text-muted-foreground" />
          </span>
        )}
      </td>
      <td className="py-3 pr-2 w-16">
        <input
          type="text"
          min={1}
          value={orderNumber}
          onChange={(e) => onOrderNumberChange(e.target.value)}
          className="w-10 px-2 py-1 text-center text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
          title="Position number"
        />
      </td>
      <td className="py-3 pr-2">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </td>
      <td className="py-3 pr-3">
        {(!item.image_url || item.image_url.includes("placeholder")) ? (
          <div className="w-12 h-12 rounded-lg bg-primary/5 border flex items-center justify-center">
            <CategoryIconPlaceholder category={item.category} className="w-6 h-6 text-primary/40" />
          </div>
        ) : (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        )}
      </td>
      <td className="py-3">
        <p className="font-semibold flex items-center gap-1.5">
          {item.name}
          {item.diet_type === "veg" && <span className="w-2.5 h-2.5 rounded-sm border border-green-600 bg-green-50 flex items-center justify-center" title="Veg"><span className="w-1 h-1 rounded-full bg-green-600"></span></span>}
          {item.diet_type === "non-veg" && <span className="w-2.5 h-2.5 rounded-sm border border-red-600 bg-red-50 flex items-center justify-center" title="Non-Veg"><span className="w-1 h-1 rounded-full bg-red-600"></span></span>}
          {item.diet_type === "egg" && <span className="w-2.5 h-2.5 rounded-sm border border-yellow-600 bg-yellow-50 flex items-center justify-center" title="Contains Egg"><span className="w-1 h-1 rounded-full bg-yellow-600"></span></span>}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {item.description}
        </p>
      </td>
      <td className="py-3 font-semibold">{item.price_label}</td>
      <td className="py-3">
        <Badge variant="secondary" className="text-xs">
          {item.category}
        </Badge>
      </td>
      <td className="py-3">
        <Badge
          variant={item.available ? "default" : "destructive"}
          className="text-xs"
        >
          {item.available ? "Available" : "Unavailable"}
        </Badge>
      </td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title={item.available ? "Mark unavailable" : "Mark available"}
          >
            {item.available ? (
              <ToggleRight size={18} className="text-primary" />
            ) : (
              <ToggleLeft size={18} className="text-muted-foreground" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Edit"
          >
            <Pencil size={16} className="text-muted-foreground" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                title="Delete"
              >
                <Trash2 size={16} className="text-destructive" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Menu Item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the menu item{" "}
                  <span className="font-mono font-semibold text-primary">
                    {item.name}
                  </span>
                  . This action cannot be undone.
                </AlertDialogDescription>{" "}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
};

const SortableMobileCard = ({
  item,
  selected,
  dragDisabled,
  orderNumber,
  onOrderNumberChange,
  onToggleSelect,
  onToggle,
  onEdit,
  onDelete,
}: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-card border rounded-2xl p-4 transition-all duration-200
      ${selected
          ? "border-primary/40 bg-primary/5"
          : "border-border hover:bg-muted/20 hover:-translate-y-[2px] hover:shadow-md"
        }`}
    >
      {/* HEADER */}
      <div className="flex gap-3 items-start">

        {/* Drag Handle */}
        {!dragDisabled ? (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 mt-2 rounded
            opacity-40 group-hover:opacity-100 transition-opacity hover:bg-muted shrink-0"
          >
            <GripVertical size={16} className="text-muted-foreground" />
          </button>
        ) : (
          <span className="p-1 mt-2 shrink-0 opacity-20">
            <GripVertical size={16} className="text-muted-foreground" />
          </span>
        )}

        {/* IMAGE */}
        {(!item.image_url || item.image_url.includes("placeholder")) ? (
          <div className="w-20 h-20 rounded-xl bg-primary/5 border flex items-center justify-center shrink-0">
            <CategoryIconPlaceholder category={item.category} className="w-10 h-10 text-primary/40" />
          </div>
        ) : (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-20 h-20 rounded-xl object-cover shrink-0
            transition-transform duration-200 group-hover:scale-105"
          />
        )}

        {/* CONTENT */}
        <div className="flex-1 min-w-0">

          {/* Title */}
          <div className="flex justify-between gap-2">
            <div>
              <p className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                {item.name}
                {item.diet_type === "veg" && <span className="w-2.5 h-2.5 rounded-sm border border-green-600 bg-green-50 flex items-center justify-center" title="Veg"><span className="w-1 h-1 rounded-full bg-green-600"></span></span>}
                {item.diet_type === "non-veg" && <span className="w-2.5 h-2.5 rounded-sm border border-red-600 bg-red-50 flex items-center justify-center" title="Non-Veg"><span className="w-1 h-1 rounded-full bg-red-600"></span></span>}
                {item.diet_type === "egg" && <span className="w-2.5 h-2.5 rounded-sm border border-yellow-600 bg-yellow-50 flex items-center justify-center" title="Contains Egg"><span className="w-1 h-1 rounded-full bg-yellow-600"></span></span>}
              </p>

              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>

            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              className="mt-1 shrink-0"
            />
          </div>

          {/* Price + Tags */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="font-bold text-sm">{item.price_label}</span>

            <Badge
              variant="secondary"
              className="text-[10px] px-2 py-0.5 rounded-full"
            >
              {item.category}
            </Badge>

            <Badge
              variant={item.available ? "default" : "destructive"}
              className="text-[10px] px-2 py-0.5 rounded-full"
            >
              {item.available ? "Available" : "Hidden"}
            </Badge>
          </div>
        </div>
      </div>

      {/* META ROW */}
      <div className="flex items-center justify-between mt-4">

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Order</span>

          <input
            type="text"
            inputMode="numeric"
            value={orderNumber}
            onChange={(e) =>
              onOrderNumberChange(e.target.value.replace(/\D/g, ""))
            }
            className="w-10 px-2 py-1 text-center text-xs rounded-full border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>

        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80"
        >
          {item.available ? (
            <>
              <ToggleRight size={14} className="text-primary" />
              Available
            </>
          ) : (
            <>
              <ToggleLeft size={14} />
              Hidden
            </>
          )}
        </button>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-2 mt-4">

        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs"
        >
          <Pencil size={14} />
          Edit
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs">
              <Trash2 size={14} />
              Delete
            </button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete "{item.name}"?
              </AlertDialogTitle>

              <AlertDialogDescription>
                This will permanently remove this item from the menu.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>

              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>

            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const MenuManager = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Category management state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState<Record<number, string>>({});

  const categoryNames = categories.map((c) => c.name);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const isFilterActive = catFilter !== "All" || search.trim() !== "";

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isFilterActive) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    setReordering(true);
    try {
      await apiReorderMenu(reordered.map((i) => i.id));
      toast({ title: "Menu order saved ✅" });
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" });
      fetchItems();
    } finally {
      setReordering(false);
    }
  };

  // Initialize order numbers when items change
  useEffect(() => {
    const nums: Record<number, string> = {};
    items.forEach((item, idx) => {
      nums[item.id] = String(idx + 1);
    });
    setOrderNumbers(nums);
  }, [items]);

  const handleOrderNumberChange = (id: number, val: string) => {
    setOrderNumbers((prev) => ({ ...prev, [id]: val }));
  };

  const hasOrderChanged = useMemo(() => {
    return items.some((item, idx) => {
      const num = parseInt(orderNumbers[item.id] || "0", 10);
      return num !== idx + 1;
    });
  }, [items, orderNumbers]);

  const handleApplyNumberOrder = async () => {
    // Build array of { id, num } and sort by num
    const sorted = items
      .map((item) => ({
        id: item.id,
        num: parseInt(orderNumbers[item.id] || "0", 10) || 999,
      }))
      .sort((a, b) => a.num - b.num);

    const reordered = sorted.map((s) => items.find((i) => i.id === s.id)!);
    setItems(reordered);

    setReordering(true);
    try {
      await apiReorderMenu(reordered.map((i) => i.id));
      toast({ title: "Menu order applied ✅" });
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" });
      fetchItems();
    } finally {
      setReordering(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiGetMenuItems();
      setItems(data);
    } catch {
      toast({ title: "Failed to load menu items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiGetCategories();
      setCategories(data);
    } catch {
      console.error("Failed to load categories");
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesCat = catFilter === "All" || item.category === catFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [items, search, catFilter]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm, category: categoryNames[0] || "" });
    setModalOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      price_label: item.price_label,
      category: item.category,
      image: null,
      available: item.available,
      diet_type: item.diet_type || "none",
      variants: item.variants || [],
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.price ||
      !form.price_label.trim() ||
      !form.category
    ) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await apiUpdateMenuItem(editingItem.id, {
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          price_label: form.price_label,
          category: form.category,
          image: form.image || undefined,
          diet_type: form.diet_type,
          available: form.available,
          variants: form.variants.length > 0 ? form.variants : [],
        });
        toast({ title: "Menu item updated ✅" });
      } else {
        await apiCreateMenuItem({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          price_label: form.price_label,
          category: form.category,
          image: form.image || undefined,
          diet_type: form.diet_type,
          available: form.available,
          variants: form.variants.length > 0 ? form.variants : [],
        });
        toast({ title: "Menu item created ✅" });
      }
      setModalOpen(false);
      fetchItems();
    } catch (err: any) {
      toast({ title: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: MenuItem) => {
    try {
      const updated = await apiToggleMenuItem(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      toast({
        title: updated.available
          ? `${item.name} is now available`
          : `${item.name} marked unavailable`,
      });
    } catch {
      toast({ title: "Failed to toggle", variant: "destructive" });
    }
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      await apiDeleteMenuItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast({ title: `${item.name} deleted` });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handlePriceInput = (val: string) => {
    const numeric = val.replace(/[^\d.]/g, "");
    setForm((f) => ({
      ...f,
      price: numeric,
      price_label: numeric ? `₹${numeric}` : "",
    }));
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await apiBulkDeleteMenuItems(ids);
      toast({ title: `${ids.length} menu items deleted` });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      fetchItems();
    } catch {
      toast({ title: "Failed to bulk delete", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      await apiCreateCategory(newCatName.trim());
      toast({ title: `Category "${newCatName.trim()}" created ✅` });
      setNewCatName("");
      fetchCategories();
    } catch (err: any) {
      toast({
        title: err.message || "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setSavingCat(false);
    }
  };

  const handleUpdateCategory = async (cat: MenuCategory) => {
    if (!editCatName.trim() || editCatName.trim() === cat.name) {
      setEditingCat(null);
      return;
    }
    setSavingCat(true);
    try {
      await apiUpdateCategory(cat.id, editCatName.trim());
      toast({ title: `Category renamed to "${editCatName.trim()}" ✅` });
      setEditingCat(null);
      fetchCategories();
      fetchItems(); // items may have updated category
    } catch (err: any) {
      toast({
        title: err.message || "Failed to update category",
        variant: "destructive",
      });
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (cat: MenuCategory) => {
    try {
      await apiDeleteCategory(cat.id);
      toast({ title: `Category "${cat.name}" deleted` });
      fetchCategories();
    } catch (err: any) {
      toast({
        title: err.message || "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold">Menu Manager</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} items · {items.filter((i) => i.available).length}{" "}
            available · {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCatModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 font-semibold text-sm transition-colors"
          >
            <Tag size={16} /> Categories
          </button>
          <button
            onClick={fetchItems}
            className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none text-sm"
          />
        </div>
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {["All", ...categoryNames].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${catFilter === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
              <CheckSquare size={16} className="text-destructive" />
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 size={14} className="mr-1" />
                Delete Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table - Desktop */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <UtensilsCrossed
            size={48}
            className="mx-auto mb-4 text-muted-foreground/30"
          />
          <p className="text-muted-foreground font-medium">
            No menu items found
          </p>
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filtered.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {isFilterActive && (
                <p className="text-xs text-muted-foreground mb-3 italic">
                  Clear filters to reorder items via drag & drop
                </p>
              )}
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 pr-2 w-8"></th>
                      <th className="pb-3 pr-2 w-16 font-semibold text-muted-foreground">#</th>
                      <th className="pb-3 pr-2">
                        <Checkbox
                          checked={
                            filtered.length > 0 &&
                            selectedIds.size === filtered.length
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="pb-3 font-semibold text-muted-foreground">
                        Image
                      </th>
                      <th className="pb-3 font-semibold text-muted-foreground">
                        Name
                      </th>
                      <th className="pb-3 font-semibold text-muted-foreground">
                        Price
                      </th>
                      <th className="pb-3 font-semibold text-muted-foreground">
                        Category
                      </th>
                      <th className="pb-3 font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="pb-3 font-semibold text-muted-foreground text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <SortableDesktopRow
                        key={item.id}
                        item={item}
                        selected={selectedIds.has(item.id)}
                        dragDisabled={isFilterActive}
                        orderNumber={orderNumbers[item.id] || ""}
                        onOrderNumberChange={(val) => handleOrderNumberChange(item.id, val)}
                        onToggleSelect={() => toggleSelect(item.id)}
                        onToggle={() => handleToggle(item)}
                        onEdit={() => openEdit(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((item) => (
                  <SortableMobileCard
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    dragDisabled={isFilterActive}
                    orderNumber={orderNumbers[item.id] || ""}
                    onOrderNumberChange={(val) => handleOrderNumberChange(item.id, val)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onToggle={() => handleToggle(item)}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex items-center gap-3 mt-3">
            {hasOrderChanged && !reordering && (
              <Button
                size="sm"
                onClick={handleApplyNumberOrder}
                className="text-xs"
              >
                <Check size={14} className="mr-1" /> Apply Order
              </Button>
            )}
            {reordering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Saving order...
              </div>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">
                  {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">
                    Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    maxLength={100}
                    placeholder="Hot and Sour Soup"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    maxLength={300}
                    rows={2}
                    placeholder="Brief description (optional)..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">
                      Price (₹) *
                    </label>
                    <input
                      value={form.price}
                      onChange={(e) => handlePriceInput(e.target.value)}
                      placeholder="149"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">
                      Price Label
                    </label>
                    <input
                      value={form.price_label}
                      readOnly
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted text-sm cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">
                      Category *
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-sm"
                    >
                      {categoryNames.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">
                      Dietary Preference
                    </label>
                    <select
                      value={form.diet_type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, diet_type: e.target.value as any }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-sm"
                    >
                      <option value="none">None / N/A</option>
                      <option value="veg">🟢 Veg</option>
                      <option value="non-veg">🔺 Non-Veg</option>
                      <option value="egg">🟡 Contains Egg</option>
                    </select>
                  </div>
                </div>

                {/* Variants Section */}
                <div className="border border-border p-4 rounded-xl bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold">Portions / Variants (Optional)</label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, variants: [...f.variants, { name: "", price: 0 }] }))}
                      className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-semibold hover:bg-primary/20 flex items-center gap-1"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {form.variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={v.name}
                        onChange={e => {
                          const newV = [...form.variants];
                          newV[idx].name = e.target.value;
                          setForm(f => ({ ...f, variants: newV }));
                        }}
                        placeholder="e.g. Half"
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                      />
                      <input
                        type="number"
                        value={v.price || ""}
                        onChange={e => {
                          const newV = [...form.variants];
                          newV[idx].price = Number(e.target.value);
                          setForm(f => ({ ...f, variants: newV }));
                        }}
                        placeholder="Price"
                        className="w-20 sm:w-24 min-w-0 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newV = [...form.variants];
                          newV.splice(idx, 1);
                          setForm(f => ({ ...f, variants: newV }));
                        }}
                        className="p-1.5 shrink-0 text-muted-foreground hover:text-destructive bg-background border border-border rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {form.variants.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Add variants like Half/Full. If none added, the main price above is used.</p>
                  )}
                </div>

                <div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">
                      Image
                    </label>

                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            image: e.target.files?.[0] || null,
                          }))
                        }
                      />

                      <div className="flex flex-col items-center justify-center border border-border rounded-xl p-6 bg-background hover:bg-muted/30 transition">
                        <ImageIcon
                          className="text-muted-foreground mb-2"
                          size={28}
                        />
                        <p className="text-sm font-medium">
                          {form.image
                            ? form.image.name
                            : "Click to upload image"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, WEBP (max 5MB)
                        </p>
                      </div>
                    </label>
                    {/* New Image Preview */}
                    {form.image && (
                      <img
                        src={URL.createObjectURL(form.image)}
                        alt="Preview"
                        className="mt-2 w-full h-32 object-cover rounded-xl border border-border transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/10"
                      />
                    )}
                  </div>

                  {/* Existing Image Preview when editing */}
                  {!form.image && editingItem?.image_url && !editingItem.image_url.includes("placeholder") && (
                    <img
                      src={editingItem.image_url}
                      alt="Existing"
                      className="mt-2 w-full h-32 object-cover rounded-xl border border-border"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold">Available</label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, available: !f.available }))
                    }
                    className="p-1"
                  >
                    {form.available ? (
                      <ToggleRight size={28} className="text-primary" />
                    ) : (
                      <ToggleLeft size={28} className="text-muted-foreground" />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingItem ? "Update Item" : "Create Item"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {catModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setCatModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Tag size={20} /> Manage Categories
                </h3>
                <button
                  onClick={() => setCatModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Add new category */}
              <div className="flex gap-2 mb-5">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <button
                  onClick={handleAddCategory}
                  disabled={savingCat || !newCatName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingCat ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Add
                </button>
              </div>

              {/* Category list */}
              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    No categories yet. Add one above.
                  </p>
                ) : (
                  categories.map((cat) => {
                    const itemCount = items.filter(
                      (i) => i.category === cat.name,
                    ).length;
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center gap-2 p-3 rounded-xl border border-border bg-background"
                      >
                        {editingCat?.id === cat.id ? (
                          <>
                            <input
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-card focus:ring-2 focus:ring-ring focus:outline-none text-sm"
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleUpdateCategory(cat)
                              }
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateCategory(cat)}
                              disabled={savingCat}
                              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                              {savingCat ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} className="text-primary" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingCat(null)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 font-medium text-sm">
                              {cat.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {itemCount} items
                            </Badge>
                            <button
                              onClick={() => {
                                setEditingCat(cat);
                                setEditCatName(cat.name);
                              }}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Rename"
                            >
                              <Pencil
                                size={14}
                                className="text-muted-foreground"
                              />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2
                                    size={14}
                                    className="text-destructive"
                                  />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete "{cat.name}"?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {itemCount > 0
                                      ? `This category has ${itemCount} menu items. Reassign them to another category before deleting.`
                                      : "This will permanently remove this category."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={itemCount > 0}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Delete {selectedIds.size} Menu Items
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{selectedIds.size}</strong> selected menu items? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting
                ? "Deleting..."
                : `Delete ${selectedIds.size} Items`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuManager;
