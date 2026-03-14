import { useRef, useState } from "react";
import { Plus, X, Loader2, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TarefaGridHighlight } from "@/hooks/useTarefaGridHighlights";
import { toast } from "sonner";

interface GridHighlightsManagerProps {
  highlights: TarefaGridHighlight[];
  onAdd: (file: File, titulo: string) => Promise<void>;
  onBatchAdd?: (files: File[]) => Promise<number>;
  onRemove: (id: string) => Promise<void>;
  onUpdateTitle: (id: string, titulo: string) => Promise<void>;
  uploading: boolean;
}

export function GridHighlightsManager({ highlights, onAdd, onBatchAdd, onRemove, onUpdateTitle, uploading }: GridHighlightsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [batchUploading, setBatchUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    try {
      await onAdd(file, `Destaque ${highlights.length + 1}`);
      toast.success("Destaque adicionado!");
    } catch {
      toast.error("Erro ao adicionar destaque");
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
    setBatchUploading(true);
    try {
      const count = await onBatchAdd?.(imageFiles);
      toast.success(`${count || imageFiles.length} destaque(s) adicionado(s)!`);
    } catch {
      toast.error("Erro ao adicionar destaques");
    } finally {
      setBatchUploading(false);
    }
    e.target.value = "";
  };

  const startEditing = (h: TarefaGridHighlight) => {
    setEditingId(h.id);
    setEditValue(h.titulo);
  };

  const finishEditing = async () => {
    if (editingId && editValue.trim()) {
      await onUpdateTitle(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const statusColor = (s: string) => {
    if (s === "aprovado") return "ring-2 ring-emerald-500";
    if (s === "reprovado") return "ring-2 ring-red-500";
    return "";
  };

  const isUploading = uploading || batchUploading;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Destaques do Instagram <span className="font-normal text-muted-foreground">({highlights.length})</span>
        </Label>
        {onBatchAdd && (
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={batchInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleBatchChange}
      />

      {/* Highlights list */}
      <div className="flex gap-3 flex-wrap">
        {highlights.map(h => (
          <div key={h.id} className="flex flex-col items-center gap-1.5 w-[72px]">
            <div className={cn(
              "relative w-14 h-14 rounded-full overflow-hidden border-2 border-muted-foreground/20 bg-muted/30 flex-shrink-0",
              statusColor(h.status)
            )}>
              <img src={h.image_url} alt={h.titulo} className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(h.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center z-10"
              >
                <X className="w-2.5 h-2.5 text-destructive-foreground" />
              </button>
            </div>

            {editingId === h.id ? (
              <Input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={e => e.key === "Enter" && finishEditing()}
                className="h-6 text-[10px] text-center px-1 w-full"
              />
            ) : (
              <button
                onClick={() => startEditing(h)}
                className="text-[10px] text-foreground truncate max-w-full hover:text-primary transition-colors leading-tight"
                title="Clique para editar"
              >
                {h.titulo}
              </button>
            )}

            {h.status !== "pendente" && (
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0",
                h.status === "aprovado" ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400"
              )}>
                {h.status === "aprovado" ? "✓" : "✗"}
              </Badge>
            )}
          </div>
        ))}

        {/* Add single button */}
        <div className="flex flex-col items-center gap-1.5 w-[72px]">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors flex-shrink-0"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
          </button>
          <span className="text-[10px] text-muted-foreground">Novo</span>
        </div>
      </div>
    </div>
  );
}
