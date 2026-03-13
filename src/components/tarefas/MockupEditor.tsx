import { useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MockupPreview, MockupSlide } from "./MockupPreview";

interface MockupEditorProps {
  slides: MockupSlide[];
  onChange: (slides: MockupSlide[]) => void;
  perfilNome?: string;
  perfilCategoria?: string;
  maxSlides?: number; // 0 = unlimited
}

export function MockupEditor({ slides, onChange, perfilNome, perfilCategoria, maxSlides = 0 }: MockupEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeSlide, setActiveSlide] = useState("0");

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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Slides do Mockup {maxSlides > 0 && <span className="font-normal text-muted-foreground">({slides.length}/{maxSlides})</span>}
        </Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(v => !v)}>
            {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {showPreview ? "Editar" : "Preview"}
          </Button>
          {(maxSlides === 0 || slides.length < maxSlides) && (
            <Button type="button" variant="outline" size="sm" onClick={addSlide}>
              <Plus className="w-3.5 h-3.5 mr-1" />Slide
            </Button>
          )}
        </div>
      </div>

      {showPreview ? (
        <MockupPreview slides={slides} perfilNome={perfilNome} perfilCategoria={perfilCategoria} />
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
