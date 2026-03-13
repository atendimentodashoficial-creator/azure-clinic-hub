import { useMemo, useState, useEffect } from "react";
import { Video, Calendar, Clock, Bell, CalendarClock, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReuniaoDetalhesDialog } from "@/components/reunioes/ReuniaoDetalhesDialog";
import { EscalaMembrosTab } from "@/components/reunioes/EscalaMembrosTab";
import { AvisosReuniaoTab } from "@/components/reunioes/AvisosReuniaoTab";

interface Reuniao {
  id: string;
  titulo: string;
  data_reuniao: string;
  duracao_minutos: number | null;
  participantes: string[] | null;
  status: string;
  meet_link: string | null;
  cliente_telefone: string | null;
  profissional_id: string | null;
  profissionais?: { nome: string } | null;
  leads?: { nome: string; telefone: string } | null;
  transcricao: string | null;
  resumo_ia: string | null;
  google_event_id: string | null;
  fireflies_id: string | null;
  created_at: string;
  cliente_id: string | null;
}

export default function FuncionarioReunioes() {
  const { user } = useAuth();
  const { membro, isLoading: membroLoading } = useMembroAtual();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("reunioes");
  const [selectedReuniao, setSelectedReuniao] = useState<Reuniao | null>(null);

  // Find the profissional linked to this funcionário (by email match)
  const { data: profissional } = useQuery({
    queryKey: ["funcionario-profissional", membro?.email],
    queryFn: async () => {
      if (!membro?.email) return null;
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome")
        .eq("email", membro.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!membro?.email,
  });

  // Fetch reuniões for this profissional or by name in participantes
  const { data: reunioes, isLoading } = useQuery({
    queryKey: ["funcionario-reunioes", profissional?.id, membro?.nome],
    queryFn: async () => {
      if (!profissional?.id && !membro?.nome) return [];
      
      if (profissional?.id) {
        // Primary: match by profissional_id
        const { data, error } = await supabase
          .from("reunioes" as any)
          .select("*, profissionais(nome), leads:cliente_id(nome, telefone)")
          .eq("profissional_id", profissional.id)
          .or("google_event_id.not.is.null,status.eq.agendado")
          .order("data_reuniao", { ascending: false });
        if (error) throw error;
        return (data || []) as unknown as Reuniao[];
      }
      
      // Fallback: match by name in participantes array
      const { data, error } = await supabase
        .from("reunioes" as any)
        .select("*, profissionais(nome), leads:cliente_id(nome, telefone)")
        .contains("participantes", [membro!.nome])
        .or("google_event_id.not.is.null,status.eq.agendado")
        .order("data_reuniao", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Reuniao[];
    },
    enabled: !!profissional?.id || !!membro?.nome,
  });

  const getClienteNome = (reuniao: Reuniao) => {
    if (reuniao.leads?.nome) return reuniao.leads.nome;
    if (reuniao.participantes && reuniao.participantes.length > 0) {
      return reuniao.participantes.join(", ");
    }
    return "Cliente não informado";
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
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
      <div className="flex items-center gap-2">
        <Video className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Reuniões</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="reunioes" className="gap-1.5 text-xs px-3 h-7">
            <Video className="h-3.5 w-3.5" />
            Reuniões
          </TabsTrigger>
          <TabsTrigger value="escala" className="gap-1.5 text-xs px-3 h-7">
            <CalendarClock className="h-3.5 w-3.5" />
            Minha Escala
          </TabsTrigger>
          <TabsTrigger value="avisos" className="gap-1.5 text-xs px-3 h-7">
            <Bell className="h-3.5 w-3.5" />
            Avisos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reunioes" className="space-y-6 mt-6">
          {!profissional && (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                Seu perfil de profissional não foi encontrado. Peça ao administrador para vincular seu email ao cadastro de profissionais.
              </p>
            </Card>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-4">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : reunioes && reunioes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reunioes.map((reuniao) => (
                <Card
                  key={reuniao.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedReuniao(reuniao)}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      {getStatusBadge(reuniao.status)}
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(reuniao.duracao_minutos)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm line-clamp-1">
                        {reuniao.titulo || "Reunião"}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground line-clamp-1">
                          {getClienteNome(reuniao)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseISO(reuniao.data_reuniao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : profissional ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhuma reunião encontrada</p>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="escala" className="mt-6">
          <EscalaMembrosTab membroIdFixo={membro.id} />
        </TabsContent>

        <TabsContent value="avisos" className="mt-6">
          <AvisosReuniaoTab />
        </TabsContent>
      </Tabs>

      {selectedReuniao && (
        <ReuniaoDetalhesDialog
          reuniao={selectedReuniao}
          open={!!selectedReuniao}
          onOpenChange={(open) => !open && setSelectedReuniao(null)}
        />
      )}
    </div>
  );
}
