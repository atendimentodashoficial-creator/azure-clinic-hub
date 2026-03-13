import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MockupSlide {
  id?: string;
  ordem: number;
  subtitulo: string;
  titulo: string;
  legenda: string;
  cta: string;
}

interface MockupPreviewProps {
  slides: MockupSlide[];
  perfilNome?: string;
  perfilCategoria?: string;
  className?: string;
}

export function MockupPreview({ slides, perfilNome = "perfil", perfilCategoria = "", className }: MockupPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = slides[currentSlide];
  const isCarousel = slides.length > 1;

  if (!slide) return null;

  const iniciais = perfilNome.slice(0, 2).toUpperCase();

  return (
    <div className={cn("w-full max-w-[400px] mx-auto bg-background border rounded-xl overflow-hidden shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-[2px]">
          <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
            <span className="text-[10px] font-bold text-foreground">{iniciais}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{perfilNome}</p>
          {perfilCategoria && <p className="text-[10px] text-muted-foreground">{perfilCategoria}</p>}
        </div>
        <MoreHorizontal className="w-4 h-4 text-foreground" />
      </div>

      {/* Image area - simulated post */}
      <div className="relative aspect-square bg-gradient-to-b from-zinc-800 to-zinc-900 flex flex-col items-center justify-center p-8 text-center">
        {slide.subtitulo && (
          <p className="text-sm text-zinc-300 mb-2 max-w-[80%]">{slide.subtitulo}</p>
        )}
        {slide.titulo && (
          <h2 className="text-xl font-bold text-white leading-tight max-w-[90%]">{slide.titulo}</h2>
        )}
        {slide.cta && (
          <p className="text-[10px] text-zinc-500 absolute bottom-4 right-4 uppercase tracking-wider">{slide.cta}</p>
        )}

        {/* Carousel navigation */}
        {isCarousel && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={() => setCurrentSlide(s => s - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
            )}
            {currentSlide < slides.length - 1 && (
              <button
                onClick={() => setCurrentSlide(s => s + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Action bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-foreground" />
            <MessageCircle className="w-5 h-5 text-foreground" />
            <Send className="w-5 h-5 text-foreground" />
          </div>
          {isCarousel && (
            <div className="flex gap-1 absolute left-1/2 -translate-x-1/2">
              {slides.map((_, i) => (
                <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i === currentSlide ? "bg-primary" : "bg-muted-foreground/30")} />
              ))}
            </div>
          )}
          <Bookmark className="w-5 h-5 text-foreground" />
        </div>

        {/* Carousel dots below actions for proper layout */}
        {isCarousel && (
          <div className="flex justify-center gap-1 mt-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === currentSlide ? "bg-primary" : "bg-muted-foreground/30")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Caption */}
      {slide.legenda && (
        <div className="px-3 pb-3 pt-1">
          <p className="text-xs text-foreground">
            <span className="font-semibold mr-1">{perfilNome}</span>
            {slide.legenda}
          </p>
        </div>
      )}
    </div>
  );
}
