import { useState, useMemo } from "react";
import { Calendar } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, addDays, startOfWeek, endOfWeek, subWeeks, addWeeks, startOfMonth, endOfMonth, subMonths, addMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

export type ReuniaoFilterValue =
  | "todas"
  | "ontem"
  | "hoje"
  | "amanha"
  | "semana_passada"
  | "semana_atual"
  | "proxima_semana"
  | "mes_passado"
  | "mes_atual"
  | "proximo_mes"
  | "periodo";

interface ReunioesPeriodFilterProps {
  value: ReuniaoFilterValue;
  onChange: (value: ReuniaoFilterValue) => void;
  dateStart: Date;
  dateEnd: Date;
  onDateStartChange: (date: Date) => void;
  onDateEndChange: (date: Date) => void;
  count?: number;
}

const filterOptions: { value: ReuniaoFilterValue; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "ontem", label: "Ontem" },
  { value: "hoje", label: "Hoje" },
  { value: "amanha", label: "Amanhã" },
  { value: "semana_passada", label: "Semana Passada" },
  { value: "semana_atual", label: "Semana Atual" },
  { value: "proxima_semana", label: "Próxima Semana" },
  { value: "mes_passado", label: "Mês Passado" },
  { value: "mes_atual", label: "Mês Atual" },
  { value: "proximo_mes", label: "Próximo Mês" },
  { value: "periodo", label: "Período" },
];

export function ReunioesPeriodFilter({
  value,
  onChange,
  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
  count,
}: ReunioesPeriodFilterProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const isMobile = useIsMobile();

  const currentLabel = filterOptions.find(o => o.value === value)?.label ?? "Filtro";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={value} onValueChange={(v) => onChange(v as ReuniaoFilterValue)}>
        <SelectTrigger className="w-[200px] h-9 text-sm">
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue placeholder="Filtro de período" />
        </SelectTrigger>
        <SelectContent>
          {filterOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Count badge for non-hoje and non-periodo active filters */}
      {value !== "todas" && value !== "hoje" && value !== "periodo" && count !== undefined && (
        <Badge className="h-6 px-2 text-xs rounded-md bg-primary text-primary-foreground">
          {count} {count === 1 ? "reunião" : "reuniões"}
        </Badge>
      )}

      {/* Custom date pickers + count badge for period */}
      {value === "periodo" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Popover open={startOpen} onOpenChange={setStartOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[90px] h-8 text-xs">
                  {format(dateStart, "dd/MM/yy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateStart}
                  onSelect={(date) => {
                    if (date) { onDateStartChange(date); setStartOpen(false); }
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-xs">até</span>
            <Popover open={endOpen} onOpenChange={setEndOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[90px] h-8 text-xs">
                  {format(dateEnd, "dd/MM/yy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateEnd}
                  onSelect={(date) => {
                    if (date) { onDateEndChange(date); setEndOpen(false); }
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          {count !== undefined && (
            <Badge className="h-6 px-2 text-xs rounded-md bg-primary text-primary-foreground">
              {count} reunião(ões)
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/** Hook to manage the reuniões period filter state and apply it */
export function useReunioesPeriodFilter() {
  const [filterValue, setFilterValue] = useState<ReuniaoFilterValue>("hoje");
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  const dateRange = useMemo(() => {
    const today = new Date();
    switch (filterValue) {
      case "todas":
        return null;
      case "ontem":
        return { start: startOfDay(subDays(today, 1)), end: endOfDay(subDays(today, 1)) };
      case "hoje":
        return { start: startOfDay(today), end: endOfDay(today) };
      case "amanha":
        return { start: startOfDay(addDays(today, 1)), end: endOfDay(addDays(today, 1)) };
      case "semana_passada": {
        const lw = subWeeks(today, 1);
        return { start: startOfWeek(lw, { weekStartsOn: 0 }), end: endOfWeek(lw, { weekStartsOn: 0 }) };
      }
      case "semana_atual":
        return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) };
      case "proxima_semana": {
        const nw = addWeeks(today, 1);
        return { start: startOfWeek(nw, { weekStartsOn: 0 }), end: endOfWeek(nw, { weekStartsOn: 0 }) };
      }
      case "mes_passado": {
        const lm = subMonths(today, 1);
        return { start: startOfMonth(lm), end: endOfMonth(lm) };
      }
      case "mes_atual":
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case "proximo_mes": {
        const nm = addMonths(today, 1);
        return { start: startOfMonth(nm), end: endOfMonth(nm) };
      }
      case "periodo":
        return { start: startOfDay(customStart), end: endOfDay(customEnd) };
      default:
        return null;
    }
  }, [filterValue, customStart, customEnd]);

  const filterReunioes = <T extends { data_reuniao: string }>(items: T[]): T[] => {
    if (!dateRange) return items;
    return items.filter((item) => {
      const d = new Date(item.data_reuniao);
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
    });
  };

  return {
    filterValue,
    setFilterValue,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    filterReunioes,
  };
}
