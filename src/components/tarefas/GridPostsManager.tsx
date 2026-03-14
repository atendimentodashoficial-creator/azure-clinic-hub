import { useRef, useState } from "react";
import { Plus, X, Loader2, Upload, ArrowLeftRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TarefaGridPost } from "@/hooks/useTarefaGrid";
import { toast } from "sonner";

interface GridPostsManagerProps {
  gridPosts: TarefaGridPost[];
  onUpload: (posicao: number, file: File) => Promise<void>;
  onBatchUpload?: (files: File[]) => Promise<number>;
  onRemove: (posicao: number) => Promise<void>;
  onSwap?: (from: number, to: number) => Promise<void>;
  uploading: boolean;
}

export function GridPostsManager({ gridPosts, onUpload, onBatchUpload, onRemove, onSwap, uploading }: GridPostsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const activePosRef = useRef<number>(0);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [batchUploading, setBatchUploading] = useState(false);

  const handleSlotClick = (posicao: number) => {
    if (swapMode) {
      handleSwapClick(posicao);
      return;
    }
    activePosRef.current = posicao;
    fileInputRef.current?.click();
  };

  const handleSwapClick = (posicao: number) => {
    const post = gridPosts.find(g => g.posicao === posicao);
    if (swapFrom === null) {
      if (!post) {
        toast.error("Selecione uma posição que tenha imagem");
        return;
      }
      setSwapFrom(posicao);
    } else {
      if (posicao === swapFrom) {
        setSwapFrom(null);
        return;
      }
      onSwap?.(swapFrom, posicao);
      setSwapFrom(null);
      setSwapMode(false);
    }
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

    const usedCount = gridPosts.length;
    const available = 9 - usedCount;
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
          Grade do Instagram <span className="font-normal text-muted-foreground">({gridPosts.length}/9)</span>
        </Label>
        <div className="flex gap-1.5">
          {gridPosts.length >= 2 && onSwap && (
            <Button
              type="button"
              variant={swapMode ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => { setSwapMode(!swapMode); setSwapFrom(null); }}
            >
              <ArrowLeftRight className="w-3 h-3" />
              {swapMode ? "Cancelar" : "Reordenar"}
            </Button>
          )}
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
      </div>

      {swapMode && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
          {swapFrom === null
            ? "Clique no post que deseja mover"
            : `Post ${swapFrom + 1} selecionado — clique na posição de destino`}
        </p>
      )}

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

      <div className="grid grid-cols-3 gap-1.5 max-w-[320px]">
        {Array.from({ length: 9 }).map((_, i) => {
          const post = gridPosts.find(g => g.posicao === i);
          const isSwapSource = swapMode && swapFrom === i;
          return (
            <div
              key={i}
              className={cn(
                "relative aspect-[4/5] rounded-md border-2 border-dashed border-muted-foreground/30 overflow-hidden cursor-pointer hover:border-primary/50 transition-all bg-muted/30",
                post && "border-solid border-border",
                post && statusColor(post.status),
                swapMode && "hover:ring-2 hover:ring-primary/50",
                isSwapSource && "ring-2 ring-primary scale-95"
              )}
              onClick={() => !isUploading && handleSlotClick(i)}
            >
              {post ? (
                <>
                  <img
                    src={post.image_url}
                    alt={`Post ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {!swapMode && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onRemove(i);
                      }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {post.status !== "pendente" && (
                    <Badge
                      className={cn(
                        "absolute bottom-0.5 left-0.5 text-[8px] px-1 py-0 border-0",
                        post.status === "aprovado" ? "bg-emerald-500/80 text-white" : "bg-red-500/80 text-white"
                      )}
                    >
                      {post.status === "aprovado" ? "✓" : "✗"}
                    </Badge>
                  )}
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background/70 flex items-center justify-center text-[9px] font-medium text-foreground">
                    {i + 1}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span className="text-[9px] mt-0.5">{i + 1}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
