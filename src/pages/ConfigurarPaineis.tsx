import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings2, User, UserCog, Shield, GripVertical, Plus, Trash2, Minus } from "lucide-react";
import { navigation } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

const getTabKeyForPanel = (href: string, prefix: string) => {
  const stripped = href.replace(new RegExp(`^\\/${prefix}\\/?`), "");
  return stripped || "inicio";
};

const adminDefaultTabs = Array.from(
  new Map(
    navigation.map((item) => {
      const key = getTabKeyForPanel(item.href, "admin");
      return [key, { key, label: item.name }] as const;
    })
  ).values()
);

const clienteDefaultTabs = [
  { key: "inicio", label: "Início" },
  { key: "tarefas", label: "Tarefas" },
  { key: "agendamentos", label: "Agendamentos" },
  { key: "aprovacoes", label: "Aprovações" },
];

const funcionarioDefaultTabs = [
  { key: "inicio", label: "Início" },
  { key: "tarefas", label: "Tarefas" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "reunioes", label: "Reuniões" },
  { key: "financeiro", label: "Financeiro" },
];

const getDefaultTabsForPanel = (panelType: string) => {
  switch (panelType) {
    case "cliente": return clienteDefaultTabs;
    case "funcionario": return funcionarioDefaultTabs;
    default: return adminDefaultTabs;
  }
};


interface OrderedItem {
  id?: string;
  tab_key: string;
  tab_label: string;
  is_visible: boolean;
  is_divider: boolean;
  ordem: number;
}

export default function ConfigurarPaineis() {
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<string>("admin");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["panel-tabs-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panel_tabs_config")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Build ordered list for a panel type
  const getOrderedItems = useCallback((panelType: string): OrderedItem[] => {
    const panelConfigs = configs.filter((c) => c.panel_type === panelType);
    
    if (panelConfigs.length === 0) {
      // No config saved yet - use defaults
      return defaultTabs.map((tab, i) => ({
        tab_key: tab.key,
        tab_label: tab.label,
        is_visible: panelType === "admin",
        is_divider: false,
        ordem: i,
      }));
    }

    // Merge: DB configs (including dividers) + any missing default tabs appended
    const result: OrderedItem[] = panelConfigs.map((c) => ({
      id: c.id,
      tab_key: c.tab_key,
      tab_label: c.tab_label,
      is_visible: c.is_visible,
      is_divider: (c as any).is_divider || false,
      ordem: c.ordem,
    }));

    // Add missing tabs at the end
    const existingKeys = new Set(result.filter(r => !r.is_divider).map(r => r.tab_key));
    const maxOrdem = Math.max(...result.map(r => r.ordem), -1);
    defaultTabs.forEach((tab, i) => {
      if (!existingKeys.has(tab.key)) {
        result.push({
          tab_key: tab.key,
          tab_label: tab.label,
          is_visible: panelType === "admin",
          is_divider: false,
          ordem: maxOrdem + 1 + i,
        });
      }
    });

    return result.sort((a, b) => a.ordem - b.ordem);
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async ({ panelType, items }: { panelType: string; items: OrderedItem[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Delete existing configs for this panel, then re-insert
      await supabase
        .from("panel_tabs_config")
        .delete()
        .eq("panel_type", panelType as any)
        .eq("user_id", user.id);

      const rows = items.map((item, i) => ({
        panel_type: panelType as any,
        tab_key: item.is_divider ? `divider-${i}` : item.tab_key,
        tab_label: item.is_divider ? "---" : item.tab_label,
        is_visible: item.is_visible,
        is_divider: item.is_divider,
        ordem: i,
        user_id: user.id,
      }));

      const { error } = await supabase.from("panel_tabs_config").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-tabs-config"] });
      queryClient.invalidateQueries({ queryKey: ["panel-tabs-config-admin"] });
      toast.success("Ordem e configuração salvas!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar");
    },
  });

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (panelType: string, dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const items = [...getOrderedItems(panelType)];
    const [moved] = items.splice(dragIndex, 1);
    items.splice(dropIndex, 0, moved);
    
    // Re-assign ordem
    const reordered = items.map((item, i) => ({ ...item, ordem: i }));
    saveMutation.mutate({ panelType, items: reordered });
    
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleToggle = (panelType: string, index: number, checked: boolean) => {
    const items = [...getOrderedItems(panelType)];
    items[index] = { ...items[index], is_visible: checked };
    saveMutation.mutate({ panelType, items });
  };

  const handleAddDivider = (panelType: string, afterIndex: number) => {
    const items = [...getOrderedItems(panelType)];
    const newDivider: OrderedItem = {
      tab_key: `divider-${Date.now()}`,
      tab_label: "---",
      is_visible: true,
      is_divider: true,
      ordem: afterIndex + 1,
    };
    items.splice(afterIndex + 1, 0, newDivider);
    const reordered = items.map((item, i) => ({ ...item, ordem: i }));
    saveMutation.mutate({ panelType, items: reordered });
  };

  const handleRemoveDivider = (panelType: string, index: number) => {
    const items = [...getOrderedItems(panelType)];
    items.splice(index, 1);
    const reordered = items.map((item, i) => ({ ...item, ordem: i }));
    saveMutation.mutate({ panelType, items: reordered });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Configurar Painéis
        </h1>
        <p className="text-muted-foreground">
          Defina quais abas serão visíveis, a ordem e divisórias do menu lateral
        </p>
      </div>

      <Tabs value={activePanel} onValueChange={setActivePanel}>
        <TabsList>
          <TabsTrigger value="admin" className="gap-2">
            <Shield className="h-4 w-4" />
            Painel Admin
          </TabsTrigger>
          <TabsTrigger value="cliente" className="gap-2">
            <User className="h-4 w-4" />
            Painel do Cliente
          </TabsTrigger>
          <TabsTrigger value="funcionario" className="gap-2">
            <UserCog className="h-4 w-4" />
            Painel do Funcionário
          </TabsTrigger>
        </TabsList>

        {["admin", "cliente", "funcionario"].map((panelType) => (
          <TabsContent key={panelType} value={panelType}>
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Arraste para reordenar. Use o botão <Plus className="inline h-3 w-3" /> para adicionar divisórias.
                  </p>
                </div>
                <div className="grid gap-1">
                  {getOrderedItems(panelType).map((item, index) => (
                    <div key={`${item.tab_key}-${index}`}>
                      {item.is_divider ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={() => handleDrop(panelType, index)}
                          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 cursor-grab active:cursor-grabbing transition-all",
                            dragOverIndex === index && "border-primary bg-primary/10"
                          )}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                          <Minus className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground flex-1">Divisória</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveDivider(panelType, index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={() => handleDrop(panelType, index)}
                          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-grab active:cursor-grabbing",
                            dragOverIndex === index && "border-primary bg-primary/10",
                            dragIndex === index && "opacity-50"
                          )}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          <Label className="cursor-grab font-medium flex-1">
                            {item.tab_label}
                          </Label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Adicionar divisória abaixo"
                            onClick={() => handleAddDivider(panelType, index)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Switch
                            checked={item.tab_key === "paineis" ? true : item.is_visible}
                            onCheckedChange={(checked) => handleToggle(panelType, index, checked)}
                            disabled={isLoading || item.tab_key === "paineis"}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
