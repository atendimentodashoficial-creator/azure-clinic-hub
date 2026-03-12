import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User, Video, ArrowLeft, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TarefaCliente } from "@/hooks/useTarefasClientes";
import { Profissional, useProfissionais } from "@/hooks/useProfissionais";
import { useEscalas, useAusencias, Escala, Ausencia } from "@/hooks/useEscalas";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { timeToMinutes, minutesToTime, rangesOverlap } from "@/utils/timeSlots";

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

// --- Step: Select Profissional ---
interface SelectProfissionalStepProps {
  onSelect: (p: Profissional) => void;
  onBack: () => void;
  clienteNome: string;
}

export function SelectProfissionalStep({ onSelect, onBack, clienteNome }: SelectProfissionalStepProps) {
  const { data: profissionais = [], isLoading } = useProfissionais(true);
  const [busca, setBusca] = useState("");

  const filtrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.especialidade?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <p className="text-sm text-muted-foreground">
        Selecione o profissional para a reunião com <strong>{clienteNome}</strong>
      </p>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar profissional..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
      </div>

      <ScrollArea className="flex-1 max-h-[50vh]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum profissional encontrado</p>
            <p className="text-xs text-muted-foreground">Cadastre profissionais e configure suas escalas na página de Escala</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtrados.map(prof => (
              <button
                key={prof.id}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                  "hover:bg-accent/50 transition-colors"
                )}
                onClick={() => onSelect(prof)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{prof.nome}</p>
                  {prof.especialidade && (
                    <p className="text-xs text-muted-foreground truncate">{prof.especialidade}</p>
                  )}
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
  profissional: Profissional;
  clienteNome: string;
  templateNome: string;
  saving: boolean;
  onBack: () => void;
  onConfirm: (data: { titulo: string; dataHora: string; duracao: number; profissionalId: string }) => void;
}

const DIAS_SEMANA_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function ScheduleMeetingStep({
  profissional, clienteNome, templateNome, saving, onBack, onConfirm,
}: ScheduleMeetingStepProps) {
  const { data: escalas = [] } = useEscalas(profissional.id);
  const { data: ausencias = [] } = useAusencias(profissional.id);

  const [reuniaoTitulo, setReuniaoTitulo] = useState(`Reunião - ${clienteNome} - ${templateNome}`);
  const [reuniaoDuracao, setReuniaDuracao] = useState("60");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState<string>("08:00");

  // Existing meetings for this profissional to check conflicts
  const [existingMeetings, setExistingMeetings] = useState<Array<{ data_reuniao: string; duracao_minutos: number }>>([]);

  // Fetch existing meetings for conflict check
  useMemo(() => {
    (async () => {
      const { data } = await supabase
        .from("reunioes")
        .select("data_reuniao, duracao_minutos")
        .eq("profissional_id", profissional.id)
        .in("status", ["agendado", "confirmado"]);
      setExistingMeetings((data as any[]) || []);
    })();
  }, [profissional.id]);

  // Generate available dates (next 30 days)
  const availableDates = useMemo(() => {
    const dates: { date: string; label: string; dayOfWeek: number }[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      const dow = getDay(d); // 0=sun, 6=sat
      const dateStr = format(d, "yyyy-MM-dd");

      // Check if profissional has escala for this day
      const hasEscala = escalas.some(e => e.dia_semana === dow);
      if (!hasEscala) continue;

      // Check if profissional is absent
      const isAbsent = ausencias.some(a => {
        const dStr = dateStr;
        return dStr >= a.data_inicio && dStr <= a.data_fim && !a.hora_inicio; // full day absence
      });
      if (isAbsent) continue;

      dates.push({
        date: dateStr,
        label: format(d, "EEE, dd/MM", { locale: ptBR }),
        dayOfWeek: dow,
      });
    }
    return dates;
  }, [escalas, ausencias]);

  // Generate available time slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];

    const d = new Date(selectedDate + "T00:00:00");
    const dow = getDay(d);
    const duration = parseInt(reuniaoDuracao) || 60;

    // Get escalas for this day
    const dayEscalas = escalas.filter(e => e.dia_semana === dow);
    if (dayEscalas.length === 0) return [];

    // Get partial absences for this date
    const partialAbsences = ausencias.filter(a => {
      return selectedDate >= a.data_inicio && selectedDate <= a.data_fim && a.hora_inicio && a.hora_fim;
    });

    const slots: string[] = [];
    const step = 30; // 30-min steps

    for (const escala of dayEscalas) {
      const startMin = timeToMinutes(escala.hora_inicio);
      const endMin = timeToMinutes(escala.hora_fim);

      for (let t = startMin; t + duration <= endMin; t += step) {
        const slotStart = t;
        const slotEnd = t + duration;
        const slotRange = { startMin: slotStart, endMin: slotEnd };

        // Check partial absence conflict
        const absenceConflict = partialAbsences.some(a => {
          const aStart = timeToMinutes(a.hora_inicio!);
          const aEnd = timeToMinutes(a.hora_fim!);
          return rangesOverlap(slotRange, { startMin: aStart, endMin: aEnd });
        });
        if (absenceConflict) continue;

        // Check meeting conflict
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
  }, [selectedDate, escalas, ausencias, existingMeetings, reuniaoDuracao]);

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const dataHora = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    onConfirm({
      titulo: reuniaoTitulo.trim() || `Reunião - ${clienteNome}`,
      dataHora,
      duracao: parseInt(reuniaoDuracao) || 60,
      profissionalId: profissional.id,
    });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        <span>Profissional: <strong className="text-foreground">{profissional.nome}</strong></span>
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

      {/* Date selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> Selecione a data
        </Label>
        {availableDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma data disponível. Configure a escala do profissional na página de Escala.
          </p>
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

      {/* Time selection */}
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
