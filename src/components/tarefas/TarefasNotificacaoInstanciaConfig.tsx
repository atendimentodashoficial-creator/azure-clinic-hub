import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerId } from "@/hooks/useOwnerId";
import { supabase } from "@/integrations/supabase/client";
import { useTarefasNotificacaoConfig } from "@/hooks/useTarefasNotificacaoConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  nome: string;
}

export function TarefasNotificacaoInstanciaConfig() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const effectiveUserId = ownerId || user?.id;
  const { config, isLoading, upsertConfig } = useTarefasNotificacaoConfig();
  const [instancias, setInstancias] = useState<Instance[]>([]);
  const [loadingInstancias, setLoadingInstancias] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("disparos_instancias")
        .select("id, nome")
        .eq("user_id", effectiveUserId)
        .eq("is_active", true);
      setInstancias(data || []);
      setLoadingInstancias(false);
    };
    fetch();
  }, [effectiveUserId]);

  const handleChange = async (value: string) => {
    const instanciaId = value === "none" ? null : value;
    await upsertConfig.mutateAsync(instanciaId);
    toast.success("Instância de avisos de tarefas atualizada!");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Instância de Avisos das Tarefas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Selecione a instância do WhatsApp que será utilizada para enviar os avisos automáticos das tarefas.
        </p>
        <div className="space-y-2">
          <Label className="text-sm">Instância</Label>
          <Select
            value={config?.instancia_id || "none"}
            onValueChange={handleChange}
            disabled={isLoading || loadingInstancias}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma instância..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma (avisos desativados)</SelectItem>
              {instancias.map(inst => (
                <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
