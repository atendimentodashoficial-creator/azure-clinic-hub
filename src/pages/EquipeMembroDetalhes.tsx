import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useTarefas, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas } from "@/hooks/useTiposTarefas";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractCountryCode, formatPhoneByCountry } from "@/utils/phoneFormat";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Mail, Phone, Briefcase, CalendarIcon,
  DollarSign, CheckCircle2, Clock, FileText, AlertCircle,
  Layers, Calendar, MessageSquare, Edit,
} from "lucide-react";
import { NovoMembroDialog } from "@/components/tarefas/TarefasMembrosTab";
import { toast } from "sonner";

const colunaIconMap: Record<string, React.ReactNode> = {
  "Concluído": <CheckCircle2 className="h-4 w-4 text-green-500" />,
  "Em Progresso": <Clock className="h-4 w-4 text-blue-500" />,
  "Aguardando Aprovação": <AlertCircle className="h-4 w-4 text-violet-500" />,
  "Em Revisão": <AlertCircle className="h-4 w-4 text-orange-500" />,
  "A Fazer": <FileText className="h-4 w-4 text-amber-500" />,
};

export default function EquipeMembroDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { membros, isLoading: membrosLoading, atualizarMembro } = useTarefasMembros();
  const { tarefas, colunas } = useTarefas();
  const { tipos } = useTiposTarefas();
  const { clientes } = useTarefasClientes();
  const [editando, setEditando] = useState(false);

  const membro = useMemo(() => membros.find((m: any) => m.id === id), [membros, id]);

  // Tasks where this member is responsável
  const membroTarefas = useMemo(() => {
    if (!membro) return [];
    return tarefas.filter(t =>
      t.responsavel_nome?.split(",").map(n => n.trim()).includes((membro as any).nome)
    );
  }, [tarefas, membro]);

  const tarefaIds = useMemo(() => membroTarefas.map(t => t.id), [membroTarefas]);

  const { data: comissoes = [] } = useQuery({
    queryKey: ["membro-comissoes", id],
    queryFn: async () => {
      if (!membro) return [];
      const { data, error } = await supabase
        .from("comissoes")
        .select("*")
        .eq("membro_nome", (membro as any).nome);
      if (error) throw error;
      return data || [];
    },
    enabled: !!membro,
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

  const clientesMap = useMemo(() => {
    const map: Record<string, string> = {};
    clientes.forEach(c => { map[c.id] = c.nome; });
    return map;
  }, [clientes]);

  const stats = useMemo(() => {
    const total = membroTarefas.length;
    const concluidas = membroTarefas.filter(t => colunasMap[t.coluna_id]?.nome === "Concluído").length;
    const emProgresso = membroTarefas.filter(t => colunasMap[t.coluna_id]?.nome === "Em Progresso").length;
    const atrasadas = membroTarefas.filter(t => {
      const col = colunasMap[t.coluna_id];
      return col?.nome !== "Concluído" && t.data_limite && new Date(t.data_limite) < new Date();
    }).length;
    return { total, concluidas, emProgresso, atrasadas };
  }, [membroTarefas, colunasMap]);

  const financeiro = useMemo(() => {
    const salario = (membro as any)?.salario || 0;
    const totalComissoes = comissoes.reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    const comissoesPendentes = comissoes.filter((c: any) => c.status === "pendente").reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    const comissoesAprovadas = comissoes.filter((c: any) => c.status === "aprovado").reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    return { salario, totalComissoes, comissoesPendentes, comissoesAprovadas };
  }, [membro, comissoes]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof membroTarefas> = {};
    membroTarefas.forEach(t => {
      const tipoNome = t.tipo_tarefa_id ? (tiposMap[t.tipo_tarefa_id] || "Outro") : "Sem tipo";
      if (!groups[tipoNome]) groups[tipoNome] = [];
      groups[tipoNome].push(t);
    });
    return groups;
  }, [membroTarefas, tiposMap]);

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (membrosLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  if (!membro) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="text-center text-muted-foreground py-12">Membro não encontrado</div>
      </div>
    );
  }

  const m = membro as any;
  const initials = m.nome.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-16 w-16 shrink-0">
          <Avatar className="h-16 w-16 ring-2 ring-border">
            <AvatarImage src={m.foto_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground truncate">{m.nome}</h1>
          </div>
          {m.cargo && (
            <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Briefcase className="h-4 w-4 shrink-0" /> {m.cargo}
            </p>
          )}
        </div>
        {m.salario != null && (
          <div className="shrink-0 bg-primary/10 text-primary rounded-lg px-3 py-1.5 font-semibold text-sm">
            {formatCurrency(m.salario)}
          </div>
        )}
      </div>

      {/* Stats */}
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
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas ({membroTarefas.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        {/* ── Geral ── */}
        <TabsContent value="geral">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contato</h3>
              <div className="space-y-2.5">
                {m.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{m.email}</span>
                  </div>
                )}
                {m.telefone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{getFormattedPhone(m.telefone)}</span>
                  </div>
                )}
                {!m.email && !m.telefone && (
                  <p className="text-sm text-muted-foreground">Nenhum contato cadastrado</p>
                )}
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Detalhes</h3>
              <div className="space-y-2.5">
                {m.data_contratacao && (
                  <div className="flex items-center gap-3 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Na empresa desde {format(parseISO(m.data_contratacao), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {m.dia_pagamento && (
                  <div className="flex items-center gap-3 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Pagamento no dia {m.dia_pagamento}</span>
                  </div>
                )}
                {!m.data_contratacao && !m.dia_pagamento && (
                  <p className="text-sm text-muted-foreground">Nenhum detalhe cadastrado</p>
                )}
              </div>
            </Card>

            {(m.whatsapp_aviso_pessoal || m.whatsapp_aviso_grupo) && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Avisos WhatsApp</h3>
                <div className="space-y-2.5">
                  {m.whatsapp_aviso_pessoal && (
                    <div className="flex items-center gap-3 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>Pessoal: {m.whatsapp_aviso_pessoal}</span>
                    </div>
                  )}
                  {m.whatsapp_aviso_grupo && (
                    <div className="flex items-center gap-3 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>Grupo: {m.whatsapp_aviso_grupo}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {m.observacoes && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Observações</h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.observacoes}</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tarefas ── */}
        <TabsContent value="tarefas">
          {membroTarefas.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Nenhuma tarefa atribuída a este membro
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
                          {tarefa.cliente_id && clientesMap[tarefa.cliente_id] && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Cliente: {clientesMap[tarefa.cliente_id]}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {tarefa.data_limite && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(tarefa.data_limite).toLocaleDateString("pt-BR")}
                              </span>
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

        {/* ── Financeiro ── */}
        <TabsContent value="financeiro">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Salário Fixo", value: formatCurrency(financeiro.salario), icon: <DollarSign className="h-4 w-4" /> },
              { label: "Total Comissões", value: formatCurrency(financeiro.totalComissoes), icon: <DollarSign className="h-4 w-4" /> },
              { label: "Comissões Pendentes", value: formatCurrency(financeiro.comissoesPendentes), icon: <Clock className="h-4 w-4" /> },
              { label: "Comissões Aprovadas", value: formatCurrency(financeiro.comissoesAprovadas), icon: <CheckCircle2 className="h-4 w-4" /> },
            ].map(item => (
              <Card key={item.label} className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  {item.icon}
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="text-lg font-bold">{item.value}</p>
              </Card>
            ))}
          </div>

          {comissoes.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Histórico de Comissões</h3>
              </div>
              <div className="divide-y">
                {comissoes.map((c: any) => {
                  const tarefa = membroTarefas.find(t => t.id === c.tarefa_id);
                  return (
                    <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{tarefa?.titulo || "Tarefa removida"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={c.status === "aprovado" ? "default" : "secondary"} className="text-xs">
                          {c.status === "aprovado" ? "Aprovado" : "Pendente"}
                        </Badge>
                        <span className="text-sm font-semibold">{formatCurrency(c.valor)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Nenhuma comissão registrada para este membro
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
