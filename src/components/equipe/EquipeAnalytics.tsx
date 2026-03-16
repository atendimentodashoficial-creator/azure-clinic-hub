import { useMemo, useState } from "react";
import { useTarefasMembros, TarefaMembro } from "@/hooks/useTarefasMembros";
import { useTarefas, TarefaColuna } from "@/hooks/useTarefas";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  BarChart3, ChevronUp, ChevronDown, Users, CheckCircle2, Activity, CalendarDays,
  TrendingUp, Trophy,
} from "lucide-react";
import { differenceInMonths } from "date-fns";
import { useNavigate } from "react-router-dom";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const RANKING_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function EquipeAnalytics() {
  const { membros } = useTarefasMembros();
  const { tarefas, colunas } = useTarefas();
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  const colunasMap = useMemo(() => {
    const map: Record<string, TarefaColuna> = {};
    colunas.forEach(c => { map[c.id] = c; });
    return map;
  }, [colunas]);

  // Per-member task stats
  const membroStats = useMemo(() => {
    return membros.map((m: TarefaMembro) => {
      const mTarefas = tarefas.filter(t =>
        t.responsavel_nome?.split(",").map(n => n.trim()).includes(m.nome)
      );
      const concluidas = mTarefas.filter(t => colunasMap[t.coluna_id]?.nome === "Concluído").length;
      const emAndamento = mTarefas.filter(t => {
        const col = colunasMap[t.coluna_id];
        return col && col.nome !== "Concluído";
      }).length;
      const total = mTarefas.length;
      const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
      return { ...m, concluidas, emAndamento, total, taxa };
    }).sort((a, b) => b.concluidas - a.concluidas);
  }, [membros, tarefas, colunasMap]);

  // Global stats
  const globalStats = useMemo(() => {
    const totalAtivos = membros.length;
    const gerentes = membros.filter((m: TarefaMembro) => m.cargo?.toLowerCase().includes("gerente")).length;
    const colaboradores = totalAtivos - gerentes;
    const totalConcluidas = membroStats.reduce((acc, m) => acc + m.concluidas, 0);
    const totalEmAndamento = membroStats.reduce((acc, m) => acc + m.emAndamento, 0);
    const totalTarefas = membroStats.reduce((acc, m) => acc + m.total, 0);
    const taxaOcupacao = totalTarefas > 0 ? Math.round((totalEmAndamento / totalTarefas) * 100) : 0;

    // Average time in company
    const membrosComData = membros.filter((m: TarefaMembro) => m.data_contratacao);
    const avgMonths = membrosComData.length > 0
      ? Math.round(membrosComData.reduce((acc, m: TarefaMembro) => acc + differenceInMonths(new Date(), new Date(m.data_contratacao!)), 0) / membrosComData.length)
      : 0;

    return { totalAtivos, gerentes, colaboradores, totalConcluidas, totalEmAndamento, taxaOcupacao, avgMonths };
  }, [membros, membroStats]);

  // Salary summary
  const salarioStats = useMemo(() => {
    const total = membros.reduce((acc, m: TarefaMembro) => acc + (m.salario || 0), 0);
    const avg = membros.length > 0 ? total / membros.length : 0;
    return { total, avg };
  }, [membros]);

  // Pie chart: distribution by cargo
  const cargoData = useMemo(() => {
    const map: Record<string, number> = {};
    membros.forEach((m: TarefaMembro) => {
      const cargo = m.cargo || "Sem cargo";
      map[cargo] = (map[cargo] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [membros]);

  // Bar chart: top 5
  const top5Data = useMemo(() =>
    membroStats.slice(0, 5).map(m => ({ name: m.nome, concluidas: m.concluidas })),
  [membroStats]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getInitials = (nome: string) =>
    nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const formatAvgTime = (months: number) => {
    if (months < 1) return "< 1 mês";
    if (months === 1) return "1 mês";
    return `${months} meses`;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-5">
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise da Equipe
          </h3>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-5 space-y-5">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Total Ativos</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{globalStats.totalAtivos}</p>
              <p className="text-xs text-muted-foreground">{globalStats.gerentes} gerente(s) • {globalStats.colaboradores} colaborador(es)</p>
            </Card>
            <Card className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Tarefas Concluídas</span>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">{globalStats.totalConcluidas}</p>
              <p className="text-xs text-muted-foreground">pela equipe</p>
            </Card>
            <Card className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Taxa de Ocupação</span>
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary mt-1">{globalStats.taxaOcupacao}%</p>
              <p className="text-xs text-muted-foreground">{globalStats.totalEmAndamento} tarefas em andamento</p>
            </Card>
            <Card className="p-4 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Tempo Médio</span>
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary mt-1">{formatAvgTime(globalStats.avgMonths)}</p>
              <p className="text-xs text-muted-foreground">de empresa</p>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie: Distribuição por Cargo */}
            <Card className="p-4 border">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-muted-foreground" />
                Distribuição por Cargo
              </h4>
              {cargoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={cargoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {cargoData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} membro(s)`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {cargoData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {c.name}
                  </div>
                ))}
              </div>
            </Card>

            {/* Bar: Top 5 */}
            <Card className="p-4 border">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top 5 por Tarefas Concluídas
              </h4>
              {top5Data.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={top5Data} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`${value} tarefas`, "Concluídas"]} />
                    <Bar dataKey="concluidas" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
            </Card>
          </div>

          {/* Salary Summary */}
          <Card className="p-5 border">
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              Resumo Salarial
            </h4>
            <div className="flex gap-10">
              <div>
                <p className="text-xs text-muted-foreground">Total de Salários</p>
                <p className="text-2xl font-bold">{formatCurrency(salarioStats.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Média por Colaborador</p>
                <p className="text-2xl font-bold">{formatCurrency(salarioStats.avg)}</p>
              </div>
            </div>
          </Card>

          {/* Metrics Table */}
          <Card className="border overflow-hidden">
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Métricas por Colaborador
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Colaborador</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cargo</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Concluídas</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Em Andamento</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Total</th>
                    <th className="p-3 font-medium text-muted-foreground w-[140px]">Taxa</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Ranking</th>
                  </tr>
                </thead>
                <tbody>
                  {membroStats.map((m, i) => (
                    <tr
                      key={m.id}
                      className="border-b last:border-b-0 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/equipe/${m.id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.foto_url || undefined} className="object-cover" />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(m.nome)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate max-w-[160px]">{m.nome}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {m.cargo ? (
                          <Badge
                            variant={m.cargo.toLowerCase().includes("gerente") ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {m.cargo}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-semibold text-green-600">{m.concluidas}</td>
                      <td className="p-3 text-center font-semibold text-primary">{m.emAndamento}</td>
                      <td className="p-3 text-center font-medium">{m.total}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress value={m.taxa} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{m.taxa}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center text-lg">
                        {RANKING_ICONS[i + 1] || <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
