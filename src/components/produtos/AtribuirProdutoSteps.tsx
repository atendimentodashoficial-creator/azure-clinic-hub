import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User, Video, ArrowLeft, Calendar, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { TarefaCliente } from "@/hooks/useTarefasClientes";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useEscalasMembros, useAusenciasMembros } from "@/hooks/useEscalasMembros";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { timeToMinutes, minutesToTime, rangesOverlap } from "@/utils/timeSlots";

// Shared type for meeting member (can be admin or team member)
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
    <div className="flex-1 overflow-hidden flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => onBuscaChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onNovoCliente}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      <ScrollArea className="flex-1 max-h-[50vh]">
        {filtrados.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
            <Button variant="link" size="sm" onClick={onNovoCliente}>Cadastrar novo cliente</Button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtrados.map(cliente => (
              <button
                key={cliente.id}
                disabled={saving}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                  "hover:bg-accent/50 transition-colors",
                  "disabled:opacity-50"
                )}
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

// --- Step: Select Member (team members + admin) ---
interface SelectMemberStepProps {
  onSelect: (m: MeetingMember) => void;
  onBack: () => void;
  clienteNome: string;
}

export function SelectMemberStep({ onSelect, onBack, clienteNome }: SelectMemberStepProps) {
  const { user } = useAuth();
  const { membros, isLoading } = useTarefasMembros();
  const [busca, setBusca] = useState("");

  const allMembers: MeetingMember[] = useMemo(() => {
    const list: MeetingMember[] = [];
    if (user) {
      list.push({
        id: user.id,
        nome: user.user_metadata?.full_name || user.email || "Administrador",
        cargo: "Administrador",
        isAdmin: true,
      });
    }
    for (const m of membros) {
      list.push({ id: m.id, nome: m.nome, cargo: m.cargo, isAdmin: false });
    }
    return list;
  }, [user, membros]);

  const filtrados = allMembers.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.cargo?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <p className="text-sm text-muted-foreground">
        Selecione quem será o responsável pela reunião com <strong className="text-foreground">{clienteNome}</strong>
      </p>
      {allMembers.length > 3 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
      )}
      <ScrollArea className="flex-1 max-h-[50vh]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtrados.map(member => (
              <button
                key={member.id}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                  "hover:bg-accent/50 transition-colors"
                )}
                onClick={() => onSelect(member)}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  member.isAdmin ? "bg-primary/20" : "bg-primary/10"
                )}>
                  {member.isAdmin ? <Shield className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{member.nome}</p>
                  {member.cargo && <p className="text-xs text-muted-foreground truncate">{member.cargo}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// --- Step: Schedule Meeting with availability ---
interface ScheduleMeetingStepProps {
  member: MeetingMember;
  clienteNome: string;
  templateNome: string;
  saving: boolean;
  onBack: () => void;
  onConfirm: (data: { titulo: string; dataHora: string; duracao: number; memberNome: string }) => void;
}

export function ScheduleMeetingStep({
  member, clienteNome, templateNome, saving, onBack, onConfirm,
}: ScheduleMeetingStepProps) {
  // Only fetch escalas for non-admin members
  const membroId = member.isAdmin ? undefined : member.id;
  const { data: escalas = [] } = useEscalasMembros(membroId);
  const { data: ausencias = [] } = useAusenciasMembros(membroId);

  const hasEscala = !member.isAdmin && escalas.length > 0;

  const [reuniaoTitulo, setReuniaoTitulo] = useState(`Reunião - ${clienteNome} - ${templateNome}`);
  const [reuniaoDuracao, setReuniaDuracao] = useState("60");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState<string>("08:00");

  // Existing meetings for conflict check
  const [existingMeetings, setExistingMeetings] = useState<Array<{ data_reuniao: string; duracao_minutos: number }>>([]);

  useEffect(() => {
    (async () => {
      // For now, fetch all meetings for the user to check conflicts
      const { data } = await supabase
        .from("reunioes")
        .select("data_reuniao, duracao_minutos")
        .in("status", ["agendado", "confirmado"]);
      setExistingMeetings((data as any[]) || []);
    })();
  }, []);

  // Generate available dates (next 30 days) based on escala
  const availableDates = useMemo(() => {
    const dates: { date: string; label: string }[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      const dow = getDay(d);
      const dateStr = format(d, "yyyy-MM-dd");

      if (hasEscala) {
        const hasDay = escalas.some(e => e.dia_semana === dow);
        if (!hasDay) continue;

        const isAbsent = ausencias.some(a =>
          dateStr >= a.data_inicio && dateStr <= a.data_fim && !a.hora_inicio
        );
        if (isAbsent) continue;
      }

      dates.push({
        date: dateStr,
        label: format(d, "EEE, dd/MM", { locale: ptBR }),
      });
    }
    return dates;
  }, [escalas, ausencias, hasEscala]);

  // Generate available time slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate || !hasEscala) return [];

    const d = new Date(selectedDate + "T00:00:00");
    const dow = getDay(d);
    const duration = parseInt(reuniaoDuracao) || 60;

    const dayEscalas = escalas.filter(e => e.dia_semana === dow);
    if (dayEscalas.length === 0) return [];

    const partialAbsences = ausencias.filter(a =>
      selectedDate >= a.data_inicio && selectedDate <= a.data_fim && a.hora_inicio && a.hora_fim
    );

    const slots: string[] = [];
    const step = 30;

    for (const escala of dayEscalas) {
      const startMin = timeToMinutes(escala.hora_inicio);
      const endMin = timeToMinutes(escala.hora_fim);

      for (let t = startMin; t + duration <= endMin; t += step) {
        const slotRange = { startMin: t, endMin: t + duration };

        const absenceConflict = partialAbsences.some(a => {
          const aStart = timeToMinutes(a.hora_inicio!);
          const aEnd = timeToMinutes(a.hora_fim!);
          return rangesOverlap(slotRange, { startMin: aStart, endMin: aEnd });
        });
        if (absenceConflict) continue;

        const meetingConflict = existingMeetings.some(m => {
          const mDate = m.data_reuniao.substring(0, 10);
          if (mDate !== selectedDate) return false;
          const mTime = m.data_reuniao.substring(11, 16);
          const mStart = timeToMinutes(mTime);
          const mEnd = mStart + (m.duracao_minutos || 60);
          return rangesOverlap(slotRange, { startMin: mStart, endMin: mEnd });
        });
        if (meetingConflict) continue;

        slots.push(minutesToTime(t));
      }
    }
    return slots;
  }, [selectedDate, escalas, ausencias, existingMeetings, reuniaoDuracao, hasEscala]);

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const dataHora = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    onConfirm({
      titulo: reuniaoTitulo.trim() || `Reunião - ${clienteNome}`,
      dataHora,
      duracao: parseInt(reuniaoDuracao) || 60,
      memberNome: member.nome,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {member.isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
        <span>Responsável: <strong className="text-foreground">{member.nome}</strong></span>
      </div>

      <div className="space-y-2">
        <Label>Título da Reunião</Label>
        <Input value={reuniaoTitulo} onChange={e => setReuniaoTitulo(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Duração (minutos)</Label>
        <Input
          type="number"
          value={reuniaoDuracao}
          onChange={e => { setReuniaDuracao(e.target.value); setSelectedTime(""); }}
          min={15}
          step={15}
        />
      </div>

      {hasEscala ? (
        <>
          {/* Date selection based on escala */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Selecione a data
            </Label>
            {availableDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma data disponível nos próximos 30 dias.</p>
            ) : (
              <ScrollArea className="max-h-[120px]">
                <div className="flex flex-wrap gap-1.5">
                  {availableDates.map(d => (
                    <Button
                      key={d.date}
                      variant={selectedDate === d.date ? "default" : "outline"}
                      size="sm"
                      className="text-xs capitalize"
                      onClick={() => { setSelectedDate(d.date); setSelectedTime(""); }}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Time slots based on escala */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Horários disponíveis
              </Label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário disponível nesta data.</p>
              ) : (
                <ScrollArea className="max-h-[120px]">
                  <div className="flex flex-wrap gap-1.5">
                    {availableSlots.map(t => (
                      <Button
                        key={t}
                        variant={selectedTime === t ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedTime(t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Free-form date/time for admin or members without escala */}
          {!member.isAdmin && (
            <p className="text-xs text-muted-foreground bg-accent/50 rounded p-2">
              Este membro não possui escala configurada. Configure na aba Escalas em Reuniões para ver horários disponíveis.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora *</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t mt-auto">
        <Button variant="outline" onClick={onBack} disabled={saving}>Voltar</Button>
        <Button
          onClick={handleConfirm}
          disabled={saving || !selectedDate || !selectedTime}
          className="gap-1.5"
        >
          <Video className="h-4 w-4" />
          {saving ? "Salvando..." : "Atribuir e Agendar"}
        </Button>
      </div>
    </div>
  );
}
