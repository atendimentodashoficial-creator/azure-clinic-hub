import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Globe, Eye, EyeOff, Copy, Bot } from "lucide-react";

interface PlataformaIA {
  id: string;
  cliente_id: string;
  user_id: string;
  nome: string;
  url: string | null;
  login: string | null;
  senha: string | null;
  observacoes: string | null;
  created_at: string;
}

interface ClienteIATabProps {
  clienteId: string;
}

function PlataformaDialog({
  plataforma,
  clienteId,
  onSave,
  onClose,
}: {
  plataforma?: PlataformaIA | null;
  clienteId: string;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(plataforma?.nome || "");
  const [url, setUrl] = useState(plataforma?.url || "");
  const [login, setLogin] = useState(plataforma?.login || "");
  const [senha, setSenha] = useState(plataforma?.senha || "");
  const [observacoes, setObservacoes] = useState(plataforma?.observacoes || "");

  const handleSubmit = () => {
    if (!nome.trim()) {
      toast.error("Nome da plataforma é obrigatório");
      return;
    }
    onSave({
      ...(plataforma && { id: plataforma.id }),
      cliente_id: clienteId,
      nome: nome.trim(),
      url: url.trim() || null,
      login: login.trim() || null,
      senha: senha.trim() || null,
      observacoes: observacoes.trim() || null,
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{plataforma ? "Editar Plataforma" : "Nova Plataforma I.A"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome da Plataforma *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: ChatGPT, Claude, ManyChat..." />
        </div>
        <div className="space-y-2">
          <Label>URL / Link</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>Login / Email</Label>
          <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="usuario@email.com" />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" />
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Anotações sobre a plataforma..." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{plataforma ? "Salvar" : "Adicionar"}</Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function ClienteIATab({ clienteId }: ClienteIATabProps) {
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<PlataformaIA | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [senhasVisiveis, setSenhasVisiveis] = useState<Record<string, boolean>>({});

  const { data: plataformas = [], isLoading } = useQuery({
    queryKey: ["cliente-plataformas-ia", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_plataformas_ia" as any)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as PlataformaIA[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cliente-plataformas-ia", clienteId] });

  const criar = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("cliente_plataformas_ia" as any)
        .insert({ ...data, user_id: ownerId } as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); toast.success("Plataforma adicionada!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...rest } = data;
      const { error } = await supabase
        .from("cliente_plataformas_ia" as any)
        .update({ ...rest, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditando(null); toast.success("Plataforma atualizada!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cliente_plataformas_ia" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Plataforma removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSenha = (id: string) => {
    setSenhasVisiveis((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copiar = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Plataformas de I.A</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <PlataformaDialog
            clienteId={clienteId}
            onSave={(data) => criar.mutate(data)}
            onClose={() => setDialogOpen(false)}
          />
        </Dialog>
      </div>

      {plataformas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma plataforma de I.A cadastrada para este cliente
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plataformas.map((p) => (
            <Card key={p.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  {p.nome}
                </h4>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(p)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => excluir.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {p.url && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a href={p.url.startsWith("http") ? p.url : `https://${p.url}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate text-xs">
                      {p.url}
                    </a>
                  </div>
                )}
                {p.login && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">Login:</span>
                    <span className="text-xs truncate flex-1">{p.login}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copiar(p.login!, "Login")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {p.senha && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">Senha:</span>
                    <span className="text-xs truncate flex-1 font-mono">
                      {senhasVisiveis[p.id] ? p.senha : "••••••••"}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSenha(p.id)}>
                      {senhasVisiveis[p.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copiar(p.senha!, "Senha")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {p.observacoes && (
                  <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{p.observacoes}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editando && (
        <Dialog open={!!editando} onOpenChange={(v) => { if (!v) setEditando(null); }}>
          <PlataformaDialog
            plataforma={editando}
            clienteId={clienteId}
            onSave={(data) => atualizar.mutate(data)}
            onClose={() => setEditando(null)}
          />
        </Dialog>
      )}
    </div>
  );
}
