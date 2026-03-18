import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, Loader2, Bot, Wrench, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ToolField {
  key: string;
  value: string;
}

interface ToolConfig {
  id: string;
  name: string;
  fields: ToolField[];
}

export function AquecimentoConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tools, setTools] = useState<ToolConfig[]>([]);

  useEffect(() => {
    if (user?.id) loadConfig();
  }, [user?.id]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("disparos_aquecimento_config" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSystemPrompt((data as any).system_prompt || "");
        const toolsData = (data as any).tools_config;
        if (Array.isArray(toolsData) && toolsData.length > 0) {
          setTools(toolsData);
        }
      }
    } catch (err: any) {
      console.error("Error loading aquecimento config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        system_prompt: systemPrompt,
        tools_config: tools,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("disparos_aquecimento_config" as any)
        .upsert(payload as any, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Configuração salva com sucesso!");
    } catch (err: any) {
      console.error("Error saving:", err);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const addTool = () => {
    setTools([
      ...tools,
      {
        id: crypto.randomUUID(),
        name: "",
        fields: [{ key: "", value: "" }],
      },
    ]);
  };

  const removeTool = (toolId: string) => {
    setTools(tools.filter((t) => t.id !== toolId));
  };

  const updateToolName = (toolId: string, name: string) => {
    setTools(tools.map((t) => (t.id === toolId ? { ...t, name } : t)));
  };

  const addField = (toolId: string) => {
    setTools(
      tools.map((t) =>
        t.id === toolId
          ? { ...t, fields: [...t.fields, { key: "", value: "" }] }
          : t
      )
    );
  };

  const removeField = (toolId: string, fieldIndex: number) => {
    setTools(
      tools.map((t) =>
        t.id === toolId
          ? { ...t, fields: t.fields.filter((_, i) => i !== fieldIndex) }
          : t
      )
    );
  };

  const updateField = (
    toolId: string,
    fieldIndex: number,
    key: string,
    value: string
  ) => {
    setTools(
      tools.map((t) =>
        t.id === toolId
          ? {
              ...t,
              fields: t.fields.map((f, i) =>
                i === fieldIndex ? { key, value } : f
              ),
            }
          : t
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            System Prompt do Agente
          </CardTitle>
          <CardDescription>
            Prompt principal utilizado pelo agente de I.A. no fluxo do n8n
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Você é um assistente de aquecimento de leads..."
            className="min-h-[200px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* HTTP Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                HTTP Tools (Body Fields)
              </CardTitle>
              <CardDescription className="mt-1">
                Configure os campos do body de cada nó HTTP do seu fluxo n8n
              </CardDescription>
            </div>
            <Button onClick={addTool} size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar Tool
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma tool configurada</p>
              <p className="text-xs mt-1">Clique em "Adicionar Tool" para começar</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3" defaultValue={tools.map(t => t.id)}>
              {tools.map((tool) => (
                <AccordionItem
                  key={tool.id}
                  value={tool.id}
                  className="border rounded-lg px-4"
                >
                  <div className="flex items-center gap-2">
                    <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        {tool.name || "Tool sem nome"}
                      </div>
                    </AccordionTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTool(tool.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <AccordionContent className="pb-4 space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome da Tool</Label>
                      <Input
                        value={tool.name}
                        onChange={(e) => updateToolName(tool.id, e.target.value)}
                        placeholder="Ex: Buscar dados do lead"
                        className="mt-1"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Campos do Body</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addField(tool.id)}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Campo
                        </Button>
                      </div>

                      {tool.fields.map((field, fi) => (
                        <div key={fi} className="flex items-start gap-2">
                          <div className="flex-1">
                            <Input
                              value={field.key}
                              onChange={(e) =>
                                updateField(tool.id, fi, e.target.value, field.value)
                              }
                              placeholder="Campo (ex: nome)"
                              className="text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                updateField(tool.id, fi, field.key, e.target.value)
                              }
                              placeholder="Valor (ex: João)"
                              className="text-sm"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeField(tool.id, fi)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
