import { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Image, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MockupPreview, MockupSlide } from "./MockupPreview";
import { cn } from "@/lib/utils";

const MAX_CAROUSEL_SLIDES = 10;

interface MockupEditorProps {
  slides: MockupSlide[];
  onChange: (slides: MockupSlide[]) => void;
  perfilNome?: string;
  perfilCategoria?: string;
  perfilFotoUrl?: string | null;
  maxSlides?: number; // 0 = unlimited
}

export function MockupEditor({ slides, onChange, perfilNome, perfilCategoria, perfilFotoUrl, maxSlides = 0 }: MockupEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeSlide, setActiveSlide] = useState("0");
  const [isCarousel, setIsCarousel] = useState(slides.length > 1);

  const updateSlide = (index: number, field: keyof MockupSlide, value: string) => {
    const updated = [...slides];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addSlide = () => {
    onChange([...slides, { ordem: slides.length, subtitulo: "", titulo: "", legenda: "", cta: "" }]);
    setActiveSlide(String(slides.length));
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, ordem: i }));
    onChange(updated);
    setActiveSlide(String(Math.max(0, index - 1)));
    if (updated.length === 1) setIsCarousel(false);
  };

  const handleToggleCarousel = (carousel: boolean) => {
    setIsCarousel(carousel);
    if (!carousel && slides.length > 1) {
      onChange([{ ...slides[0], ordem: 0 }]);
      setActiveSlide("0");
    }
  };

  const effectiveMax = maxSlides > 0 ? maxSlides : MAX_CAROUSEL_SLIDES;
  const canAddSlide = isCarousel && slides.length < effectiveMax;

  return (
    <div className="space-y-4">
      {/* Post type toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground mr-1">Tipo:</Label>
        <Button
          type="button"
          variant={!isCarousel ? "default" : "outline"}
          size="sm"
          className={cn("gap-1.5 text-xs h-8", !isCarousel && "pointer-events-none")}
          onClick={() => handleToggleCarousel(false)}
        >
          <Image className="w-3.5 h-3.5" />
          Post único
        </Button>
        <Button
          type="button"
          variant={isCarousel ? "default" : "outline"}
          size="sm"
          className={cn("gap-1.5 text-xs h-8", isCarousel && "pointer-events-none")}
          onClick={() => handleToggleCarousel(true)}
        >
          <Images className="w-3.5 h-3.5" />
          Carrossel
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          {isCarousel ? "Slides do Carrossel" : "Conteúdo do Post"}{" "}
          {isCarousel && <span className="font-normal text-muted-foreground">({slides.length}/{effectiveMax})</span>}
        </Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(v => !v)}>
            {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {showPreview ? "Editar" : "Preview"}
          </Button>
          {canAddSlide && (
            <Button type="button" variant="outline" size="sm" onClick={addSlide}>
              <Plus className="w-3.5 h-3.5 mr-1" />Slide
            </Button>
          )}
        </div>
      </div>

      {showPreview ? (
        <MockupPreview slides={slides} perfilNome={perfilNome} perfilCategoria={perfilCategoria} perfilFotoUrl={perfilFotoUrl} />
      ) : (
        <Tabs value={activeSlide} onValueChange={setActiveSlide}>
          {slides.length > 1 && (
            <TabsList className="w-full">
              {slides.map((_, i) => (
                <TabsTrigger key={i} value={String(i)} className="flex-1 text-xs">
                  Slide {i + 1}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {slides.map((slide, i) => (
            <TabsContent key={i} value={String(i)} className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={slide.titulo} onChange={e => updateSlide(i, "titulo", e.target.value)} placeholder="Título principal do post..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtítulo</Label>
                <Input value={slide.subtitulo} onChange={e => updateSlide(i, "subtitulo", e.target.value)} placeholder="Texto menor acima do título..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Legenda</Label>
                <Textarea value={slide.legenda} onChange={e => updateSlide(i, "legenda", e.target.value)} placeholder="Legenda/caption do post..." rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CTA</Label>
                <Input value={slide.cta} onChange={e => updateSlide(i, "cta", e.target.value)} placeholder="Ex: Saiba mais, Entre em contato..." />
              </div>
              {slides.length > 1 && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeSlide(i)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Remover slide
                </Button>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
