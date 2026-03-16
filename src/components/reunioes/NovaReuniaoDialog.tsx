import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDay } from "date-fns";
import { User, Video, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useEscalasMembros, useAusenciasMembros, EscalaMembro, AusenciaMembro } from "@/hooks/useEscalasMembros";
import { useAuth } from "@/contexts/AuthContext";
import { formatInTimeZone } from "date-fns-tz";
import { timeToMinutes, minutesToTime, rangesOverlap } from "@/utils/timeSlots";
import { useTiposReuniao, useTipoReuniaoMembros } from "@/hooks/useTiposReuniao";

function computeSlots(
  escalas: EscalaMembro[],
  ausencias: AusenciaMembro[],
  memberMeetings: Array<{ data_reuniao: string; duracao_minutos: number }>,
  date: string,
  durationMin: number,
  stepMin: number = 30,
): string[] {
  const d = new Date(date + "T00:00:00");
  const dow = getDay(d);
  const dayEscalas = escalas.filter(e => e.dia_semana === dow);
  if (dayEscalas.length === 0) return [];

  const partialAbsences = ausencias.filter(a =>
    date >= a.data_inicio && date <= a.data_fim && a.hora_inicio && a.hora_fim
  );
  const fullAbsent = ausencias.some(a =>
    date >= a.data_inicio && date <= a.data_fim && !a.hora_inicio
  );
  if (fullAbsent) return [];

  const slots: string[] = [];
  for (const escala of dayEscalas) {
    const startMin = timeToMinutes(escala.hora_inicio);
    const endMin = timeToMinutes(escala.hora_fim);
    for (let t = startMin; t + durationMin <= endMin; t += stepMin) {
      const slotRange = { startMin: t, endMin: t + durationMin };
      const absConflict = partialAbsences.some(a => {
        const aS = timeToMinutes(a.hora_inicio!);
        const aE = timeToMinutes(a.hora_fim!);
        return rangesOverlap(slotRange, { startMin: aS, endMin: aE });
      });
      if (absConflict) continue;
      const meetConflict = memberMeetings.some(m => {
        const mDate = formatInTimeZone(new Date(m.data_reuniao), "America/Sao_Paulo", "yyyy-MM-dd");
        if (mDate !== date) return false;
        const mTime = formatInTimeZone(new Date(m.data_reuniao), "America/Sao_Paulo", "HH:mm");
        const mS = timeToMinutes(mTime);
        const mE = mS + ((m as any).duracao_minutos || 60);
        return rangesOverlap(slotRange, { startMin: mS, endMin: mE });
      });
      if (meetConflict) continue;
      slots.push(minutesToTime(t));
    }
  }
  return slots;
}

interface NovaReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClienteNome?: string;
  initialClienteTelefone?: string;
}

export function NovaReuniaoDialog({ open, onOpenChange, initialClienteNome, initialClienteTelefone }: NovaReuniaoDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { membros } = useTarefasMembros();
  const { data: allEscalas = [] } = useEscalasMembros();
  const { data: allAusencias = [] } = useAusenciasMembros();

  const [titulo, setTitulo] = useState("");
  const [duracao, setDuracao] = useState(60);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [use15min, setUse15min] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedTipoId, setSelectedTipoId] = useState<string>("");
  const [meetingsByUser, setMeetingsByUser] = useState<Record<string, Array<{ id: string; data_reuniao: string; duracao_minutos: number }>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leads, setLeads] = useState<Array<{ id: string; nome: string; telefone: string }>>([]);
  const [showLeadsList, setShowLeadsList] = useState(false);

  const { data: tiposReuniao = [] } = useTiposReuniao();
  const { data: tipoMembros = [] } = useTipoReuniaoMembros(selectedTipoId || null);
  const tipoMembrosIds = useMemo(() => new Set(tipoMembros.map(tm => tm.membro_id)), [tipoMembros]);

  const stepInterval = use15min ? 15 : 30;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitulo("");
      setDuracao(60);
      setSelectedDate(new Date().toISOString().split("T")[0]);
      setSelectedMemberId("");
      setSelectedTime("");
      setClienteNome(initialClienteNome || "");
      setClienteTelefone(initialClienteTelefone || "");
      setClienteSearch("");
      setSelectedTipoId("");
      setShowLeadsList(false);
    }
  }, [open, initialClienteNome, initialClienteTelefone]);

  // Fetch meetings
  useEffect(() => {
    if (!open) return;
    const fetchMeetings = async () => {
      const { data } = await supabase
        .from("reunioes")
        .select("id, data_reuniao, duracao_minutos, user_id")
        .in("status", ["agendado", "confirmado"]);
      const grouped: Record<string, Array<{ id: string; data_reuniao: string; duracao_minutos: number }>> = {};
      for (const r of (data as any[]) || []) {
        if (!grouped[r.user_id]) grouped[r.user_id] = [];
        grouped[r.user_id].push({ id: r.id, data_reuniao: r.data_reuniao, duracao_minutos: r.duracao_minutos });
      }
      setMeetingsByUser(grouped);
    };
    fetchMeetings();
  }, [open, selectedDate]);

  // Fetch clientes (internos e preview) for autocomplete
  useEffect(() => {
    if (!open) return;
    const fetchClientes = async () => {
      const { data } = await supabase
        .from("tarefas_clientes")
        .select("id, nome, telefone")
        .order("nome")
        .limit(500);
      setLeads((data as any[]) || []);
    };
    fetchClientes();
  }, [open]);

  const filteredLeads = useMemo(() => {
    if (!clienteSearch) return [];
    const q = clienteSearch.toLowerCase();
    return leads.filter(l =>
      l.nome?.toLowerCase().includes(q) || l.telefone?.includes(q)
    ).slice(0, 8);
  }, [leads, clienteSearch]);

  const allMembersRaw = useMemo(() => {
    return membros.map(m => ({
      id: m.id,
      nome: m.nome,
      cargo: m.cargo,
      isAdmin: false,
      escalas: allEscalas.filter(e => e.membro_id === m.id),
      ausencias: allAusencias.filter(a => a.membro_id === m.id),
      authUserId: (m as any).auth_user_id as string | null,
    }));
  }, [membros, allEscalas, allAusencias]);

  // Filter members by tipo_reuniao if selected
  const allMembers = useMemo(() => {
    if (!selectedTipoId || tipoMembrosIds.size === 0) return allMembersRaw;
    return allMembersRaw.filter(m => tipoMembrosIds.has(m.id));
  }, [allMembersRaw, selectedTipoId, tipoMembrosIds]);

  const memberSlots = useMemo(() => {
    if (!selectedDate) return {};
    const map: Record<string, string[]> = {};
    for (const m of allMembers) {
      const memberUserId = m.authUserId || user?.id;
      const memberMeetings = memberUserId ? (meetingsByUser[memberUserId] || []) : [];
      if (m.escalas.length > 0) {
        map[m.id] = computeSlots(m.escalas, m.ausencias, memberMeetings, selectedDate, duracao, stepInterval);
      } else {
        map[m.id] = [];
      }
    }
    return map;
  }, [allMembers, selectedDate, meetingsByUser, duracao, stepInterval, user?.id]);

  const hasTimeConflict = (memberId: string, time: string): boolean => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member || !time || !selectedDate) return false;
    const memberUserId = member.authUserId || user?.id;
    const meetings = memberUserId ? (meetingsByUser[memberUserId] || []) : [];
    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + duracao;
    return meetings.some(m => {
      const mDate = formatInTimeZone(new Date(m.data_reuniao), "America/Sao_Paulo", "yyyy-MM-dd");
      if (mDate !== selectedDate) return false;
      const mTime = formatInTimeZone(new Date(m.data_reuniao), "America/Sao_Paulo", "HH:mm");
      const mS = timeToMinutes(mTime);
      const mE = mS + (m.duracao_minutos || 60);
      return rangesOverlap({ startMin: slotStart, endMin: slotEnd }, { startMin: mS, endMin: mE });
    });
  };

  const handleSelectSlot = (memberId: string, time: string) => {
    setSelectedMemberId(memberId);
    setSelectedTime(time);
  };

  const handleSelectLead = (lead: { nome: string; telefone: string }) => {
    setClienteNome(lead.nome);
    setClienteTelefone(lead.telefone);
    setClienteSearch("");
    setShowLeadsList(false);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !selectedMemberId || !titulo) return;
    if (hasTimeConflict(selectedMemberId, selectedTime)) return;

    setIsSubmitting(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newDate = new Date(selectedDate + "T00:00:00");
      newDate.setHours(hours, minutes, 0, 0);

      const { data: result, error } = await supabase.functions.invoke("create-member-reuniao", {
        body: {
          memberId: selectedMemberId,
          titulo,
          dataHora: newDate.toISOString(),
          duracao,
          clienteNome: clienteNome || null,
          clienteTelefone: clienteTelefone || null,
          tipoReuniaoId: selectedTipoId || null,
        },
      });

      if (error) throw error;
      if (result?.success === false) throw new Error(result.error || "Erro ao criar reunião");

      queryClient.invalidateQueries({ queryKey: ["reunioes"] });
      toast.success("Reunião criada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar reunião:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar reunião");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col min-h-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nova Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col space-y-5 pr-1">
          {/* Título */}
          <div className="space-y-2">
            <Label>Título da Reunião *</Label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Consulta inicial, Follow-up..."
            />
          </div>

          {/* Tipo de Reunião */}
          {tiposReuniao.filter(t => t.ativo).length > 0 && (
            <div className="space-y-2">
              <Label>Tipo de Reunião</Label>
              <Select value={selectedTipoId} onValueChange={(v) => {
                const newId = v === "none" ? "" : v;
                setSelectedTipoId(newId);
                setSelectedMemberId("");
                setSelectedTime("");
                if (newId) {
                  const tipo = tiposReuniao.find(t => t.id === newId);
                  if (tipo?.duracao_minutos) setDuracao(tipo.duracao_minutos);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos os profissionais</SelectItem>
                  {tiposReuniao.filter(t => t.ativo).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Cliente</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={clienteNome || clienteSearch}
                onChange={e => {
                  if (clienteNome) {
                    setClienteNome("");
                    setClienteTelefone("");
                  }
                  setClienteSearch(e.target.value);
                  setShowLeadsList(true);
                }}
                onFocus={() => clienteSearch && setShowLeadsList(true)}
                placeholder="Buscar cliente por nome ou telefone..."
                className="pl-9"
              />
              {showLeadsList && filteredLeads.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {filteredLeads.map(l => (
                    <button
                      key={l.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => handleSelectLead(l)}
                    >
                      <span className="font-medium">{l.nome}</span>
                      {l.telefone && <span className="text-muted-foreground ml-2">{l.telefone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clienteTelefone && (
              <p className="text-xs text-muted-foreground">Tel: {clienteTelefone}</p>
            )}
          </div>

          {/* Data e Duração */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setSelectedTime(""); setSelectedMemberId(""); }}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                value={duracao}
                onChange={e => setDuracao(Number(e.target.value) || 60)}
                min={15}
                step={15}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="use15-nova"
              checked={use15min}
              onCheckedChange={(c) => { setUse15min(!!c); setSelectedTime(""); }}
            />
            <label htmlFor="use15-nova" className="text-xs text-muted-foreground cursor-pointer">Intervalos de 15 min</label>
          </div>

          {/* Members with time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Selecione Profissional e Horário *
              </Label>

              <div className="h-[300px] overflow-y-auto pr-1">
                <div className="space-y-3">
                  {allMembers.map(member => {
                    const slots = memberSlots[member.id] || [];
                    const hasEscala = member.escalas.length > 0;

                    return (
                      <div key={member.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-medium">{member.nome}</span>
                          {member.cargo && <span className="text-xs text-muted-foreground">({member.cargo})</span>}
                        </div>

                        {hasEscala && slots.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {slots.map(t => (
                              <Button
                                key={t}
                                variant={selectedMemberId === member.id && selectedTime === t ? "default" : "outline"}
                                size="sm"
                                className="text-xs h-7 px-2.5"
                                onClick={() => handleSelectSlot(member.id, t)}
                              >
                                {t}
                              </Button>
                            ))}
                          </div>
                        ) : hasEscala && slots.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Sem horários disponíveis nesta data</p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground italic mb-1.5">Sem escala configurada — horário livre</p>
                            <Input
                              type="time"
                              className="w-28 h-7 text-xs"
                              value={selectedMemberId === member.id ? selectedTime : "08:00"}
                              onChange={e => handleSelectSlot(member.id, e.target.value)}
                            />
                            {selectedMemberId === member.id && selectedTime && hasTimeConflict(member.id, selectedTime) && (
                              <p className="text-xs text-destructive font-medium">⚠ Já existe uma reunião neste horário</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {allMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum membro da equipe cadastrado
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedDate || !selectedTime || !selectedMemberId || !titulo || hasTimeConflict(selectedMemberId, selectedTime)}
            className="gap-1.5"
          >
            <Video className="h-4 w-4" />
            {isSubmitting ? "Criando..." : "Criar Reunião"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
