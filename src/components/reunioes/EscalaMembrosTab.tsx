import { useState } from "react";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import {
  useEscalasMembros,
  useCreateEscalaMembro,
  useDeleteEscalaMembro,
  useAusenciasMembros,
  useCreateAusenciaMembro,
  useDeleteAusenciaMembro,
} from "@/hooks/useEscalasMembros";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Clock, ChevronDown, ChevronRight, User, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-Feira" },
  { value: 2, label: "Terça-Feira" },
  { value: 3, label: "Quarta-Feira" },
  { value: 4, label: "Quinta-Feira" },
  { value: 5, label: "Sexta-Feira" },
  { value: 6, label: "Sábado" },
];

export function EscalaMembrosTab() {
  const { membros, isLoading: loadingMembros } = useTarefasMembros();
  const { data: todasEscalas = [] } = useEscalasMembros();
  const { data: todasAusencias = [] } = useAusenciasMembros();
  const criarEscala = useCreateEscalaMembro();
  const deletarEscala = useDeleteEscalaMembro();
  const criarAusencia = useCreateAusenciaMembro();
  const deletarAusencia = useDeleteAusenciaMembro();

  const [expandedMembros, setExpandedMembros] = useState<Set<string>>(new Set());
  const [expandedDias, setExpandedDias] = useState<Set<string>>(new Set());

  // Dialog states
  const [dialogNovoHorario, setDialogNovoHorario] = useState(false);
  const [novoHorarioMembro, setNovoHorarioMembro] = useState("");
  const [novoHorarioDia, setNovoHorarioDia] = useState<number>(1);
  const [novoHorarioInicio, setNovoHorarioInicio] = useState("08:00");
  const [novoHorarioFim, setNovoHorarioFim] = useState("18:00");

  const [dialogAusencia, setDialogAusencia] = useState(false);
  const [ausenciaMembroId, setAusenciaMembroId] = useState("");
  const [ausenciaDataInicio, setAusenciaDataInicio] = useState("");
  const [ausenciaDataFim, setAusenciaDataFim] = useState("");
  const [ausenciaMotivo, setAusenciaMotivo] = useState("");

  const toggleMembro = (id: string) => {
    setExpandedMembros(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDia = (key: string) => {
    setExpandedDias(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleAddHorario = async () => {
    if (!novoHorarioMembro || !novoHorarioInicio || !novoHorarioFim) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (novoHorarioInicio >= novoHorarioFim) {
      toast.error("Hora de início deve ser antes da hora de fim");
      return;
    }
    try {
      await criarEscala.mutateAsync({
        membro_id: novoHorarioMembro,
        dia_semana: novoHorarioDia,
        hora_inicio: novoHorarioInicio,
        hora_fim: novoHorarioFim,
        ativo: true,
      });
      toast.success("Horário adicionado");
      setDialogNovoHorario(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const handleAddAusencia = async () => {
    if (!ausenciaMembroId || !ausenciaDataInicio || !ausenciaDataFim) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    try {
      await criarAusencia.mutateAsync({
        membro_id: ausenciaMembroId,
        data_inicio: ausenciaDataInicio,
        data_fim: ausenciaDataFim,
        hora_inicio: null,
        hora_fim: null,
        motivo: ausenciaMotivo || null,
      });
      toast.success("Ausência registrada");
      setDialogAusencia(false);
      setAusenciaMotivo("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const openAddHorario = (membroId: string, dia?: number) => {
    setNovoHorarioMembro(membroId);
    setNovoHorarioDia(dia ?? 1);
    setNovoHorarioInicio("08:00");
    setNovoHorarioFim("18:00");
    setDialogNovoHorario(true);
  };

  const openAddAusencia = (membroId: string) => {
    setAusenciaMembroId(membroId);
    setAusenciaDataInicio("");
    setAusenciaDataFim("");
    setAusenciaMotivo("");
    setDialogAusencia(true);
  };

  if (loadingMembros) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Carregando membros...</p>;
  }

  if (membros.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-muted-foreground">Nenhum membro da equipe cadastrado</p>
        <p className="text-xs text-muted-foreground">Cadastre membros na aba Equipe para configurar escalas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {membros.map(membro => {
        const escalas = todasEscalas.filter(e => e.membro_id === membro.id);
        const ausencias = todasAusencias.filter(a => a.membro_id === membro.id);
        const isExpanded = expandedMembros.has(membro.id);

        // Group escalas by dia_semana
        const escalaPorDia: Record<number, typeof escalas> = {};
        for (const e of escalas) {
          if (!escalaPorDia[e.dia_semana]) escalaPorDia[e.dia_semana] = [];
          escalaPorDia[e.dia_semana].push(e);
        }

        return (
          <Card key={membro.id}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleMembro(membro.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{membro.nome}</CardTitle>
                        {membro.cargo && <p className="text-xs text-muted-foreground">{membro.cargo}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {escalas.length} horário{escalas.length !== 1 ? "s" : ""}
                      </Badge>
                      {ausencias.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {ausencias.length} ausência{ausencias.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openAddHorario(membro.id)}>
                      <Plus className="h-3.5 w-3.5" /> Horário
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openAddAusencia(membro.id)}>
                      <CalendarOff className="h-3.5 w-3.5" /> Ausência
                    </Button>
                  </div>

                  {/* Schedule by day */}
                  {DIAS_SEMANA.map(dia => {
                    const horarios = escalaPorDia[dia.value] || [];
                    if (horarios.length === 0) return null;
                    const dayKey = `${membro.id}-${dia.value}`;
                    const dayExpanded = expandedDias.has(dayKey);

                    return (
                      <Collapsible key={dia.value} open={dayExpanded} onOpenChange={() => toggleDia(dayKey)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 rounded p-1.5 text-sm">
                            {dayExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span className="font-medium text-xs">{dia.label}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {horarios.map(h => `${h.hora_inicio} - ${h.hora_fim}`).join(", ")}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-6 space-y-1 mt-1">
                          {horarios.map(h => (
                            <div key={h.id} className="flex items-center gap-2 text-xs py-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{h.hora_inicio} - {h.hora_fim}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 ml-auto text-destructive hover:text-destructive"
                                onClick={() => deletarEscala.mutate(h.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1 h-6"
                            onClick={() => openAddHorario(membro.id, dia.value)}
                          >
                            <Plus className="h-3 w-3" /> Adicionar horário
                          </Button>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}

                  {escalas.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhum horário configurado</p>
                  )}

                  {/* Ausências */}
                  {ausencias.length > 0 && (
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Ausências</p>
                      {ausencias.map(a => (
                        <div key={a.id} className="flex items-center gap-2 text-xs py-1">
                          <CalendarOff className="h-3 w-3 text-muted-foreground" />
                          <span>{a.data_inicio === a.data_fim ? a.data_inicio : `${a.data_inicio} → ${a.data_fim}`}</span>
                          {a.motivo && <span className="text-muted-foreground">({a.motivo})</span>}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-auto text-destructive hover:text-destructive"
                            onClick={() => deletarAusencia.mutate(a.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Dialog: Novo Horário */}
      <Dialog open={dialogNovoHorario} onOpenChange={setDialogNovoHorario}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Horário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dia da Semana</Label>
              <Select value={String(novoHorarioDia)} onValueChange={v => setNovoHorarioDia(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={novoHorarioInicio} onChange={e => setNovoHorarioInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={novoHorarioFim} onChange={e => setNovoHorarioFim(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleAddHorario} className="w-full" disabled={criarEscala.isPending}>
              {criarEscala.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ausência */}
      <Dialog open={dialogAusencia} onOpenChange={setDialogAusencia}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Ausência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input type="date" value={ausenciaDataInicio} onChange={e => { setAusenciaDataInicio(e.target.value); if (!ausenciaDataFim) setAusenciaDataFim(e.target.value); }} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim *</Label>
                <Input type="date" value={ausenciaDataFim} onChange={e => setAusenciaDataFim(e.target.value)} min={ausenciaDataInicio} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input value={ausenciaMotivo} onChange={e => setAusenciaMotivo(e.target.value)} placeholder="Ex: Férias" />
            </div>
            <Button onClick={handleAddAusencia} className="w-full" disabled={criarAusencia.isPending}>
              {criarAusencia.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
