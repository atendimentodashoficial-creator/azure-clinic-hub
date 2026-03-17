import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Database, Loader2, Save, Eye, EyeOff } from "lucide-react";

export function DisparosSupabaseConfig() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("disparos_supabase_config" as any)
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setUrl((data as any).supabase_url || "");
      setServiceKey((data as any).supabase_service_key || "");
      setExistingId((data as any).id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !url.trim() || !serviceKey.trim()) {
      toast.error("Preencha a URL e a chave de serviço");
      return;
    }

    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from("disparos_supabase_config" as any)
          .update({
            supabase_url: url.trim(),
            supabase_service_key: serviceKey.trim(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("disparos_supabase_config" as any)
          .insert({
            user_id: user.id,
            supabase_url: url.trim(),
            supabase_service_key: serviceKey.trim(),
          } as any);
        if (error) throw error;
      }
      toast.success("Configuração salva!");
      await loadConfig();
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="h-4 w-4" />
          Conexão Supabase Externo (I.A.)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure a conexão com o Supabase externo onde ficam as tabelas de controle da I.A. (BOT_ATIVO).
        </p>

        <div className="space-y-2">
          <Label className="text-sm">URL do Supabase</Label>
          <Input
            placeholder="https://xyzcompany.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Service Role Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-10"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Encontre em: Supabase Dashboard → Settings → API → service_role key
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
