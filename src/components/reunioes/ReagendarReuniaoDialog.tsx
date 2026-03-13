import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, getDay } from "date-fns";
import { User, Shield, Video } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useEscalasMembros, useAusenciasMembros, EscalaMembro, AusenciaMembro } from "@/hooks/useEscalasMembros";
import { useAuth } from "@/contexts/AuthContext";
import { formatInTimeZone } from "date-fns-tz";
import { timeToMinutes, minutesToTime, rangesOverlap } from "@/utils/timeSlots";

interface Reuniao {
  id: string;
  titulo: string;
  data_reuniao: string;
  profissional_id?: string | null;
  duracao_minutos?: number | null;
}

interface ReagendarReuniaoDialogProps {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function computeSlots(
  escalas: EscalaMembro[],
  ausencias: AusenciaMembro[],
  memberMeetings: Array<{ data_reuniao: string; duracao_minutos: number }>,
  date: string,
  durationMin: number,
  stepMin: number = 30,
  excludeReuniaoId?: string,
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

export function ReagendarReuniaoDialog({ reuniao, open, onOpenChange }: ReagendarReuniaoDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { membros } = useTarefasMembros();
  const { data: allEscalas = [] } = useEscalasMembros();
  const { data: allAusencias = [] } = useAusenciasMembros();

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [use15min, setUse15min] = useState(false);
  const [meetingsByUser, setMeetingsByUser] = useState<Record<string, Array<{ id: string; data_reuniao: string; duracao_minutos: number }>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const duration = reuniao?.duracao_minutos || 60;
  const stepInterval = use15min ? 15 : 30;

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

  // Reset form when dialog opens
  useEffect(() => {
    if (reuniao && open) {
      const reuniaoDate = formatInTimeZone(new Date(reuniao.data_reuniao), "America/Sao_Paulo", "yyyy-MM-dd");
      setSelectedDate(reuniaoDate);
      setSelectedTime("");
      // Pre-select the member that matches the current profissional_id
      const matchingMember = membros.find(m => m.id === reuniao.profissional_id);
      setSelectedMemberId(matchingMember?.id || "");
    }
  }, [reuniao, open, membros]);

  // Build member list
  const allMembers = useMemo(() => {
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

  // Compute slots per member
  const memberSlots = useMemo(() => {
    if (!selectedDate) return {};
    const map: Record<string, string[]> = {};
    for (const m of allMembers) {
      const memberUserId = m.authUserId || user?.id;
      // Exclude the current meeting from conflict calculation
      const memberMeetings = (memberUserId ? (meetingsByUser[memberUserId] || []) : [])
        .filter(mt => mt.id !== reuniao?.id);

      if (m.escalas.length > 0) {
        map[m.id] = computeSlots(m.escalas, m.ausencias, memberMeetings, selectedDate, duration, stepInterval);
      } else {
        map[m.id] = [];
      }
    }
    return map;
  }, [allMembers, selectedDate, meetingsByUser, duration, stepInterval, user?.id, reuniao?.id]);

  // Check time conflict for members without escala (manual input)
  const hasTimeConflict = (memberId: string, time: string): boolean => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member || !time || !selectedDate) return false;
    const memberUserId = member.authUserId || user?.id;
    const meetings = (memberUserId ? (meetingsByUser[memberUserId] || []) : [])
      .filter(mt => mt.id !== reuniao?.id);
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

  const handleSelectSlot = (memberId: string, time: string) => {
    setSelectedMemberId(memberId);
    setSelectedTime(time);
  };

  const handleSubmit = async () => {
    if (!reuniao || !selectedDate || !selectedTime || !selectedMemberId) return;
    if (hasTimeConflict(selectedMemberId, selectedTime)) return;

    setIsSubmitting(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newDate = new Date(selectedDate + "T00:00:00");
      newDate.setHours(hours, minutes, 0, 0);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Usuário não autenticado");
      }

      const { data: result, error } = await supabase.functions.invoke("google-calendar-update-event", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: {
          reuniaoId: reuniao.id,
          novaDataHora: newDate.toISOString(),
          profissionalId: selectedMemberId || null,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      queryClient.invalidateQueries({ queryKey: ["reunioes"] });
      if (result?.warning) {
        toast.warning(result.warning);
      } else {
        toast.success("Reunião reagendada com sucesso!");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao reagendar:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao reagendar reunião");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!reuniao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col min-h-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Reagendar Reunião</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Reunião: <span className="font-medium text-foreground">{reuniao.titulo}</span>
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col space-y-5 pr-1">
          {/* Date & interval options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setSelectedTime(""); setSelectedMemberId(""); }}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Input type="text" value={`${duration} min`} disabled className="bg-muted" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="use15-reagendar"
              checked={use15min}
              onCheckedChange={(c) => { setUse15min(!!c); setSelectedTime(""); }}
            />
            <label htmlFor="use15-reagendar" className="text-xs text-muted-foreground cursor-pointer">Intervalos de 15 min</label>
          </div>

          {/* Members with time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Selecione Profissional e Horário
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
            disabled={isSubmitting || !selectedDate || !selectedTime || !selectedMemberId || hasTimeConflict(selectedMemberId, selectedTime)}
            className="gap-1.5"
          >
            <Video className="h-4 w-4" />
            {isSubmitting ? "Reagendando..." : "Reagendar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
