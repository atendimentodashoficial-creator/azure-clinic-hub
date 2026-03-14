import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MockupEditor } from "./MockupEditor";
import { MockupSlide } from "./MockupPreview";
import { cn } from "@/lib/utils";

export interface PostGroup {
  postIndex: number;
  slides: MockupSlide[];
}

interface MockupPostsManagerProps {
  posts: PostGroup[];
  onChange: (posts: PostGroup[]) => void;
  maxPosts: number; // 0 = unlimited
  perfilNome?: string;
  perfilCategoria?: string;
  perfilFotoUrl?: string | null;
}

export function MockupPostsManager({ posts, onChange, maxPosts, perfilNome, perfilCategoria, perfilFotoUrl }: MockupPostsManagerProps) {
  const [expandedPost, setExpandedPost] = useState<number>(0);

  const effectiveMax = maxPosts > 0 ? maxPosts : 50;
  const canAddPost = posts.length < effectiveMax;

  const addPost = () => {
    const newIndex = posts.length > 0 ? Math.max(...posts.map(p => p.postIndex)) + 1 : 0;
    const updated = [...posts, { postIndex: newIndex, slides: [{ ordem: 0, subtitulo: "", titulo: "", legenda: "", cta: "" }] }];
    onChange(updated);
    setExpandedPost(updated.length - 1);
  };

  const removePost = (idx: number) => {
    if (posts.length <= 1) return;
    const updated = posts.filter((_, i) => i !== idx);
    onChange(updated);
    setExpandedPost(Math.max(0, idx - 1));
  };

  const updatePostSlides = (idx: number, slides: MockupSlide[]) => {
    const updated = [...posts];
    updated[idx] = { ...updated[idx], slides };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Posts {maxPosts > 0 && <span className="font-normal text-muted-foreground">({posts.length}/{effectiveMax})</span>}
        </Label>
        {canAddPost && (
          <Button type="button" variant="outline" size="sm" onClick={addPost} className="gap-1.5 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> Novo Post
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {posts.map((post, idx) => {
          const isExpanded = expandedPost === idx;
          const isCarousel = post.slides.length > 1;
          const hasContent = post.slides.some(s => s.titulo || s.subtitulo || s.legenda || s.cta);

          return (
            <div key={idx} className="border rounded-lg overflow-hidden">
              {/* Post header - always visible */}
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                  isExpanded ? "bg-accent/50" : "hover:bg-accent/30"
                )}
                onClick={() => setExpandedPost(isExpanded ? -1 : idx)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-medium flex-1">Post {idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  {isCarousel && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Carrossel ({post.slides.length})
                    </Badge>
                  )}
                  {hasContent && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                  {posts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); removePost(idx); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </button>

              {/* Post editor - expanded */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t">
                  <MockupEditor
                    slides={post.slides}
                    onChange={slides => updatePostSlides(idx, slides)}
                    perfilNome={perfilNome}
                    perfilCategoria={perfilCategoria}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
