import { useRef, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
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
  onRemove: (id: string) => Promise<void>;
  onUpdateTitle: (id: string, titulo: string) => Promise<void>;
  uploading: boolean;
}

export function GridHighlightsManager({ highlights, onAdd, onRemove, onUpdateTitle, uploading }: GridHighlightsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newTitle, setNewTitle] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    try {
      await onAdd(file, newTitle || `Destaque ${highlights.length + 1}`);
      setNewTitle("");
      toast.success("Destaque adicionado!");
    } catch {
      toast.error("Erro ao adicionar destaque");
    }
    e.target.value = "";
  };

  const statusColor = (s: string) => {
    if (s === "aprovado") return "ring-2 ring-emerald-500";
    if (s === "reprovado") return "ring-2 ring-red-500";
    return "";
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">
        Destaques do Instagram <span className="font-normal text-muted-foreground">({highlights.length})</span>
      </Label>

      {/* Existing highlights */}
      <div className="flex gap-3 flex-wrap">
        {highlights.map(h => (
          <div key={h.id} className="flex flex-col items-center gap-1 w-16">
            <div className={cn(
              "relative w-14 h-14 rounded-full overflow-hidden border-2 border-muted-foreground/20 bg-muted/30",
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
            <Input
              value={h.titulo}
              onChange={e => onUpdateTitle(h.id, e.target.value)}
              className="h-5 text-[9px] text-center px-0.5 border-0 bg-transparent focus:bg-muted/50"
            />
            {h.status !== "pendente" && (
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0",
                h.status === "aprovado" ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400"
              )}>
                {h.status === "aprovado" ? "✓" : "✗"}
              </Badge>
            )}
          </div>
        ))}

        {/* Add button */}
        <div className="flex flex-col items-center gap-1 w-16">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
          </button>
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Título"
            className="h-5 text-[9px] text-center px-0.5 border-0 bg-transparent focus:bg-muted/50"
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
