import { useRef, useState } from "react";
import { Plus, X, Loader2, Upload, GripVertical } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TarefaGridPost } from "@/hooks/useTarefaGrid";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GridPostsManagerProps {
  gridPosts: TarefaGridPost[];
  onUpload: (posicao: number, file: File) => Promise<void>;
  onBatchUpload?: (files: File[]) => Promise<number>;
  onRemove: (posicao: number) => Promise<void>;
  onReorder?: (newOrder: { id: string; posicao: number }[]) => Promise<void>;
  uploading: boolean;
}

function SortableGridItem({
  post,
  index,
  onRemove,
  uploading,
}: {
  post: TarefaGridPost;
  index: number;
  onRemove: (posicao: number) => void;
  uploading: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  const statusColor = (s: string) => {
    if (s === "aprovado") return "ring-2 ring-emerald-500";
    if (s === "reprovado") return "ring-2 ring-red-500";
    return "";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative aspect-[4/5] rounded-md border-2 border-border overflow-hidden bg-muted/30",
        statusColor(post.status),
        isDragging && "shadow-lg"
      )}
    >
      <img
        src={post.image_url}
        alt={`Post ${index + 1}`}
        className="w-full h-full object-cover"
      />
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded bg-background/80 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-3 h-3 text-foreground/70" />
      </div>
      {/* Position number */}
      <div className="absolute bottom-0.5 left-0.5 w-4 h-4 rounded-full bg-background/70 flex items-center justify-center text-[9px] font-medium text-foreground">
        {index + 1}
      </div>
      {/* Remove button */}
      <button
        onClick={e => {
          e.stopPropagation();
          onRemove(post.posicao);
        }}
        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
      {post.status !== "pendente" && (
        <Badge
          className={cn(
            "absolute bottom-0.5 right-0.5 text-[8px] px-1 py-0 border-0",
            post.status === "aprovado" ? "bg-emerald-500/80 text-white" : "bg-red-500/80 text-white"
          )}
        >
          {post.status === "aprovado" ? "✓" : "✗"}
        </Badge>
      )}
    </div>
  );
}

export function GridPostsManager({ gridPosts, onUpload, onBatchUpload, onRemove, onReorder, uploading }: GridPostsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const activePosRef = useRef<number>(0);
  const [batchUploading, setBatchUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const sortedPosts = [...gridPosts].sort((a, b) => a.posicao - b.posicao);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = sortedPosts.findIndex(p => p.id === active.id);
    const newIndex = sortedPosts.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedPosts, oldIndex, newIndex);
    const newOrder = reordered.map((p, i) => ({ id: p.id, posicao: i }));

    try {
      await onReorder(newOrder);
    } catch {
      toast.error("Erro ao reordenar");
    }
  };

  const handleSlotClick = (posicao: number) => {
    activePosRef.current = posicao;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    try {
      await onUpload(activePosRef.current, file);
      toast.success(`Imagem ${activePosRef.current + 1} enviada!`);
    } catch {
      toast.error("Erro ao enviar imagem");
    }
    e.target.value = "";
  };

  const handleBatchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    const available = 9 - gridPosts.length;
    if (available === 0) {
      toast.error("A grade já está completa (9/9)");
      return;
    }
    const toUpload = imageFiles.slice(0, available);
    if (imageFiles.length > available) {
      toast.warning(`Apenas ${available} posição(ões) disponível(is). ${imageFiles.length - available} arquivo(s) ignorado(s).`);
    }
    setBatchUploading(true);
    try {
      const count = await onBatchUpload?.(toUpload);
      toast.success(`${count || toUpload.length} imagem(ns) enviada(s)!`);
    } catch {
      toast.error("Erro ao enviar imagens");
    } finally {
      setBatchUploading(false);
    }
    e.target.value = "";
  };

  const isUploading = uploading || batchUploading;

  // Find next available position for empty slots
  const usedPositions = new Set(gridPosts.map(g => g.posicao));
  const emptySlots: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (!usedPositions.has(i)) emptySlots.push(i);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Grade do Instagram <span className="font-normal text-muted-foreground">({gridPosts.length}/9)</span>
        </Label>
        {onBatchUpload && gridPosts.length < 9 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={isUploading}
            onClick={() => batchInputRef.current?.click()}
          >
            <Upload className="w-3 h-3" />
            Enviar vários
          </Button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchChange} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedPosts.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-1.5 max-w-[320px]">
            {sortedPosts.map((post, i) => (
              <SortableGridItem
                key={post.id}
                post={post}
                index={i}
                onRemove={onRemove}
                uploading={isUploading}
              />
            ))}
            {/* Empty slots for adding new posts */}
            {emptySlots.map(pos => (
              <div
                key={`empty-${pos}`}
                className="relative aspect-[4/5] rounded-md border-2 border-dashed border-muted-foreground/30 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
                onClick={() => !isUploading && handleSlotClick(pos)}
              >
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span className="text-[9px] mt-0.5">{gridPosts.length + emptySlots.indexOf(pos) + 1}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
