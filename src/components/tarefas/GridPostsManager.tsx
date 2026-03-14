import { useRef } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TarefaGridPost } from "@/hooks/useTarefaGrid";
import { toast } from "sonner";

interface GridPostsManagerProps {
  gridPosts: TarefaGridPost[];
  onUpload: (posicao: number, file: File) => Promise<void>;
  onRemove: (posicao: number) => Promise<void>;
  uploading: boolean;
}

export function GridPostsManager({ gridPosts, onUpload, onRemove, uploading }: GridPostsManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePosRef = useRef<number>(0);

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

  const statusColor = (s: string) => {
    if (s === "aprovado") return "ring-2 ring-emerald-500";
    if (s === "reprovado") return "ring-2 ring-red-500";
    return "";
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">
        Grade do Instagram <span className="font-normal text-muted-foreground">({gridPosts.length}/9)</span>
      </Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="grid grid-cols-3 gap-1.5 max-w-[320px]">
        {Array.from({ length: 9 }).map((_, i) => {
          const post = gridPosts.find(g => g.posicao === i);
          return (
            <div
              key={i}
              className={cn(
                "relative aspect-square rounded-md border-2 border-dashed border-muted-foreground/30 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors bg-muted/30",
                post && "border-solid border-border",
                post && statusColor(post.status)
              )}
              onClick={() => !uploading && handleSlotClick(i)}
            >
              {post ? (
                <>
                  <img
                    src={post.image_url}
                    alt={`Post ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onRemove(i);
                    }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
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
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                  {uploading ? (
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
