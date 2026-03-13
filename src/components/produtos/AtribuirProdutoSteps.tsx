import { useState, useMemo, useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, User, Video, ArrowLeft, Calendar, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { TarefaCliente } from "@/hooks/useTarefasClientes";
import { useTarefasMembros, TarefaMembro } from "@/hooks/useTarefasMembros";
import { useEscalasMembros, useAusenciasMembros, EscalaMembro, AusenciaMembro } from "@/hooks/useEscalasMembros";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { timeToMinutes, minutesToTime, rangesOverlap } from "@/utils/timeSlots";

export interface MeetingMember {
  id: string;
  nome: string;
  cargo?: string | null;
  isAdmin?: boolean;
}

// --- Step: Select Client ---
interface SelectClientStepProps {
  busca: string;
  onBuscaChange: (v: string) => void;
  filtrados: TarefaCliente[];
  saving: boolean;
  requerReuniao: boolean;
  onSelectClient: (c: TarefaCliente) => void;
  onNovoCliente: () => void;
}

export function SelectClientStep({
  busca, onBuscaChange, filtrados, saving, requerReuniao, onSelectClient, onNovoCliente,
}: SelectClientStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={busca} onChange={e => onBuscaChange(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onNovoCliente}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>
      <ScrollArea className="flex-1 max-h-[50vh]">
        {!busca.trim() ? null : filtrados.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
            <Button variant="link" size="sm" onClick={onNovoCliente}>Cadastrar novo cliente</Button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtrados.map(cliente => (
              <button
                key={cliente.id}
                disabled={saving}
                className={cn("w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-accent/50 transition-colors disabled:opacity-50")}
                onClick={() => onSelectClient(cliente)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[cliente.email, cliente.telefone].filter(Boolean).join(" • ") || "Sem contato"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// --- Helper: compute slots for a member on a given date ---
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
  const step = stepMin;

  for (const escala of dayEscalas) {
    const startMin = timeToMinutes(escala.hora_inicio);
    const endMin = timeToMinutes(escala.hora_fim);
    for (let t = startMin; t + durationMin <= endMin; t += step) {
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
        const mE = mS + (m.duracao_minutos || 60);
        return rangesOverlap(slotRange, { startMin: mS, endMin: mE });
      });
      if (meetConflict) continue;
      slots.push(minutesToTime(t));
    }
  }
  return slots;
}

// --- Combined Step: Select Member + Time Slot ---
interface SelectMemberAndTimeStepProps {
  clienteNome: string;
  templateNome: string;
  saving: boolean;
  defaultDuracao?: number;
  tipoReuniaoId?: string | null;
  onBack: () => void;
  onConfirm: (data: { titulo: string; dataHora: string; duracao: number; memberNome: string; memberId: string }) => void;
}

export function SelectMemberAndTimeStep({
  clienteNome, templateNome, saving, defaultDuracao, tipoReuniaoId, onBack, onConfirm,
}: SelectMemberAndTimeStepProps) {
  const { user } = useAuth();
  const { membros } = useTarefasMembros();
  const { data: allEscalas = [] } = useEscalasMembros();
  const { data: allAusencias = [] } = useAusenciasMembros();

  const [reuniaoTitulo, setReuniaoTitulo] = useState(`Reunião - ${clienteNome} - ${templateNome}`);
  const [reuniaoDuracao, setReuniaDuracao] = useState(String(defaultDuracao || 60));
  const [use15min, setUse15min] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [meetingsByUser, setMeetingsByUser] = useState<Record<string, Array<{ data_reuniao: string; duracao_minutos: number }>>>({});

  const duration = parseInt(reuniaoDuracao) || 60;
  const stepInterval = use15min ? 15 : 30;

  const fetchMeetings = async () => {
    const { data } = await supabase
      .from("reunioes")
      .select("data_reuniao, duracao_minutos, user_id")
      .in("status", ["agendado", "confirmado"]);
    const grouped: Record<string, Array<{ data_reuniao: string; duracao_minutos: number }>> = {};
    for (const r of (data as any[]) || []) {
      if (!grouped[r.user_id]) grouped[r.user_id] = [];
      grouped[r.user_id].push({ data_reuniao: r.data_reuniao, duracao_minutos: r.duracao_minutos });
    }
    setMeetingsByUser(grouped);
  };

  useEffect(() => {
    fetchMeetings();
  }, [selectedDate]);

  // Build member list: team members only (admin excluded)
  const allMembers: (MeetingMember & { escalas: EscalaMembro[]; ausencias: AusenciaMembro[]; authUserId?: string | null })[] = useMemo(() => {
    const list: (MeetingMember & { escalas: EscalaMembro[]; ausencias: AusenciaMembro[]; authUserId?: string | null })[] = [];
    for (const m of membros) {
      list.push({
        id: m.id,
        nome: m.nome,
        cargo: m.cargo,
        isAdmin: false,
        escalas: allEscalas.filter(e => e.membro_id === m.id),
        ausencias: allAusencias.filter(a => a.membro_id === m.id),
        authUserId: (m as any).auth_user_id,
      });
    }
    return list;
  }, [membros, allEscalas, allAusencias]);

  // Compute slots per member for the selected date
  const memberSlots = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const m of allMembers) {
      // Resolve the user_id this member's meetings are stored under
      const memberUserId = m.authUserId || user?.id;
      const memberMeetings = memberUserId ? (meetingsByUser[memberUserId] || []) : [];

      if (m.isAdmin) {
        map[m.id] = [];
      } else if (m.escalas.length > 0) {
        map[m.id] = computeSlots(m.escalas, m.ausencias, memberMeetings, selectedDate, duration, stepInterval);
      } else {
        map[m.id] = [];
      }
    }
    return map;
  }, [allMembers, selectedDate, meetingsByUser, duration, stepInterval, user?.id]);

  const selectedMemberObj = allMembers.find(m => m.id === selectedMemberId);

  // Check if a given time conflicts with existing meetings for a member
  const hasTimeConflict = (memberId: string, time: string): boolean => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member || !time || !selectedDate) return false;
    const memberUserId = member.authUserId || user?.id;
    const meetings = memberUserId ? (meetingsByUser[memberUserId] || []) : [];
    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + duration;
    return meetings.some(m => {
      const mDate = formatInTimeZone(new Date(m.data_reuniao), "America/Sao_Paulo", "yyyy-MM-dd");
      if (mDate !== selectedDate) return false;
      const mTime = formatInTimeZone(new Date(m.data_reuniao), "America/Sao_Paulo", "HH:mm");
      const mS = timeToMinutes(mTime);
      const mE = mS + (m.duracao_minutos || 60);
      return rangesOverlap({ startMin: slotStart, endMin: slotEnd }, { startMin: mS, endMin: mE });
    });
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime || !selectedMemberObj) return;
    if (hasTimeConflict(selectedMemberId, selectedTime)) {
      return;
    }
    const dataHora = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    onConfirm({
      titulo: reuniaoTitulo.trim() || `Reunião - ${clienteNome}`,
      dataHora,
      duracao: duration,
      memberNome: selectedMemberObj.nome,
      memberId: selectedMemberObj.id,
    });
  };

  const handleSelectSlot = (memberId: string, time: string) => {
    setSelectedMemberId(memberId);
    setSelectedTime(time);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="space-y-2">
        <Label>Título da Reunião</Label>
        <Input value={reuniaoTitulo} onChange={e => setReuniaoTitulo(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data</Label>
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
            value={reuniaoDuracao}
            onChange={e => { setReuniaDuracao(e.target.value); setSelectedTime(""); }}
            min={15}
            step={15}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="use15"
          checked={use15min}
          onCheckedChange={(c) => { setUse15min(!!c); setSelectedTime(""); }}
        />
        <label htmlFor="use15" className="text-xs text-muted-foreground cursor-pointer">Intervalos de 15 min</label>
      </div>

      {/* Members with time slots */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          Selecione Profissional e Horário
        </Label>

        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {allMembers.map(member => {
              const slots = memberSlots[member.id] || [];
              const hasEscala = !member.isAdmin && member.escalas.length > 0;

              return (
                <div key={member.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {member.isAdmin ? (
                      <Shield className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-primary shrink-0" />
                    )}
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
                  ) : member.isAdmin ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          className="w-28 h-7 text-xs"
                          value={selectedMemberId === member.id ? selectedTime : "08:00"}
                          onChange={e => handleSelectSlot(member.id, e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">Horário livre</span>
                      </div>
                      {selectedMemberId === member.id && selectedTime && hasTimeConflict(member.id, selectedTime) && (
                        <p className="text-xs text-destructive font-medium">⚠ Já existe uma reunião neste horário</p>
                      )}
                    </div>
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
          </div>
        </ScrollArea>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t mt-auto">
        <Button variant="outline" onClick={onBack} disabled={saving}>Voltar</Button>
        <Button
          onClick={handleConfirm}
          disabled={saving || !selectedDate || !selectedTime || !selectedMemberId || hasTimeConflict(selectedMemberId, selectedTime)}
          className="gap-1.5"
        >
          <Video className="h-4 w-4" />
          {saving ? "Salvando..." : "Atribuir e Agendar"}
        </Button>
      </div>
    </div>
  );
}
