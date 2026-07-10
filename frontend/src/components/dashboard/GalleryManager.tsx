import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, GripVertical, ImageIcon, Loader2, CheckSquare, Square, X } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  apiGetGalleryImages,
  apiUploadGalleryImage,
  apiDeleteGalleryImage,
  apiReorderGallery,
  type GalleryImage,
} from "@/lib/apiClient";

/* ── Sortable image card ── */
function SortableImageCard({
  image,
  onDelete,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  image: GalleryImage;
  onDelete: (id: number) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative group rounded-2xl overflow-hidden border bg-card aspect-square ${
        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
      onClick={selectionMode ? () => onToggleSelect(image.id) : undefined}
    >
      <img
        src={image.image_url}
        alt={image.alt_text || "Gallery image"}
        className="w-full h-full object-cover"
      />

      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-2 left-2 z-10">
          {selected ? (
            <CheckSquare size={22} className="text-primary drop-shadow" />
          ) : (
            <Square size={22} className="text-muted-foreground drop-shadow" />
          )}
        </div>
      )}

      {/* Drag handle */}
      {!selectionMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
      )}

      {/* Delete button */}
      {!selectionMode && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-destructive/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-destructive-foreground">
              <Trash2 size={16} />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this image?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the image from the gallery.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(image.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </motion.div>
  );
}

/* ── Gallery Manager ── */
const GalleryManager = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const fetchImages = async () => {
    try {
      const data = await apiGetGalleryImages();
      setImages(data);
    } catch {
      toast.error("Failed to load gallery images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const oversized = fileArray.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} file(s) exceed 5MB and will be skipped`);
    }

    const validFiles = fileArray.filter((f) => f.size <= 5 * 1024 * 1024);
    if (validFiles.length === 0) return;

    setUploading(true);
    let uploaded = 0;
    let failed = 0;

    for (const file of validFiles) {
      setUploadProgress(`Uploading ${uploaded + 1} of ${validFiles.length}...`);
      try {
        const newImage = await apiUploadGalleryImage(file);
        setImages((prev) => [...prev, newImage]);
        uploaded++;
      } catch {
        failed++;
      }
    }

    setUploading(false);
    setUploadProgress("");
    e.target.value = "";

    if (uploaded > 0) toast.success(`${uploaded} image(s) uploaded!`);
    if (failed > 0) toast.error(`${failed} image(s) failed to upload`);
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDeleteGalleryImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(images.map((img) => img.id)));
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;

    for (const id of selectedIds) {
      try {
        await apiDeleteGalleryImage(id);
        deleted++;
      } catch {
        failed++;
      }
    }

    setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
    setSelectedIds(new Set());
    setBulkDeleting(false);
    setSelectionMode(false);

    if (deleted > 0) toast.success(`${deleted} image(s) deleted`);
    if (failed > 0) toast.error(`${failed} image(s) failed to delete`);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((img) => img.id === active.id);
    const newIndex = images.findIndex((img) => img.id === over.id);
    const reordered = arrayMove(images, oldIndex, newIndex);

    setImages(reordered);

    try {
      await apiReorderGallery(reordered.map((img) => img.id));
    } catch {
      toast.error("Failed to save order");
      fetchImages();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-heading font-bold">Gallery Manager</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Upload, reorder, and manage gallery images. Drag to reorder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selection mode toggle */}
          {images.length > 0 && !selectionMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition"
            >
              <CheckSquare size={16} />
              Select
            </button>
          )}

          {/* Upload button */}
          <label className="relative">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
              multiple
            />
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm cursor-pointer hover:bg-primary/90 transition">
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {uploading ? uploadProgress || "Uploading..." : "Add Images"}
            </span>
          </label>
        </div>
      </div>

      {/* Selection toolbar */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border"
          >
            <span className="text-sm font-medium text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <button
              onClick={selectAll}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Select All
            </button>

            <div className="flex-1" />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={selectedIds.size === 0 || bulkDeleting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete ({selectedIds.size})
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selectedIds.size} image(s)?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the selected images from the
                    gallery.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <button
              onClick={exitSelection}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-background transition"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery grid */}
      {images.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={36} className="text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">No gallery images</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Upload your first image to get started
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {images.map((image) => (
                  <SortableImageCard
                    key={image.id}
                    image={image}
                    onDelete={handleDelete}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(image.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </motion.div>
  );
};

export default GalleryManager;
