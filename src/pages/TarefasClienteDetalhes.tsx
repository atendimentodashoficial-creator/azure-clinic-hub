import { useMemo, useState, useRef } from "react";
import { Edit } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { useTarefas, Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas } from "@/hooks/useTiposTarefas";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractCountryCode, formatPhoneByCountry } from "@/utils/phoneFormat";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Instagram,
  FileText, Layers, CheckCircle2, Clock, AlertCircle,
  Link2, ExternalLink, Users, Calendar, DollarSign,
  Upload, Download, Trash2, Paperclip, Receipt, TrendingUp, Bot,
} from "lucide-react";
import { NovoClienteDialog } from "@/components/tarefas/NovoClienteDialog";
import { CobrancasTab } from "@/components/cobrancas/CobrancasTab";
import ClienteIATab from "@/components/tarefas/ClienteIATab";

const colunaIconMap: Record<string, React.ReactNode> = {
  "Concluído": <CheckCircle2 className="h-4 w-4 text-green-500" />,
  "Em Progresso": <Clock className="h-4 w-4 text-blue-500" />,
  "Aguardando Aprovação": <AlertCircle className="h-4 w-4 text-violet-500" />,
  "Em Revisão": <AlertCircle className="h-4 w-4 text-orange-500" />,
  "A Fazer": <FileText className="h-4 w-4 text-amber-500" />,
};

export default function TarefasClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, isLoading: clientesLoading, atualizarCliente } = useTarefasClientes();
  const { tarefas, colunas } = useTarefas();
  const { tipos } = useTiposTarefas();
  const { membros } = useTarefasMembros();
  const { ownerId } = useOwnerId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editando, setEditando] = useState(false);

  const cliente = useMemo(() => clientes.find(c => c.id === id), [clientes, id]);

  // Fetch comissões for this client's tasks
  const clienteTarefas = useMemo(() => {
    if (!cliente) return [];
    return tarefas.filter(t => t.cliente_id === cliente.id);
  }, [tarefas, cliente]);

  const tarefaIds = useMemo(() => clienteTarefas.map(t => t.id), [clienteTarefas]);

  const { data: comissoes = [] } = useQuery({
    queryKey: ["cliente-comissoes", id],
    queryFn: async () => {
      if (!tarefaIds.length) return [];
      const { data, error } = await supabase
        .from("comissoes")
        .select("*")
        .in("tarefa_id", tarefaIds);
      if (error) throw error;
      return data || [];
    },
    enabled: tarefaIds.length > 0,
  });

  const { data: proximaCobranca } = useQuery({
    queryKey: ["cliente-proxima-cobranca", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("data_vencimento, status")
        .eq("cliente_id", id!)
        .eq("status", "pendente")
        .order("data_vencimento", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const colunasMap = useMemo(() => {
    const map: Record<string, TarefaColuna> = {};
    colunas.forEach(c => { map[c.id] = c; });
    return map;
  }, [colunas]);

  const tiposMap = useMemo(() => {
    const map: Record<string, string> = {};
    tipos.forEach(t => { map[t.id] = t.nome; });
    return map;
  }, [tipos]);

  const gestor = useMemo(() => {
    if (!cliente?.gestor_id) return null;
    return membros.find((m: any) => m.id === cliente.gestor_id);
  }, [cliente, membros]);

  const grouped = useMemo(() => {
    const groups: Record<string, Tarefa[]> = {};
    clienteTarefas.forEach(t => {
      const tipoNome = t.tipo_tarefa_id ? (tiposMap[t.tipo_tarefa_id] || "Outro") : "Sem tipo";
      if (!groups[tipoNome]) groups[tipoNome] = [];
      groups[tipoNome].push(t);
    });
    return groups;
  }, [clienteTarefas, tiposMap]);

  const stats = useMemo(() => {
    const total = clienteTarefas.length;
    const concluidas = clienteTarefas.filter(t => colunasMap[t.coluna_id]?.nome === "Concluído").length;
    const emProgresso = clienteTarefas.filter(t => colunasMap[t.coluna_id]?.nome === "Em Progresso").length;
    const atrasadas = clienteTarefas.filter(t => {
      const col = colunasMap[t.coluna_id];
      return col?.nome !== "Concluído" && t.data_limite && new Date(t.data_limite) < new Date();
    }).length;
    return { total, concluidas, emProgresso, atrasadas };
  }, [clienteTarefas, colunasMap]);

  const financeiro = useMemo(() => {
    const valorContrato = (cliente as any)?.valor_contrato || 0;
    const totalComissoes = comissoes.reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    const comissoesPendentes = comissoes.filter((c: any) => c.status === "pendente").reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    const comissoesAprovadas = comissoes.filter((c: any) => c.status === "aprovado").reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    return { valorContrato, totalComissoes, comissoesPendentes, comissoesAprovadas };
  }, [cliente, comissoes]);

  const getColunaBadge = (coluna_id: string) => {
    const col = colunasMap[coluna_id];
    if (!col) return null;
    const icon = colunaIconMap[col.nome] || <FileText className="h-3.5 w-3.5" />;
    return (
      <Badge variant="outline" className="text-xs gap-1 font-normal shrink-0" style={{ borderColor: col.cor, color: col.cor }}>
        {icon}
        {col.nome}
      </Badge>
    );
  };

  const getFormattedPhone = (phone: string | null) => {
    if (!phone) return null;
    const { countryCode, phoneWithoutCountry } = extractCountryCode(phone);
    const formattedPhone = formatPhoneByCountry(phoneWithoutCountry, countryCode);
    return formattedPhone ? `+${countryCode} ${formattedPhone}` : `+${countryCode} ${phoneWithoutCountry}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleUploadContrato = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cliente) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `contratos/${cliente.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      await atualizarCliente.mutateAsync({ id: cliente.id, contrato_url: urlData.publicUrl } as any);
      toast.success("Contrato anexado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar contrato: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoverContrato = async () => {
    if (!cliente) return;
    try {
      await atualizarCliente.mutateAsync({ id: cliente.id, contrato_url: null } as any);
      toast.success("Contrato removido");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (clientesLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="text-center text-muted-foreground py-12">Cliente não encontrado</div>
      </div>
    );
  }

  const initials = cliente.nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const contratoUrl = (cliente as any).contrato_url as string | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-16 w-16 shrink-0">
          <Avatar className="h-16 w-16 ring-2 ring-border">
            <AvatarImage src={cliente.foto_perfil_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground truncate">{cliente.nome}</h1>
            <Badge variant="secondary" className="shrink-0 text-xs">{cliente.tipo === "interno" ? "Interno" : "Preview"}</Badge>
          </div>
          {cliente.empresa && (
            <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-4 w-4 shrink-0" /> {cliente.empresa}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setEditando(true)}>
          <Edit className="h-3.5 w-3.5" /> Editar
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Concluídas", value: stats.concluidas, color: "text-green-600" },
          { label: "Em Progresso", value: stats.emProgresso, color: "text-blue-600" },
          { label: "Atrasadas", value: stats.atrasadas, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label} className="p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral" className="gap-1.5"><Building2 className="h-4 w-4" />Geral</TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-1.5"><Layers className="h-4 w-4" />Tarefas ({clienteTarefas.length})</TabsTrigger>
          <TabsTrigger value="cobrancas" className="gap-1.5"><Receipt className="h-4 w-4" />Cobranças</TabsTrigger>
          <TabsTrigger value="contrato" className="gap-1.5"><Paperclip className="h-4 w-4" />Contrato</TabsTrigger>
          {cliente.tem_ia && (
            <TabsTrigger value="ia" className="gap-1.5"><Bot className="h-4 w-4" />I.A</TabsTrigger>
          )}
        </TabsList>

        {/* ── Geral ── */}
        <TabsContent value="geral">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contato</h3>
              <div className="space-y-2.5">
                {cliente.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                )}
                {cliente.telefone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{getFormattedPhone(cliente.telefone)}</span>
                  </div>
                )}
                {cliente.cnpj && (
                  <div className="flex items-center gap-3 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>CNPJ: {cliente.cnpj}</span>
                  </div>
                )}
                {proximaCobranca?.data_vencimento && (
                  <div className="flex items-center gap-3 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Próximo pagamento: {new Date(proximaCobranca.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Links</h3>
              <div className="space-y-2.5">
                {cliente.site && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={cliente.site.startsWith("http") ? cliente.site : `https://${cliente.site}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{cliente.site}</a>
                  </div>
                )}
                {cliente.instagram && (
                  <div className="flex items-center gap-3 text-sm">
                    <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`https://instagram.com/${cliente.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{cliente.instagram}</a>
                  </div>
                )}
                {cliente.linktree && (
                  <div className="flex items-center gap-3 text-sm">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={cliente.linktree.startsWith("http") ? cliente.linktree : `https://${cliente.linktree}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{cliente.linktree}</a>
                  </div>
                )}
                {cliente.google_meu_negocio && (
                  <div className="flex items-center gap-3 text-sm">
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={cliente.google_meu_negocio.startsWith("http") ? cliente.google_meu_negocio : `https://${cliente.google_meu_negocio}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">Google Meu Negócio</a>
                  </div>
                )}
                {!cliente.site && !cliente.instagram && !cliente.linktree && !cliente.google_meu_negocio && (
                  <p className="text-sm text-muted-foreground">Nenhum link cadastrado</p>
                )}
              </div>
            </Card>

            {gestor && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Gestor</h3>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                    <AvatarImage src={(gestor as any).foto_url || undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-base font-medium">{(gestor as any).nome?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{(gestor as any).nome}</p>
                    {(gestor as any).cargo && <p className="text-xs text-muted-foreground">{(gestor as any).cargo}</p>}
                  </div>
                </div>
              </Card>
            )}

            {cliente.observacoes && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Observações</h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{cliente.observacoes}</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tarefas ── */}
        <TabsContent value="tarefas">
          {clienteTarefas.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Nenhuma tarefa vinculada a este cliente
            </Card>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([tipo, tasks]) => (
                <div key={tipo}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">{tipo}</h4>
                    <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {tasks.map(tarefa => (
                      <Card key={tarefa.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{tarefa.titulo}</p>
                          {tarefa.descricao && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{tarefa.descricao}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {tarefa.data_limite && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(tarefa.data_limite).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            {tarefa.responsavel_nome && (
                              <Badge variant="outline" className="text-xs font-normal">{tarefa.responsavel_nome}</Badge>
                            )}
                          </div>
                        </div>
                        {getColunaBadge(tarefa.coluna_id)}
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Cobranças ── */}
        <TabsContent value="cobrancas">
          <CobrancasTab clienteId={cliente.id} valorContrato={financeiro.valorContrato} />
        </TabsContent>

        {/* ── I.A ── */}
        {cliente.tem_ia && (
          <TabsContent value="ia">
            <ClienteIATab clienteId={cliente.id} />
          </TabsContent>
        )}

        {/* ── Contrato ── */}
        <TabsContent value="contrato">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Contrato</h3>
            </div>

            {contratoUrl ? (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <FileText className="h-10 w-10 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Contrato anexado</p>
                  <p className="text-xs text-muted-foreground truncate">{contratoUrl.split("/").pop()}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <a href={contratoUrl} target="_blank" rel="noreferrer" className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Baixar
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemoverContrato}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Clique para anexar o contrato</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX ou imagem</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleUploadContrato}
              disabled={uploading}
            />

            {contratoUrl && (
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Substituir contrato"}
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {editando && cliente && (
        <NovoClienteDialog
          clienteEditando={cliente}
          onSubmit={(data: any) => {
            const { id: cid, ...rest } = data;
            atualizarCliente.mutate({ id: cid, ...rest }, {
              onSuccess: () => { toast.success("Cliente atualizado!"); setEditando(false); },
              onError: (e: any) => toast.error(e.message),
            });
          }}
          onClose={() => setEditando(false)}
          externalOpen={true}
        />
      )}
    </div>
  );
}
