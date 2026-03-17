import { useState, useEffect } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getLast8Digits } from "@/utils/whatsapp";

interface Props {
  chatContactNumber: string;
  instanciaId: string | null | undefined;
}

export function DisparosAIToggle({ chatContactNumber, instanciaId }: Props) {
  const [botAtivo, setBotAtivo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [found, setFound] = useState(false);

  const phoneLast8 = getLast8Digits(chatContactNumber);

  useEffect(() => {
    if (!instanciaId || !phoneLast8) {
      setLoading(false);
      return;
    }
    fetchStatus();
  }, [instanciaId, phoneLast8]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("disparos-toggle-ai", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: "get",
          instancia_id: instanciaId,
          phone_last8: phoneLast8,
        },
      });

      if (error) {
        console.error("AI toggle fetch error:", error);
        setFound(false);
      } else if (data?.found) {
        setFound(true);
        setBotAtivo(data.bot_ativo);
      } else {
        setFound(false);
      }
    } catch (e) {
      console.error("AI toggle error:", e);
      setFound(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    if (!instanciaId || !phoneLast8) return;
    setToggling(true);
    const previousValue = botAtivo;
    setBotAtivo(newValue);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("disparos-toggle-ai", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: "toggle",
          instancia_id: instanciaId,
          phone_last8: phoneLast8,
          new_value: newValue,
        },
      });

      if (error || !data?.success) {
        setBotAtivo(previousValue);
        toast.error(data?.error || "Erro ao alterar I.A.");
      } else {
        toast.success(newValue ? "I.A. ativada" : "I.A. desativada");
      }
    } catch (e: any) {
      setBotAtivo(previousValue);
      toast.error("Erro ao alterar I.A.");
    } finally {
      setToggling(false);
    }
  };

  // Don't show if no instance or not found in external table
  if (!instanciaId || (!loading && !found)) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-1">
            <Bot className={`h-4 w-4 ${botAtivo ? 'text-green-500' : 'text-muted-foreground'}`} />
            <Switch
              checked={botAtivo || false}
              onCheckedChange={handleToggle}
              disabled={toggling}
              className="scale-75"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{botAtivo ? "I.A. ativada — clique para desativar" : "I.A. desativada — clique para ativar"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
