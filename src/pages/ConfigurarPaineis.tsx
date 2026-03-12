import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings2, User, UserCog, Shield } from "lucide-react";
import { navigation } from "@/components/layout/Sidebar";

// Derive a stable tab key from href
const getTabKey = (href: string) => {
  // "/admin" -> "calendario", "/admin/leads" -> "leads"
  const stripped = href.replace(/^\/admin\/?/, "");
  return stripped || "calendario";
};

// Available tabs that admin can toggle for each panel
const availableTabs = navigation.map((item) => ({
  key: getTabKey(item.href),
  label: item.name,
}));

export default function ConfigurarPaineis() {
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<string>("admin");

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

  const toggleMutation = useMutation({
    mutationFn: async ({ panelType, tabKey, tabLabel, isVisible }: { panelType: string; tabKey: string; tabLabel: string; isVisible: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const existing = configs.find(
        (c) => c.panel_type === panelType && c.tab_key === tabKey
      );

      if (existing) {
        const { error } = await supabase
          .from("panel_tabs_config")
          .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("panel_tabs_config")
          .insert({
            panel_type: panelType as any,
            tab_key: tabKey,
            tab_label: tabLabel,
            is_visible: isVisible,
            user_id: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-tabs-config"] });
      toast.success("Configuração salva!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar");
    },
  });

  const isTabVisible = (panelType: string, tabKey: string) => {
    const config = configs.find(
      (c) => c.panel_type === panelType && c.tab_key === tabKey
    );
    // Admin tabs default to visible, client/employee default to hidden
    return config ? config.is_visible : panelType === "admin";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Configurar Painéis
        </h1>
        <p className="text-muted-foreground">
          Defina quais abas serão visíveis no painel de cada tipo de usuário
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
                <p className="text-sm text-muted-foreground">
                  Ative ou desative as abas que serão visíveis no painel do{" "}
                  {panelType === "cliente" ? "cliente" : "funcionário"}.
                </p>
                <div className="grid gap-3">
                  {availableTabs.map((tab) => (
                    <div
                      key={tab.key}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Label htmlFor={`${panelType}-${tab.key}`} className="cursor-pointer font-medium">
                        {tab.label}
                      </Label>
                      <Switch
                        id={`${panelType}-${tab.key}`}
                        checked={isTabVisible(panelType, tab.key)}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({
                            panelType,
                            tabKey: tab.key,
                            tabLabel: tab.label,
                            isVisible: checked,
                          })
                        }
                        disabled={isLoading}
                      />
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
