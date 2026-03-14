import { useState } from "react";
import { Heart, MessageCircle, Grid3X3, Bookmark, PlaySquare, UserCircle, ChevronLeft, ChevronRight, Check, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface GridPost {
  id: string;
  posicao: number;
  image_url: string;
  status: string;
  feedback: string | null;
}

interface InstagramGridPreviewProps {
  posts: GridPost[];
  perfilNome: string;
  perfilCategoria?: string;
  /** If true, shows approve/reject controls */
  approvalMode?: boolean;
  onApprove?: (postId: string) => void;
  onReject?: (postId: string, feedback: string) => void;
  feedbacks?: Record<string, string>;
  onFeedbackChange?: (postId: string, feedback: string) => void;
  submitting?: boolean;
}

export function InstagramGridPreview({
  posts,
  perfilNome,
  perfilCategoria,
  approvalMode,
  onApprove,
  onReject,
  feedbacks = {},
  onFeedbackChange,
  submitting,
}: InstagramGridPreviewProps) {
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const iniciais = perfilNome.slice(0, 2).toUpperCase();
  const postCount = posts.length;

  // Sort by posicao
  const sortedPosts = [...posts].sort((a, b) => a.posicao - b.posicao);

  // Fill 9 slots
  const grid = Array.from({ length: 9 }, (_, i) => sortedPosts.find(p => p.posicao === i) || null);

  const selected = selectedPost ? posts.find(p => p.id === selectedPost) : null;

  const statusColor = (s: string) => {
    if (s === "aprovado") return "ring-2 ring-emerald-500";
    if (s === "reprovado") return "ring-2 ring-red-500";
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Instagram profile mockup */}
      <div className="w-full bg-background overflow-hidden">
        {/* Profile header */}
        <div className="flex items-center gap-4 p-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-[2px] flex-shrink-0">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
              <span className="text-sm font-bold text-foreground">{iniciais}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{perfilNome}</p>
            {perfilCategoria && <p className="text-xs text-muted-foreground">{perfilCategoria}</p>}
            <div className="flex gap-6 mt-2 text-center">
              <div>
                <p className="text-xs font-semibold text-foreground">{postCount}</p>
                <p className="text-[10px] text-muted-foreground">posts</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">seguidores</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">seguindo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-border">
          <div className="flex-1 flex items-center justify-center py-2 border-b-2 border-foreground">
            <Grid3X3 className="w-4 h-4 text-foreground" />
          </div>
          <div className="flex-1 flex items-center justify-center py-2 text-muted-foreground">
            <PlaySquare className="w-4 h-4" />
          </div>
          <div className="flex-1 flex items-center justify-center py-2 text-muted-foreground">
            <UserCircle className="w-4 h-4" />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-px bg-border">
          {grid.map((post, i) => (
            <div
              key={i}
              className={cn(
                "relative aspect-square bg-muted/30 overflow-hidden",
                post && approvalMode && "cursor-pointer hover:opacity-80 transition-opacity",
                post && statusColor(post.status)
              )}
              onClick={() => post && approvalMode && setSelectedPost(post.id === selectedPost ? null : post.id)}
            >
              {post ? (
                <>
                  <img
                    src={post.image_url}
                    alt={`Post ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {post.status !== "pendente" && (
                    <div className={cn(
                      "absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]",
                      post.status === "aprovado" ? "bg-emerald-500" : "bg-red-500"
                    )}>
                      {post.status === "aprovado" ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </div>
                  )}
                  {selectedPost === post.id && (
                    <div className="absolute inset-0 bg-primary/20 border-2 border-primary" />
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-muted/20" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected post approval controls */}
      {approvalMode && selected && (
        <Card className="p-4 space-y-3 mx-2 mb-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Post {selected.posicao + 1}</span>
            <Badge className={cn("border-0 text-[10px]",
              selected.status === "aprovado" ? "bg-emerald-500/20 text-emerald-400" :
              selected.status === "reprovado" ? "bg-red-500/20 text-red-400" :
              "bg-amber-500/20 text-amber-400"
            )}>
              {selected.status === "aprovado" ? "Aprovado" : selected.status === "reprovado" ? "Reprovado" : "Pendente"}
            </Badge>
          </div>
          {/* Enlarged preview */}
          <img
            src={selected.image_url}
            alt={`Post ${selected.posicao + 1}`}
            className="w-full aspect-square object-cover rounded-lg"
          />
          {selected.status === "pendente" && (
            <>
              <Textarea
                placeholder="Feedback (obrigatório para reprovar)..."
                value={feedbacks[selected.id] || ""}
                onChange={e => onFeedbackChange?.(selected.id, e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => onApprove?.(selected.id)}
                  disabled={submitting}
                  className="flex-1 gap-1.5"
                >
                  <Check className="w-4 h-4" /> Aprovar
                </Button>
                <Button
                  onClick={() => onReject?.(selected.id, feedbacks[selected.id] || "")}
                  disabled={submitting}
                  variant="destructive"
                  className="flex-1 gap-1.5"
                >
                  <X className="w-4 h-4" /> Reprovar
                </Button>
              </div>
            </>
          )}
          {selected.status === "reprovado" && selected.feedback && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
              💬 {selected.feedback}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
