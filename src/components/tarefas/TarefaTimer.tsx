import { useState, useEffect } from "react";
import { Timer, Play, Pause, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function TarefaTimer({ timerStatus, timerInicio, tempoAcumulado }: {
  timerStatus: string;
  timerInicio: string | null;
  tempoAcumulado: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (timerStatus === "rodando" && timerInicio) {
      const calcElapsed = () => {
        const diff = Math.floor((Date.now() - new Date(timerInicio).getTime()) / 1000);
        setElapsed(tempoAcumulado + Math.max(0, diff));
      };
      calcElapsed();
      const interval = setInterval(calcElapsed, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsed(tempoAcumulado);
    }
  }, [timerStatus, timerInicio, tempoAcumulado]);

  if (timerStatus === "parado" && tempoAcumulado === 0) return null;

  const isRunning = timerStatus === "rodando";
  const isDone = timerStatus === "concluido";

  return (
    <span className={cn(
      "text-xs flex items-center gap-1 font-mono",
      isRunning && "text-primary animate-pulse",
      isDone && "text-emerald-400",
      !isRunning && !isDone && "text-muted-foreground"
    )}>
      {isRunning ? <Play className="h-3 w-3" /> : isDone ? <CheckCircle2 className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      {formatDuration(elapsed)}
    </span>
  );
}
