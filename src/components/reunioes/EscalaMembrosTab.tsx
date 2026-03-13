import { useState, useMemo } from "react";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import {
  useEscalasMembros,
  useCreateEscalaMembro,
  useUpdateEscalaMembro,
  useDeleteEscalaMembro,
  useAusenciasMembros,
  useCreateAusenciaMembro,
  useDeleteAusenciaMembro,
} from "@/hooks/useEscalasMembros";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, Clock, Copy, Pencil, ChevronDown, ChevronRight, Calendar as CalendarIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-Feira" },
  { value: 2, label: "Terça-Feira" },
  { value: 3, label: "Quarta-Feira" },
  { value: 4, label: "Quinta-Feira" },
  { value: 5, label: "Sexta-Feira" },
  { value: 6, label: "Sábado" },
];

interface EscalaMembrosTabProps {
  membroIdFixo?: string;
}

export function EscalaMembrosTab({ membroIdFixo }: EscalaMembrosTabProps) {
  const { membros, isLoading: loadingMembros } = useTarefasMembros();
  const { data: todasEscalas = [] } = useEscalasMembros(membroIdFixo);
  const { data: todasAusencias = [] } = useAusenciasMembros(membroIdFixo);
  const criarEscala = useCreateEscalaMembro();
  const updateEscala = useUpdateEscalaMembro();
  const deletarEscala = useDeleteEscalaMembro();
  const criarAusencia = useCreateAusenciaMembro();
  const deletarAusencia = useDeleteAusenciaMembro();

  const isLocked = !!membroIdFixo;
  const [membroSelecionado, setMembroSelecionado] = useState<string>(membroIdFixo || "todos");
  const [membrosExpandidos, setMembrosExpandidos] = useState<Set<string>>(new Set());
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set());
  const [horariosRascunho, setHorariosRascunho] = useState<Record<string, Array<{ tempId: string; inicio: string; fim: string }>>>({});

  // Dialog editar horário
  const [dialogEditarHorario, setDialogEditarHorario] = useState(false);
  const [editandoHorario, setEditandoHorario] = useState<{
    id: string | null;
    tempId?: string;
    hora_inicio: string;
    hora_fim: string;
    membro_id?: string;
    dia_semana?: number;
    isNew?: boolean;
  } | null>(null);

  // Dialog copiar dia
  const [dialogCopiarDia, setDialogCopiarDia] = useState(false);
  const [diaOrigem, setDiaOrigem] = useState<{ membroId: string; diaSemana: number; horarios: Array<{ hora_inicio: string; hora_fim: string }> } | null>(null);
  const [diasDestinoSelecionados, setDiasDestinoSelecionados] = useState<number[]>([]);
  const [copiandoEscala, setCopiandoEscala] = useState(false);

  // Dialog ausência
  const [dialogAusencia, setDialogAusencia] = useState(false);
  const [datasAusenciaSelecionadas, setDatasAusenciaSelecionadas] = useState<Date[]>([]);
  const [horariosAusencia, setHorariosAusencia] = useState<Array<{ inicio: string; fim: string }>>([{ inicio: "", fim: "" }]);
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [motivo, setMotivo] = useState("");

  // Dialog editar ausência
  const [dialogEditarAusencia, setDialogEditarAusencia] = useState(false);
  const [ausenciaEditando, setAusenciaEditando] = useState<{ id: string; membro_id: string } | null>(null);
  const [datasAusenciaEditando, setDatasAusenciaEditando] = useState<Date[]>([]);
  const [horariosAusenciaEditando, setHorariosAusenciaEditando] = useState<Array<{ inicio: string; fim: string }>>([{ inicio: "", fim: "" }]);
  const [diaInteiroEditando, setDiaInteiroEditando] = useState(false);
  const [motivoEditando, setMotivoEditando] = useState("");

  // Dialog visualizar ausência
  const [dialogVisualizarAusencia, setDialogVisualizarAusencia] = useState(false);
  const [ausenciaVisualizando, setAusenciaVisualizando] = useState<{
    data: string;
    membro_id: string;
    horarios: Array<{ id: string; inicio: string | null; fim: string | null }>;
    motivo: string | null;
  } | null>(null);

  // Ausências filtradas
  const ausencias = useMemo(() => {
    if (membroSelecionado === "todos") return todasAusencias;
    return todasAusencias.filter(a => a.membro_id === membroSelecionado);
  }, [todasAusencias, membroSelecionado]);

  const ausenciasAgrupadas = useMemo(() => {
    if (!ausencias || ausencias.length === 0) return [];
    const grouped: Record<string, { data: string; membro_id: string; ausencias: typeof ausencias; motivo: string | null }> = {};
    ausencias.forEach(a => {
      const key = `${a.membro_id}-${a.data_inicio}`;
      if (!grouped[key]) {
        grouped[key] = { data: a.data_inicio, membro_id: a.membro_id, ausencias: [], motivo: a.motivo };
      }
      grouped[key].ausencias.push(a);
    });
    return Object.values(grouped).sort((a, b) => a.data.localeCompare(b.data));
  }, [ausencias]);

  // Escalas agrupadas por membro
  const escalasPorMembro = useMemo(() => {
    const membrosParaMostrar = membroSelecionado === "todos" ? membros : membros.filter(m => m.id === membroSelecionado);
    return membrosParaMostrar.map(membro => {
      const escalasMembro = todasEscalas.filter(e => e.membro_id === membro.id);
      const diasAtivos = new Set(escalasMembro.map(e => e.dia_semana));
      const diasComHorarios = DIAS_SEMANA.map(dia => {
        const horarios = escalasMembro.filter(e => e.dia_semana === dia.value).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
        return { ...dia, ativo: diasAtivos.has(dia.value), horarios };
      });
      return { membro, dias: diasComHorarios, totalHorarios: escalasMembro.length, diasAtivos: diasAtivos.size };
    });
  }, [membros, todasEscalas, membroSelecionado]);

  const toggleMembroExpandido = (membroId: string) => {
    setMembrosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(membroId)) {
        next.delete(membroId);
      } else {
        next.add(membroId);
        const membroData = escalasPorMembro.find(p => p.membro.id === membroId);
        if (membroData) {
          setDiasExpandidos(prevDias => {
            const newDias = new Set(prevDias);
            membroData.dias.forEach(dia => {
              if (dia.ativo) newDias.add(`${membroId}-${dia.value}`);
            });
            return newDias;
          });
        }
      }
      return next;
    });
  };

  const toggleDiaExpandido = (key: string) => {
    setDiasExpandidos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleToggleDia = async (membroId: string, diaSemana: number, ativo: boolean) => {
    if (ativo) {
      try {
        await criarEscala.mutateAsync({ membro_id: membroId, dia_semana: diaSemana, hora_inicio: "08:00", hora_fim: "12:00", ativo: true });
        toast.success("Dia ativado");
      } catch { toast.error("Erro ao ativar o dia"); }
    } else {
      const horariosParaRemover = todasEscalas.filter(e => e.membro_id === membroId && e.dia_semana === diaSemana);
      try {
        for (const h of horariosParaRemover) await deletarEscala.mutateAsync(h.id);
        toast.success("Dia desativado");
      } catch { toast.error("Erro ao desativar o dia"); }
    }
  };

  const handleAdicionarHorario = (membroId: string, diaSemana: number, horariosExistentes: Array<{ hora_inicio: string; hora_fim: string }> = []) => {
    const key = `${membroId}-${diaSemana}`;
    const calcFim30 = (inicio: string) => {
      const norm = (inicio || "").slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(norm)) return "";
      const [h, m] = norm.split(":").map(Number);
      let h2 = h, m2 = m + 30;
      if (m2 >= 60) { m2 -= 60; h2 += 1; }
      return `${String(Math.min(h2, 23)).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
    };
    setHorariosRascunho(prev => {
      const drafts = prev[key] || [];
      const lastDraft = drafts[drafts.length - 1];
      const ultimoHorario = horariosExistentes[horariosExistentes.length - 1];
      let novoInicio = "";
      if (lastDraft) {
        novoInicio = lastDraft.fim || "";
      } else if (!ultimoHorario) {
        novoInicio = "08:00";
      } else {
        const start = (ultimoHorario.hora_inicio || "").slice(0, 5);
        const end = (ultimoHorario.hora_fim || "").slice(0, 5);
        const autoFim = calcFim30(start);
        novoInicio = end && autoFim && end !== autoFim ? end : "";
      }
      const tempId = `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return { ...prev, [key]: [...drafts, { tempId, inicio: novoInicio, fim: "" }] };
    });
  };

  const handleDeletarHorario = async (id: string) => {
    try {
      await deletarEscala.mutateAsync(id);
      toast.success("Horário removido");
    } catch { toast.error("Erro ao remover horário"); }
  };

  const handleEditarHorario = (horario: { id?: string | null; tempId?: string; membro_id?: string; dia_semana?: number; hora_inicio: string; hora_fim: string }) => {
    const isDraft = !horario.id && !!horario.tempId;
    const normInicio = (horario.hora_inicio || "").slice(0, 5);
    const normFim = (horario.hora_fim || "").slice(0, 5);

    if (isDraft) {
      setEditandoHorario({ id: null, tempId: horario.tempId, membro_id: horario.membro_id, dia_semana: horario.dia_semana, hora_inicio: normInicio, hora_fim: normFim, isNew: true });
      setDialogEditarHorario(true);
      return;
    }

    const [h, m] = normInicio.split(":").map(Number);
    let h2 = h, m2 = m + 30;
    if (m2 >= 60) { m2 -= 60; h2 += 1; }
    const autoFim = `${String(Math.min(h2, 23)).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
    setEditandoHorario({ id: horario.id || null, hora_inicio: normInicio, hora_fim: normFim === autoFim ? "" : normFim, isNew: false });
    setDialogEditarHorario(true);
  };

  const handleSalvarEdicaoHorario = async () => {
    if (!editandoHorario || !editandoHorario.hora_inicio || !editandoHorario.hora_fim) {
      toast.error("Preencha os horários de início e fim");
      return;
    }
    try {
      if (editandoHorario.isNew && editandoHorario.membro_id && editandoHorario.dia_semana !== undefined) {
        await criarEscala.mutateAsync({ membro_id: editandoHorario.membro_id, dia_semana: editandoHorario.dia_semana, hora_inicio: editandoHorario.hora_inicio, hora_fim: editandoHorario.hora_fim, ativo: true });
        if (editandoHorario.tempId) {
          const key = `${editandoHorario.membro_id}-${editandoHorario.dia_semana}`;
          setHorariosRascunho(prev => ({ ...prev, [key]: (prev[key] || []).filter(h => h.tempId !== editandoHorario.tempId) }));
        }
        toast.success("Horário adicionado");
      } else if (editandoHorario.id) {
        await updateEscala.mutateAsync({ id: editandoHorario.id, hora_inicio: editandoHorario.hora_inicio, hora_fim: editandoHorario.hora_fim });
        toast.success("Horário atualizado");
      }
      setDialogEditarHorario(false);
      setEditandoHorario(null);
    } catch { toast.error("Erro ao salvar horário"); }
  };

  // Copiar dia
  const handleAbrirCopiarDia = (membroId: string, diaSemana: number, horarios: Array<{ hora_inicio: string; hora_fim: string }>) => {
    setDiaOrigem({ membroId, diaSemana, horarios });
    setDiasDestinoSelecionados([]);
    setDialogCopiarDia(true);
  };

  const toggleDiaDestino = (dia: number) => {
    setDiasDestinoSelecionados(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const handleCopiarParaDias = async () => {
    if (!diaOrigem || diasDestinoSelecionados.length === 0 || copiandoEscala) return;
    setCopiandoEscala(true);
    try {
      for (const diaDestino of diasDestinoSelecionados) {
        const existentes = todasEscalas.filter(e => e.membro_id === diaOrigem.membroId && e.dia_semana === diaDestino);
        for (const h of existentes) await deletarEscala.mutateAsync(h.id);
        await new Promise(r => setTimeout(r, 100));
        for (const h of diaOrigem.horarios) {
          await criarEscala.mutateAsync({ membro_id: diaOrigem.membroId, dia_semana: diaDestino, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, ativo: true });
        }
      }
      toast.success(`Horários copiados para ${diasDestinoSelecionados.length} dia(s)`);
      setDialogCopiarDia(false);
    } catch { toast.error("Erro ao copiar escala"); }
    finally { setCopiandoEscala(false); }
  };

  // Ausência helpers
  const carregarHorariosEscalaParaAusencia = (datas: Date[], membroId: string) => {
    if (!membroId || datas.length === 0) { setHorariosAusencia([{ inicio: "", fim: "" }]); return; }
    const diaSemana = getDay(datas[0]);
    const escalaDoDia = todasEscalas.filter(e => e.membro_id === membroId && e.dia_semana === diaSemana);
    if (escalaDoDia.length > 0) {
      setHorariosAusencia(escalaDoDia.map(e => ({ inicio: e.hora_inicio.slice(0, 5), fim: e.hora_fim.slice(0, 5) })));
    } else {
      setHorariosAusencia([{ inicio: "", fim: "" }]);
    }
  };

  const handleSelecionarDatasAusencia = (dates: Date[] | undefined) => {
    const novas = dates || [];
    setDatasAusenciaSelecionadas(novas);
    if (novas.length > 0 && membroSelecionado !== "todos") {
      carregarHorariosEscalaParaAusencia(novas, membroSelecionado);
    }
  };

  const handleCriarAusencia = async () => {
    if (membroSelecionado === "todos" || datasAusenciaSelecionadas.length === 0) {
      toast.error("Selecione um membro e pelo menos uma data");
      return;
    }
    try {
      for (const data of datasAusenciaSelecionadas) {
        if (diaInteiro) {
          await criarAusencia.mutateAsync({ membro_id: membroSelecionado, data_inicio: format(data, "yyyy-MM-dd"), data_fim: format(data, "yyyy-MM-dd"), hora_inicio: null, hora_fim: null, motivo: motivo || null });
        } else {
          for (const h of horariosAusencia) {
            await criarAusencia.mutateAsync({ membro_id: membroSelecionado, data_inicio: format(data, "yyyy-MM-dd"), data_fim: format(data, "yyyy-MM-dd"), hora_inicio: h.inicio, hora_fim: h.fim, motivo: motivo || null });
          }
        }
      }
      toast.success(`${datasAusenciaSelecionadas.length} data(s) registrada(s)`);
      setDialogAusencia(false);
      setDatasAusenciaSelecionadas([]);
      setHorariosAusencia([{ inicio: "", fim: "" }]);
      setDiaInteiro(false);
      setMotivo("");
    } catch { toast.error("Erro ao registrar ausência"); }
  };

  const handleEditarAusencia = (ausencia: { id: string; membro_id: string; data_inicio: string; hora_inicio: string | null; hora_fim: string | null; motivo: string | null }) => {
    const todasDoGrupo = todasAusencias.filter(a => a.membro_id === ausencia.membro_id && a.data_inicio === ausencia.data_inicio);
    setAusenciaEditando({ id: ausencia.id, membro_id: ausencia.membro_id });
    const dataAusencia = parseISO(ausencia.data_inicio);
    setDatasAusenciaEditando([dataAusencia]);
    const isDiaInteiro = todasDoGrupo.every(a => !a.hora_inicio && !a.hora_fim);
    setDiaInteiroEditando(isDiaInteiro);
    if (!isDiaInteiro && todasDoGrupo.some(a => a.hora_inicio && a.hora_fim)) {
      const h = todasDoGrupo.filter(a => a.hora_inicio && a.hora_fim).map(a => ({ inicio: a.hora_inicio!.slice(0, 5), fim: a.hora_fim!.slice(0, 5) }));
      setHorariosAusenciaEditando(h.length > 0 ? h : [{ inicio: "", fim: "" }]);
    } else {
      const diaSemana = getDay(dataAusencia);
      const escalaDoDia = todasEscalas.filter(e => e.membro_id === ausencia.membro_id && e.dia_semana === diaSemana);
      setHorariosAusenciaEditando(escalaDoDia.length > 0 ? escalaDoDia.map(e => ({ inicio: e.hora_inicio.slice(0, 5), fim: e.hora_fim.slice(0, 5) })) : [{ inicio: "", fim: "" }]);
    }
    setMotivoEditando(ausencia.motivo || "");
    setDialogEditarAusencia(true);
  };

  const handleSalvarEdicaoAusencia = async () => {
    if (!ausenciaEditando || datasAusenciaEditando.length === 0) return;
    try {
      const dataStr = format(datasAusenciaEditando[0], "yyyy-MM-dd");
      const todasDoGrupo = todasAusencias.filter(a => a.membro_id === ausenciaEditando.membro_id && a.data_inicio === dataStr);
      for (const a of todasDoGrupo) await deletarAusencia.mutateAsync(a.id);
      for (const data of datasAusenciaEditando) {
        if (diaInteiroEditando) {
          await criarAusencia.mutateAsync({ membro_id: ausenciaEditando.membro_id, data_inicio: format(data, "yyyy-MM-dd"), data_fim: format(data, "yyyy-MM-dd"), hora_inicio: null, hora_fim: null, motivo: motivoEditando || null });
        } else {
          for (const h of horariosAusenciaEditando) {
            if (h.inicio && h.fim) {
              await criarAusencia.mutateAsync({ membro_id: ausenciaEditando.membro_id, data_inicio: format(data, "yyyy-MM-dd"), data_fim: format(data, "yyyy-MM-dd"), hora_inicio: h.inicio, hora_fim: h.fim, motivo: motivoEditando || null });
            }
          }
        }
      }
      toast.success("Substituição atualizada");
      setDialogEditarAusencia(false);
      setAusenciaEditando(null);
    } catch { toast.error("Erro ao atualizar substituição"); }
  };

  const handleDeletarAusencia = async (id: string) => {
    try {
      await deletarAusencia.mutateAsync(id);
      toast.success("Ausência removida");
      setDialogEditarAusencia(false);
    } catch { toast.error("Erro ao remover ausência"); }
  };

  const getNomeMembro = (membroId: string) => membros.find(m => m.id === membroId)?.nome || "Membro";

  if (loadingMembros) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando membros...</p>;
  if (membros.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <p className="text-muted-foreground">Nenhum membro da equipe cadastrado</p>
      <p className="text-xs text-muted-foreground">Cadastre membros na aba Equipe para configurar escalas</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filtro por membro - hidden when locked to single member */}
      {!isLocked && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Filtrar por Membro</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={membroSelecionado} onValueChange={setMembroSelecionado}>
              <SelectTrigger><SelectValue placeholder="Todos os membros" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os membros</SelectItem>
                {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome} {m.cargo && `- ${m.cargo}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Escala por membro */}
      {escalasPorMembro.map(({ membro, dias }) => (
        <Collapsible key={membro.id} open={membrosExpandidos.has(membro.id)} onOpenChange={() => toggleMembroExpandido(membro.id)}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  {membrosExpandidos.has(membro.id) ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                  <Clock className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate">{membro.nome}</CardTitle>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2">
                {dias.map(dia => {
                  const diaKey = `${membro.id}-${dia.value}`;
                  const isDiaExpandido = diasExpandidos.has(diaKey);
                  return (
                    <Collapsible key={dia.value} open={isDiaExpandido} onOpenChange={() => dia.ativo && toggleDiaExpandido(diaKey)}>
                      <div className="border rounded-lg">
                        <div className="flex items-center gap-2 p-3">
                          <Switch checked={dia.ativo} onCheckedChange={checked => handleToggleDia(membro.id, dia.value, checked)} />
                          <CollapsibleTrigger asChild disabled={!dia.ativo}>
                            <div className={cn("flex-1 flex items-center gap-2 min-w-0", dia.ativo && "cursor-pointer")}>
                              {dia.ativo && (isDiaExpandido ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />)}
                              <span className={cn("font-medium text-sm", !dia.ativo && "text-muted-foreground")}>{dia.label}</span>
                            </div>
                          </CollapsibleTrigger>
                          {dia.ativo && dia.horarios.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={e => { e.stopPropagation(); handleAbrirCopiarDia(membro.id, dia.value, dia.horarios.map(h => ({ hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }))); }} title="Copiar para outros dias">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <CollapsibleContent>
                          {dia.ativo && (
                            <div className="px-3 pb-3 pt-0 ml-8 space-y-2 border-t">
                              <div className="pt-2 space-y-2">
                                {dia.horarios.map(horario => {
                                  const normInicio = (horario.hora_inicio || "").slice(0, 5);
                                  const normFim = (horario.hora_fim || "").slice(0, 5);
                                  const [h, m] = normInicio.split(":").map(Number);
                                  let h2 = h, m2 = m + 30;
                                  if (m2 >= 60) { m2 -= 60; h2 += 1; }
                                  const autoFim = `${String(Math.min(h2, 23)).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
                                  const mostrarFim = normFim === autoFim ? "" : normFim;
                                  return (
                                    <div key={horario.id} className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Input type="time" value={normInicio} className="w-20 sm:w-24 h-8 text-xs pointer-events-none" readOnly tabIndex={-1} />
                                        <span className="text-muted-foreground">-</span>
                                        <Input type="time" value={mostrarFim} className="w-20 sm:w-24 h-8 text-xs pointer-events-none" readOnly tabIndex={-1} />
                                      </div>
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditarHorario({ id: horario.id, hora_inicio: horario.hora_inicio, hora_fim: horario.hora_fim })}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletarHorario(horario.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {(horariosRascunho[diaKey] || []).map(rascunho => (
                                  <div key={rascunho.tempId} className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Input type="time" value={rascunho.inicio} className="w-20 sm:w-24 h-8 text-xs pointer-events-none" readOnly tabIndex={-1} />
                                      <span className="text-muted-foreground">-</span>
                                      <Input type="time" value={rascunho.fim} className="w-20 sm:w-24 h-8 text-xs pointer-events-none" readOnly tabIndex={-1} />
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditarHorario({ tempId: rascunho.tempId, membro_id: membro.id, dia_semana: dia.value, hora_inicio: rascunho.inicio, hora_fim: rascunho.fim })}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHorariosRascunho(prev => ({ ...prev, [diaKey]: (prev[diaKey] || []).filter(h => h.tempId !== rascunho.tempId) }))}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAdicionarHorario(membro.id, dia.value, dia.horarios.map(h => ({ hora_inicio: h.hora_inicio, hora_fim: h.hora_fim })))}>
                                  <Plus className="h-3 w-3 mr-1" /> Horário
                                </Button>
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      {/* Dialog Editar/Adicionar Horário */}
      <Dialog open={dialogEditarHorario} onOpenChange={setDialogEditarHorario}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoHorario?.isNew ? "Adicionar Horário" : "Editar Horário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hora Início</Label>
              <Input type="time" value={editandoHorario?.hora_inicio || ""} onChange={e => setEditandoHorario(prev => prev ? { ...prev, hora_inicio: e.target.value } : null)} />
            </div>
            <div>
              <Label>Hora Fim</Label>
              <Input type="time" value={editandoHorario?.hora_fim || ""} min={editandoHorario?.hora_inicio || undefined}
                onFocus={e => { if (!e.target.value && editandoHorario?.hora_inicio) setEditandoHorario(prev => prev ? { ...prev, hora_fim: prev.hora_inicio } : null); }}
                onChange={e => setEditandoHorario(prev => prev ? { ...prev, hora_fim: e.target.value } : null)} />
            </div>
            <Button onClick={handleSalvarEdicaoHorario} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Substituições de Escala */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 flex-shrink-0" />
            <span>Substituição de Escala</span>
          </CardTitle>
          <Button size="sm" className="flex-shrink-0" onClick={() => setDialogAusencia(true)} disabled={membroSelecionado === "todos"}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Nova</span> Substituição
          </Button>
        </CardHeader>
        <CardContent>
          {membroSelecionado === "todos" && <p className="text-sm text-muted-foreground mb-4">Selecione um membro específico para gerenciar substituições</p>}
          {ausenciasAgrupadas.length > 0 ? (
            <div className="space-y-2">
              {ausenciasAgrupadas.map(grupo => (
                <div key={`${grupo.membro_id}-${grupo.data}`} className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-card">
                  <div className="min-w-0 flex-1">
                    {membroSelecionado === "todos" && <p className="text-xs text-muted-foreground mb-1">{getNomeMembro(grupo.membro_id)}</p>}
                    <p className="font-medium text-sm flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(parseISO(grupo.data), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setAusenciaVisualizando({ data: grupo.data, membro_id: grupo.membro_id, horarios: grupo.ausencias.map(a => ({ id: a.id, inicio: a.hora_inicio, fim: a.hora_fim })), motivo: grupo.motivo });
                      setDialogVisualizarAusencia(true);
                    }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      const p = grupo.ausencias[0];
                      handleEditarAusencia({ id: p.id, membro_id: p.membro_id, data_inicio: p.data_inicio, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim, motivo: p.motivo });
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => { for (const a of grupo.ausencias) await handleDeletarAusencia(a.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-muted-foreground py-8">Nenhuma substituição registrada</p>}
        </CardContent>
      </Card>

      {/* Dialog Editar Substituição */}
      <Dialog open={dialogEditarAusencia} onOpenChange={setDialogEditarAusencia}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Substituição - {datasAusenciaEditando.length > 0 ? format(datasAusenciaEditando[0], "dd/MM/yyyy", { locale: ptBR }) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Horários substitutos:</Label>
              <p className="text-xs text-muted-foreground mt-1">Estes horários substituirão a escala regular neste dia</p>
            </div>
            {!diaInteiroEditando && (
              <div className="space-y-2">
                {horariosAusenciaEditando.map((horario, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input type="time" value={horario.inicio} onChange={e => setHorariosAusenciaEditando(prev => prev.map((h, i) => i === index ? { ...h, inicio: e.target.value } : h))} className="w-24 h-9 text-sm" />
                    <span className="text-muted-foreground">-</span>
                    <Input type="time" value={horario.fim} min={horario.inicio || undefined}
                      onFocus={e => { if (!e.target.value && horario.inicio) setHorariosAusenciaEditando(prev => prev.map((h, i) => i === index ? { ...h, fim: horario.inicio } : h)); }}
                      onChange={e => setHorariosAusenciaEditando(prev => prev.map((h, i) => i === index ? { ...h, fim: e.target.value } : h))} className="w-24 h-9 text-sm" />
                    {horariosAusenciaEditando.length > 1 ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHorariosAusenciaEditando(prev => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHorariosAusenciaEditando(prev => [...prev, { inicio: prev[prev.length - 1]?.fim || "", fim: "" }])}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {horariosAusenciaEditando.length > 1 && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setHorariosAusenciaEditando(prev => [...prev, { inicio: prev[prev.length - 1]?.fim || "", fim: "" }])}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar horário
                  </Button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={diaInteiroEditando} onCheckedChange={setDiaInteiroEditando} />
              <Label className="text-sm">Sem disponibilidade (o dia todo)</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Motivo (opcional)</Label>
              <Textarea value={motivoEditando} onChange={e => setMotivoEditando(e.target.value)} placeholder="Ex: Férias, Licença médica..." className="h-16 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogEditarAusencia(false)}>Cancelar</Button>
            <Button onClick={handleSalvarEdicaoAusencia}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Visualizar Substituição */}
      <Dialog open={dialogVisualizarAusencia} onOpenChange={setDialogVisualizarAusencia}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Substituição - {ausenciaVisualizando ? format(parseISO(ausenciaVisualizando.data), "dd/MM/yyyy", { locale: ptBR }) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {ausenciaVisualizando && (
              <>
                <div><Label className="text-sm font-medium">Horários substitutos registrados:</Label></div>
                <div className="space-y-2">
                  {ausenciaVisualizando.horarios.length > 0 && ausenciaVisualizando.horarios.some(h => h.inicio || h.fim) ? (
                    ausenciaVisualizando.horarios.map((horario, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{horario.inicio?.slice(0, 5) || "00:00"} - {horario.fim?.slice(0, 5) || "23:59"}</span>
                      </div>
                    ))
                  ) : <p className="text-sm text-muted-foreground">Dia inteiro indisponível</p>}
                </div>
                {ausenciaVisualizando.motivo && (
                  <div>
                    <Label className="text-sm font-medium">Motivo:</Label>
                    <p className="text-sm text-muted-foreground mt-1">{ausenciaVisualizando.motivo}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDialogVisualizarAusencia(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Copiar Dia */}
      <Dialog open={dialogCopiarDia} onOpenChange={setDialogCopiarDia}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copiar Escala para Outros Dias</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Copiando de: <span className="font-medium text-foreground">{diaOrigem ? DIAS_SEMANA.find(d => d.value === diaOrigem.diaSemana)?.label : ""}</span></p>
            <p className="text-sm text-muted-foreground">Horários: {diaOrigem?.horarios.map(h => `${h.hora_inicio} - ${h.hora_fim}`).join(", ")}</p>
            <div>
              <Label className="mb-2 block">Selecione os dias de destino:</Label>
              <div className="space-y-2">
                {DIAS_SEMANA.filter(d => d.value !== diaOrigem?.diaSemana).map(dia => (
                  <div key={dia.value} className={cn("flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors", diasDestinoSelecionados.includes(dia.value) ? "bg-primary/10 border-primary" : "hover:bg-muted/50")} onClick={() => toggleDiaDestino(dia.value)}>
                    <Switch checked={diasDestinoSelecionados.includes(dia.value)} onCheckedChange={() => toggleDiaDestino(dia.value)} onClick={e => e.stopPropagation()} />
                    <span className="text-sm font-medium">{dia.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleCopiarParaDias} className="w-full" disabled={diasDestinoSelecionados.length === 0 || copiandoEscala}>
              {copiandoEscala ? "Copiando..." : `Copiar para ${diasDestinoSelecionados.length} dia(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Substituição */}
      <Dialog open={dialogAusencia} onOpenChange={setDialogAusencia}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova Substituição de Escala</DialogTitle></DialogHeader>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-full sm:w-auto sm:flex-shrink-0">
              <Calendar mode="multiple" selected={datasAusenciaSelecionadas} onSelect={handleSelecionarDatasAusencia} locale={ptBR}
                className="pointer-events-auto rounded-md border w-full"
                classNames={{
                  months: "flex flex-col w-full", month: "space-y-4 w-full", table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full justify-between", head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center",
                  row: "flex w-full mt-2 justify-between", cell: "flex-1 h-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                  day: "h-9 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-muted rounded-md",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
                  day_today: "bg-muted text-muted-foreground",
                }}
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label className="text-sm font-medium">Horários substitutos:</Label>
                <p className="text-xs text-muted-foreground mt-1">Estes horários substituirão a escala regular nas datas selecionadas.</p>
              </div>
              {!diaInteiro && (
                <div className="space-y-2">
                  {horariosAusencia.map((horario, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input type="time" value={horario.inicio} onChange={e => setHorariosAusencia(prev => prev.map((h, i) => i === index ? { ...h, inicio: e.target.value } : h))} className="w-24 h-9 text-sm" />
                      <span className="text-muted-foreground">-</span>
                      <Input type="time" value={horario.fim} min={horario.inicio || undefined}
                        onFocus={e => { if (!e.target.value && horario.inicio) setHorariosAusencia(prev => prev.map((h, i) => i === index ? { ...h, fim: horario.inicio } : h)); }}
                        onChange={e => setHorariosAusencia(prev => prev.map((h, i) => i === index ? { ...h, fim: e.target.value } : h))} className="w-24 h-9 text-sm" />
                      {horariosAusencia.length > 1 ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHorariosAusencia(prev => prev.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHorariosAusencia(prev => [...prev, { inicio: prev[prev.length - 1]?.fim || "", fim: "" }])}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {horariosAusencia.length > 1 && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setHorariosAusencia(prev => [...prev, { inicio: prev[prev.length - 1]?.fim || "", fim: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar horário
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={diaInteiro} onCheckedChange={setDiaInteiro} />
                <Label className="text-sm">Sem disponibilidade (o dia todo)</Label>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Motivo (opcional)</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Férias, Licença médica..." className="h-16 text-sm" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogAusencia(false)}>Fechar</Button>
            <Button onClick={handleCriarAusencia} disabled={datasAusenciaSelecionadas.length === 0}>Salvar Substituição</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
