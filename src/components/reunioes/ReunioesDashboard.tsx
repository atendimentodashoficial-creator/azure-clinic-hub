import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChevronDown, BarChart3, Users, XCircle, CheckCircle2, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reuniao {
  id: string;
  status: string;
  data_reuniao: string;
  duracao_minutos: number | null;
  tipo_reuniao_id: string | null;
  tipos_reuniao?: { nome: string } | null;
  profissionais?: { nome: string } | null;
}

interface ReunioesDashboardProps {
  reunioes: Reuniao[];
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 197 37% 24%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
  "hsl(var(--accent))",
];

export function ReunioesDashboard({ reunioes }: ReunioesDashboardProps) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const total = reunioes.length;
    if (total === 0) return null;

    const realizadas = reunioes.filter(r => r.status === "realizada" || r.status === "resumido" || r.status === "transcrito").length;
    const noShow = reunioes.filter(r => r.status === "nao_compareceu").length;
    const canceladas = reunioes.filter(r => r.status === "cancelado").length;
    const agendadas = reunioes.filter(r => r.status === "agendado" || r.status === "pendente").length;

    const finalizadas = realizadas + noShow;
    const taxaComparecimento = finalizadas > 0 ? Math.round((realizadas / finalizadas) * 100) : 0;
    const taxaNoShow = finalizadas > 0 ? Math.round((noShow / finalizadas) * 100) : 0;
    const taxaCancelamento = total > 0 ? Math.round((canceladas / total) * 100) : 0;

    // Conversão
    const convertidas = reunioes.filter(r => (r as any).converteu === true).length;
    const taxaConversao = total > 0 ? Math.round((convertidas / total) * 100) : 0;

    // Por tipo
    const porTipo: Record<string, number> = {};
    reunioes.forEach(r => {
      const nome = (r as any).tipos_reuniao?.nome || "Sem tipo";
      porTipo[nome] = (porTipo[nome] || 0) + 1;
    });
    const tiposData = Object.entries(porTipo)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Status breakdown
    const statusData = [
      { name: "Realizadas", value: realizadas, color: "hsl(142 71% 45%)" },
      { name: "No-show", value: noShow, color: "hsl(var(--destructive))" },
      { name: "Canceladas", value: canceladas, color: "hsl(var(--muted-foreground))" },
      { name: "Agendadas", value: agendadas, color: "hsl(var(--primary))" },
    ].filter(d => d.value > 0);

    return { total, realizadas, noShow, canceladas, agendadas, taxaComparecimento, taxaNoShow, taxaCancelamento, taxaConversao, convertidas, tiposData, statusData };
  }, [reunioes]);

  if (!stats || stats.total === 0) return null;

  const chartConfig = {
    value: { label: "Reuniões" },
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
          <BarChart3 className="h-4 w-4" />
          <span>Dashboard</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          {!open && (
            <span className="text-xs ml-auto">
              {stats.total} reuniões • {stats.taxaComparecimento}% comparecimento
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4 animate-fade-in">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard icon={Calendar} label="Total" value={stats.total} />
          <MetricCard icon={CheckCircle2} label="Realizadas" value={stats.realizadas} color="text-green-600" />
          <MetricCard icon={XCircle} label="No-show" value={stats.noShow} color="text-destructive" />
          <MetricCard icon={Users} label="Comparecimento" value={`${stats.taxaComparecimento}%`} color="text-green-600" />
          <MetricCard icon={XCircle} label="Taxa No-show" value={`${stats.taxaNoShow}%`} color="text-destructive" />
          <MetricCard icon={TrendingUp} label="Conversão" value={`${stats.taxaConversao}%`} color="text-blue-600" />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Status Distribution */}
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Distribuição por Status</h4>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <PieChart>
                  <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {stats.statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {stats.statusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Por Tipo */}
          {stats.tiposData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Por Tipo de Reunião</h4>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={stats.tiposData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-muted">
          <Icon className={cn("h-4 w-4", color || "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-lg font-bold", color)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
