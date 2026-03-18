import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Wallet, Clock, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FuncionarioFinanceiro() {
  const { user } = useAuth();
  const { membro } = useMembroAtual();
  const { ownerId } = useOwnerId();
  const now = new Date();
  const periodoOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i);
      options.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  const [periodoSelecionado, setPeriodoSelecionado] = useState(format(now, "yyyy-MM"));

  const mesAtual = useMemo(() => {
    const [y, m] = periodoSelecionado.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }, [periodoSelecionado]);

  const inicio = format(startOfMonth(mesAtual), "yyyy-MM-dd");
  const fim = format(endOfMonth(mesAtual), "yyyy-MM-dd");

  const { data: comissoes = [], isLoading } = useQuery({
    queryKey: ["funcionario-comissoes", ownerId, membro?.nome, inicio, fim],
    queryFn: async () => {
      if (!ownerId || !membro?.nome) return [];
      const { data, error } = await supabase
        .from("comissoes")
        .select("*, tarefa:tarefas(titulo)")
        .eq("user_id", ownerId)
        .eq("membro_nome", membro.nome)
        .gte("created_at", `${inicio}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!ownerId && !!membro?.nome,
  });

  const salario = membro?.salario || 0;
  const aprovadas = comissoes.filter((c: any) => c.status === "aprovada");
  const pendentes = comissoes.filter((c: any) => c.status === "pendente");
  const rejeitadas = comissoes.filter((c: any) => c.status === "rejeitada");
  const totalComissoes = aprovadas.reduce((s: number, c: any) => s + c.valor, 0);
  const totalPendente = pendentes.reduce((s: number, c: any) => s + c.valor, 0);
  const totalGeral = salario + totalComissoes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Financeiro
          </h1>
          <p className="text-muted-foreground">Acompanhe seu salário e comissões</p>
        </div>

        <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
          <SelectTrigger className="w-[200px]">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodoOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="capitalize">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Salário Fixo</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {salario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Comissões Aprovadas</p>
          <p className="text-2xl font-bold text-green-500">
            R$ {totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Comissões Pendentes</p>
          <p className="text-2xl font-bold text-amber-500">
            R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-sm text-muted-foreground">Total do Mês</p>
          <p className="text-2xl font-bold text-primary">
            R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Salário + comissões aprovadas</p>
        </Card>
      </div>

      {/* Commissions list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Comissões do mês</h2>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : comissoes.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhuma comissão neste período.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {comissoes.map((c: any) => (
              <Card key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.tarefa?.titulo || "Tarefa removida"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">
                    R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <Badge
                    variant={c.status === "aprovada" ? "default" : c.status === "rejeitada" ? "destructive" : "secondary"}
                    className="text-xs gap-1"
                  >
                    {c.status === "pendente" && <Clock className="h-3 w-3" />}
                    {c.status === "aprovada" && <CheckCircle2 className="h-3 w-3" />}
                    {c.status === "rejeitada" && <XCircle className="h-3 w-3" />}
                    {c.status === "pendente" ? "Pendente" : c.status === "aprovada" ? "Aprovada" : "Rejeitada"}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
