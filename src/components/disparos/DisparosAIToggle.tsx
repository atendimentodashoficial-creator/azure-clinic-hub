import { useState, useEffect } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { getLast8Digits } from "@/utils/whatsapp";

interface Props {
  chatContactNumber: string;
  instanciaId: string | null | undefined;
}

export function DisparosAIToggle({ chatContactNumber, instanciaId }: Props) {
  const [botAtivo, setBotAtivo] = useState<boolean>(false);
  const [followAtivo, setFollowAtivo] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [togglingBot, setTogglingBot] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
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
        setBotAtivo(data.bot_ativo ?? false);
        setFollowAtivo(data.follow_ativo ?? false);
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

  const handleToggle = async (field: "BOT_ATIVO" | "follow_ativo", newValue: boolean) => {
    if (!instanciaId || !phoneLast8) return;

    const isBot = field === "BOT_ATIVO";
    const setter = isBot ? setBotAtivo : setFollowAtivo;
    const setToggling = isBot ? setTogglingBot : setTogglingFollow;
    const previousValue = isBot ? botAtivo : followAtivo;

    setToggling(true);
    setter(newValue);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("disparos-toggle-ai", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: "toggle",
          instancia_id: instanciaId,
          phone_last8: phoneLast8,
          field,
          new_value: newValue,
        },
      });

      if (error || !data?.success) {
        setter(previousValue);
        toast.error(data?.error || "Erro ao alterar configuração");
      } else {
        const label = isBot ? "I.A." : "Follow-up";
        toast.success(newValue ? `${label} ativado` : `${label} desativado`);
      }
    } catch (e: any) {
      setter(previousValue);
      toast.error("Erro ao alterar configuração");
    } finally {
      setToggling(false);
    }
  };

  if (!instanciaId || (!loading && !found)) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAnyActive = botAtivo || followAtivo;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center px-1 py-1 rounded hover:bg-accent transition-colors">
          <Bot className={`h-5 w-5 ${isAnyActive ? 'text-green-500' : 'text-muted-foreground'}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Configurações I.A.</p>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="bot-toggle" className="text-sm cursor-pointer">Bot Ativo</Label>
            <Switch
              id="bot-toggle"
              checked={botAtivo}
              onCheckedChange={(v) => handleToggle("BOT_ATIVO", v)}
              disabled={togglingBot}
              className="scale-90"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="follow-toggle" className="text-sm cursor-pointer">Follow-up Ativo</Label>
            <Switch
              id="follow-toggle"
              checked={followAtivo}
              onCheckedChange={(v) => handleToggle("follow_ativo", v)}
              disabled={togglingFollow}
              className="scale-90"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
