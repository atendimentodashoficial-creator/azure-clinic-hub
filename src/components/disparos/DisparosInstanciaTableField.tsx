import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  instanciaId: string;
}

export function DisparosInstanciaTableField({ instanciaId }: Props) {
  const [tableName, setTableName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("disparos_instancias")
        .select("tabela_supabase_externa")
        .eq("id", instanciaId)
        .single();
      const val = (data as any)?.tabela_supabase_externa || "";
      setTableName(val);
      setOriginalName(val);
      setLoading(false);
    };
    load();
  }, [instanciaId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("disparos_instancias")
        .update({ tabela_supabase_externa: tableName.trim() || null } as any)
        .eq("id", instanciaId);
      if (error) throw error;
      setOriginalName(tableName.trim());
      toast.success("Tabela externa salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const hasChanged = tableName !== originalName;

  return (
    <div className="flex items-end gap-2 border-t pt-2 mt-1">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Tabela Supabase (I.A.)</Label>
        <Input
          placeholder="ex: leads_whatsapp1"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      {hasChanged && (
        <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
