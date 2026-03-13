import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Calendar, Clock, FileText, Bell, Link2, XCircle, Trash2, MessageCircle, User, Phone, CheckCircle2, CalendarClock, RefreshCw, Users } from "lucide-react";
import { formatPhoneDisplay, getLast8Digits } from "@/utils/phoneFormat";
import { navigateToChat } from "@/utils/chatRouting";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { useOwnerId } from "@/hooks/useOwnerId";
import { ReunioesPeriodFilter, useReunioesPeriodFilter } from "@/components/reunioes/ReunioesPeriodFilter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ReuniaoDetalhesDialog } from "@/components/reunioes/ReuniaoDetalhesDialog";
import { AvisosReuniaoTab } from "@/components/reunioes/AvisosReuniaoTab";
import { VincularTranscricaoDialog } from "@/components/reunioes/VincularTranscricaoDialog";
import { ReagendarReuniaoDialog } from "@/components/reunioes/ReagendarReuniaoDialog";
import { ComparecimentoDialog } from "@/components/reunioes/ComparecimentoDialog";
import { EscalaMembrosTab } from "@/components/reunioes/EscalaMembrosTab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Reuniao {
  id: string;
  user_id: string;
  drive_transcript_id: string | null;
  google_event_id: string | null;
  titulo: string;
  data_reuniao: string;
  duracao_minutos: number | null;
  participantes: string[] | null;
  transcricao: string | null;
  resumo_ia: string | null;
  meet_link: string | null;
  status: string;
  created_at: string;
  cliente_id: string | null;
  cliente_telefone: string | null;
  profissional_id: string | null;
  profissionais?: { nome: string } | null;
  leads?: { nome: string; telefone: string } | null;
}

export default function FuncionarioReunioes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { membro, isLoading: membroLoading } = useMembroAtual();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();
  const periodFilter = useReunioesPeriodFilter();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("todos");
  const [activeTab, setActiveTab] = useState("reunioes");
  const [selectedReuniao, setSelectedReuniao] = useState<Reuniao | null>(null);
  const [vincularDialogOpen, setVincularDialogOpen] = useState(false);
  const [reuniaoParaVincular, setReuniaoParaVincular] = useState<Reuniao | null>(null);
  const [reuniaoParaDesmarcar, setReuniaoParaDesmarcar] = useState<Reuniao | null>(null);
  const [reuniaoParaReagendar, setReuniaoParaReagendar] = useState<Reuniao | null>(null);
  const [reuniaoParaExcluir, setReuniaoParaExcluir] = useState<Reuniao | null>(null);
  const [comparecimentoReuniao, setComparecimentoReuniao] = useState<Reuniao | null>(null);
  const [comparecimentoTipo, setComparecimentoTipo] = useState<"compareceu" | "nao_compareceu" | null>(null);

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["funcionario-reunioes"] });
    };
    window.addEventListener("contact-name-updated", handler);
    return () => window.removeEventListener("contact-name-updated", handler);
  }, [queryClient]);

  const { data: leadNames } = useQuery({
    queryKey: ["leads", "names", user?.id],
    refetchOnMount: "always",
    queryFn: async () => {
      const allLeads: Array<{ nome: string; telefone: string }> = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("leads")
          .select("nome, telefone")
          .is("deleted_at", null)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) { hasMore = false; }
        else {
          allLeads.push(...(data as Array<{ nome: string; telefone: string }>));
          if (data.length < PAGE_SIZE) hasMore = false;
          else from += PAGE_SIZE;
        }
      }
      return allLeads;
    },
    enabled: !!user?.id,
  });

  const leadNameByLast8 = useMemo(() => {
    const map = new Map<string, string>();
    (leadNames || []).forEach((l) => {
      const key = getLast8Digits(l.telefone || "");
      if (!key) return;
      if (!map.has(key)) map.set(key, l.nome);
    });
    return map;
  }, [leadNames]);

  const getClienteNome = (reuniao: Reuniao) => {
    if (reuniao.leads?.nome) return reuniao.leads.nome;
    if (reuniao.cliente_telefone) {
      const key = getLast8Digits(reuniao.cliente_telefone);
      const nome = leadNameByLast8.get(key);
      if (nome) return nome;
    }
    if (reuniao.participantes && reuniao.participantes.length > 0) {
      return reuniao.participantes.join(", ");
    }
    return "Cliente não informado";
  };

  // Fetch all team members (via owner's workspace)
  const { data: membros = [] } = useQuery({
    queryKey: ["tarefas-membros-func", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_membros" as any)
        .select("id, nome, auth_user_id")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!ownerId,
  });

  // Fetch ALL reuniões (RLS returns owner's workspace data)
  const { data: allReunioes, isLoading } = useQuery({
    queryKey: ["funcionario-reunioes", user?.id],
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunioes" as any)
        .select("*, profissionais(nome), leads:cliente_id(nome, telefone)")
        .or("google_event_id.not.is.null,status.eq.agendado")
        .order("data_reuniao", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Reuniao[];
    },
    enabled: !!user?.id,
  });

  // Map user_id → member name
  const memberNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membros) {
      if (m.auth_user_id) map.set(m.auth_user_id, m.nome);
    }
    return map;
  }, [membros]);

  // Filter by member then by period
  const reunioes = useMemo(() => {
    if (!allReunioes) return [];
    let filtered = allReunioes;
    if (selectedMemberId === "meus") filtered = filtered.filter(r => r.user_id === user?.id);
    else if (selectedMemberId !== "todos") {
      const m = membros.find((mb: any) => mb.id === selectedMemberId);
      if (!m?.auth_user_id) return [];
      filtered = filtered.filter(r => r.user_id === m.auth_user_id);
    }
    return periodFilter.filterReunioes(filtered);
  }, [allReunioes, selectedMemberId, membros, user?.id, periodFilter]);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  };

  const desmarcarMutation = useMutation({
    mutationFn: async (reuniaoId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase.functions.invoke("google-calendar-cancel-event", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: { reuniaoId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["funcionario-reunioes"] });
      if (data?.warning) toast.warning(data.warning);
      else toast.success("Reunião desmarcada com sucesso!");
      setReuniaoParaDesmarcar(null);
    },
    onError: (error) => {
      console.error("Erro ao desmarcar:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao desmarcar reunião");
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (reuniaoId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase.functions.invoke("google-calendar-delete-event", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: { reuniaoId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionario-reunioes"] });
      toast.success("Reunião excluída com sucesso!");
      setReuniaoParaExcluir(null);
    },
    onError: (error) => {
      console.error("Erro ao excluir:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir reunião");
    },
  });

  const isWithinOneHour = (dataReuniao: string) => {
    const now = new Date();
    const reuniaoTime = new Date(dataReuniao);
    const diffMs = reuniaoTime.getTime() - now.getTime();
    return diffMs <= 60 * 60 * 1000;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "transcrito":
        return <Badge variant="secondary">Transcrito</Badge>;
      case "resumido":
        return <Badge className="bg-green-500/20 text-green-700">Resumido</Badge>;
      case "pendente":
        return <Badge variant="outline">Pendente</Badge>;
      case "cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      case "realizada":
        return <Badge className="bg-green-500/20 text-green-700">Realizada</Badge>;
      case "nao_compareceu":
        return <Badge variant="destructive">Não Compareceu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (membroLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!membro) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-muted-foreground">Seu perfil de membro não foi encontrado</p>
        <p className="text-xs text-muted-foreground">Entre em contato com o administrador</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Video className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Reuniões</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="reunioes" className="gap-1.5 text-xs px-3 h-7">
            <Video className="h-3.5 w-3.5" />
            Reuniões
          </TabsTrigger>
          <TabsTrigger value="avisos" className="gap-1.5 text-xs px-3 h-7">
            <Bell className="h-3.5 w-3.5" />
            Avisos
          </TabsTrigger>
          <TabsTrigger value="escala" className="gap-1.5 text-xs px-3 h-7">
            <CalendarClock className="h-3.5 w-3.5" />
            Minha Escala
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reunioes" className="space-y-6 mt-6">
          {/* Period filter chips */}
          <ReunioesPeriodFilter
            value={periodFilter.filterValue}
            onChange={periodFilter.setFilterValue}
            dateStart={periodFilter.customStart}
            dateEnd={periodFilter.customEnd}
            onDateStartChange={periodFilter.setCustomStart}
            onDateEndChange={periodFilter.setCustomEnd}
            count={reunioes?.length}
          />

          {/* Member selector */}
          {membros.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Filtrar por colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="meus">Minhas reuniões</SelectItem>
                  {membros.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-4">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : reunioes && reunioes.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(
                reunioes.reduce((acc, reuniao) => {
                  const dateKey = format(new Date(reuniao.data_reuniao), "yyyy-MM-dd");
                  if (!acc[dateKey]) acc[dateKey] = [];
                  acc[dateKey].push(reuniao);
                  return acc;
                }, {} as Record<string, Reuniao[]>)
              ).map(([dateKey, reunioesDodia]) => (
                <div key={dateKey} className="space-y-4">
                  <div className="bg-secondary text-secondary-foreground rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      <span className="font-semibold">
                        {format(parseISO(dateKey), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <span className="text-sm opacity-80 capitalize">
                      {format(parseISO(dateKey), "EEEE", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {reunioesDodia.map((reuniao) => (
                      <Card
                        key={reuniao.id}
                        className="shadow-card hover:shadow-elegant transition-all duration-300 animate-fade-in"
                      >
                        <CardContent className="p-4 flex-1 flex flex-col">
                          <div className="space-y-3 flex-1">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold text-base">
                                    {format(new Date(reuniao.data_reuniao), "HH:mm")}
                                  </span>
                                  {reuniao.duracao_minutos && (
                                    <span className="text-xs text-muted-foreground">
                                      ({formatDuration(reuniao.duracao_minutos)})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(reuniao.status)}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setReuniaoParaExcluir(reuniao)}
                                    title="Excluir reunião"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <h3 className="font-semibold text-lg text-foreground">
                                {getClienteNome(reuniao)}
                              </h3>
                            </div>

                            {reuniao.cliente_telefone && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{formatPhoneDisplay(reuniao.cliente_telefone)}</span>
                              </div>
                            )}

                            {reuniao.profissionais?.nome && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <User className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{reuniao.profissionais.nome}</span>
                              </div>
                            )}

                            {reuniao.titulo && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">
                                  {reuniao.titulo.replace(/^Reunião com\s+[^-–]+\s*[-–]\s*/i, "").trim() || reuniao.titulo}
                                </span>
                              </div>
                            )}

                            {reuniao.meet_link && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <a
                                  href={reuniao.meet_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate"
                                >
                                  Acessar reunião
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-border space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2"
                                onClick={() => setSelectedReuniao(reuniao)}
                              >
                                <FileText className="w-4 h-4" />
                                Ver Detalhes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2"
                                onClick={() => {
                                  setReuniaoParaVincular(reuniao);
                                  setVincularDialogOpen(true);
                                }}
                                title={reuniao.transcricao ? "Vincular outra transcrição" : "Vincular transcrição"}
                              >
                                <FileText className="w-4 h-4" />
                                {reuniao.transcricao ? "Vincular outra" : "Vincular"}
                              </Button>
                            </div>

                            {reuniao.status !== "cancelado" && reuniao.status !== "realizada" && reuniao.status !== "nao_compareceu" && isWithinOneHour(reuniao.data_reuniao) && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => {
                                    setComparecimentoReuniao(reuniao);
                                    setComparecimentoTipo("compareceu");
                                  }}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Compareceu
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1 gap-1.5"
                                  onClick={() => {
                                    setComparecimentoReuniao(reuniao);
                                    setComparecimentoTipo("nao_compareceu");
                                  }}
                                >
                                  <XCircle className="w-4 h-4" />
                                  No-show
                                </Button>
                              </div>
                            )}

                            {reuniao.status !== "cancelado" && (
                              <div className="grid grid-cols-3 gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full aspect-square p-0 flex items-center justify-center"
                                  onClick={() => setReuniaoParaReagendar(reuniao)}
                                  title="Reagendar"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                {reuniao.cliente_telefone ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full aspect-square p-0 flex items-center justify-center text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      const phone = reuniao.cliente_telefone?.replace(/\D/g, "") || "";
                                      navigateToChat(navigate, phone, "/funcionario");
                                    }}
                                    title="WhatsApp / Chat"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <div className="w-full" />
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full aspect-square p-0 flex items-center justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setReuniaoParaDesmarcar(reuniao)}
                                  title="Desmarcar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Video className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma reunião encontrada</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Suas reuniões agendadas aparecerão aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="avisos">
          <AvisosReuniaoTab />
        </TabsContent>

        <TabsContent value="escala" className="mt-6">
          <EscalaMembrosTab membroIdFixo={membro.id} />
        </TabsContent>
      </Tabs>

      <ReuniaoDetalhesDialog
        reuniao={selectedReuniao}
        open={!!selectedReuniao}
        onOpenChange={(open) => !open && setSelectedReuniao(null)}
      />

      {reuniaoParaVincular && (
        <VincularTranscricaoDialog
          open={vincularDialogOpen}
          onOpenChange={setVincularDialogOpen}
          reuniaoId={reuniaoParaVincular.id}
          reuniaoTitulo={reuniaoParaVincular.titulo}
          transcricaoAtual={reuniaoParaVincular.transcricao ? {
            transcript_id: reuniaoParaVincular.drive_transcript_id,
            transcricao: reuniaoParaVincular.transcricao,
            resumo_ia: reuniaoParaVincular.resumo_ia,
          } : null}
        />
      )}

      <ReagendarReuniaoDialog
        reuniao={reuniaoParaReagendar}
        open={!!reuniaoParaReagendar}
        onOpenChange={(open) => !open && setReuniaoParaReagendar(null)}
      />

      <AlertDialog open={!!reuniaoParaDesmarcar} onOpenChange={(open) => !open && setReuniaoParaDesmarcar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desmarcar Reunião</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desmarcar a reunião "{reuniaoParaDesmarcar?.titulo}"?
              Esta ação marcará a reunião como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => reuniaoParaDesmarcar && desmarcarMutation.mutate(reuniaoParaDesmarcar.id)}
            >
              Desmarcar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reuniaoParaExcluir} onOpenChange={(open) => !open && setReuniaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Reunião</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a reunião "{reuniaoParaExcluir?.titulo}"?
              Esta ação irá remover a reunião permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => reuniaoParaExcluir && excluirMutation.mutate(reuniaoParaExcluir.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ComparecimentoDialog
        reuniao={comparecimentoReuniao}
        tipo={comparecimentoTipo}
        open={!!comparecimentoReuniao}
        onOpenChange={(open) => {
          if (!open) {
            setComparecimentoReuniao(null);
            setComparecimentoTipo(null);
          }
        }}
      />
    </div>
  );
}
