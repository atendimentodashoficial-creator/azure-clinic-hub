import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { useTarefas, Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas } from "@/hooks/useTiposTarefas";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { extractCountryCode, formatPhoneByCountry } from "@/utils/phoneFormat";
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Instagram,
  FileText, Layers, CheckCircle2, Clock, AlertCircle,
  Link2, ExternalLink, Users, Calendar,
} from "lucide-react";

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
  const { clientes, isLoading: clientesLoading } = useTarefasClientes();
  const { tarefas, colunas } = useTarefas();
  const { tipos } = useTiposTarefas();
  const { membros } = useTarefasMembros();

  const cliente = useMemo(() => clientes.find(c => c.id === id), [clientes, id]);

  const clienteTarefas = useMemo(() => {
    if (!cliente) return [];
    return tarefas.filter(t => t.cliente_id === cliente.id);
  }, [tarefas, cliente]);

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
    const concluidas = clienteTarefas.filter(t => {
      const col = colunasMap[t.coluna_id];
      return col?.nome === "Concluído";
    }).length;
    const emProgresso = clienteTarefas.filter(t => {
      const col = colunasMap[t.coluna_id];
      return col?.nome === "Em Progresso";
    }).length;
    const atrasadas = clienteTarefas.filter(t => {
      const col = colunasMap[t.coluna_id];
      return col?.nome !== "Concluído" && t.data_limite && new Date(t.data_limite) < new Date();
    }).length;
    return { total, concluidas, emProgresso, atrasadas };
  }, [clienteTarefas, colunasMap]);

  const getColunaBadge = (coluna_id: string) => {
    const col = colunasMap[coluna_id];
    if (!col) return null;
    const icon = colunaIconMap[col.nome] || <FileText className="h-3.5 w-3.5" />;
    return (
      <Badge variant="outline" className="text-xs gap-1 font-normal" style={{ borderColor: col.cor, color: col.cor }}>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarImage src={cliente.foto_perfil_url || undefined} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{cliente.nome}</h1>
          {cliente.empresa && (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> {cliente.empresa}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="ml-auto text-xs">{cliente.tipo === "interno" ? "Interno" : "Preview"}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Concluídas", value: stats.concluidas, color: "text-green-500" },
          { label: "Em Progresso", value: stats.emProgresso, color: "text-blue-500" },
          { label: "Atrasadas", value: stats.atrasadas, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info sidebar */}
        <Card className="p-5 space-y-4 lg:col-span-1">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Informações</h3>
          <div className="space-y-3">
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
          </div>

          {gestor && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Gestor</h4>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{(gestor as any).nome}</span>
                </div>
              </div>
            </>
          )}

          {cliente.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Observações</h4>
                <p className="text-sm whitespace-pre-wrap">{cliente.observacoes}</p>
              </div>
            </>
          )}
        </Card>

        {/* Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Tarefas ({clienteTarefas.length})</h3>
          
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
        </div>
      </div>
    </div>
  );
}
