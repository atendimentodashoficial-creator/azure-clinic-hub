import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, ExternalLink, Clock, CalendarDays, ArrowLeft, Grid3X3, FileText, Link2, Image, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteTarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  data_limite: string | null;
  approval_status: string | null;
  approval_token: string | null;
  created_at: string;
  updated_at: string;
  coluna_nome: string;
  coluna_cor: string;
  tipo_tarefa_nome: string | null;
  responsavel_nome: string | null;
}

export default function ClienteTarefas() {
  const { user } = useAuth();
  const [selectedTarefa, setSelectedTarefa] = useState<ClienteTarefa | null>(null);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["cliente-tarefas", user?.id],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data: clienteData } = await supabase
        .from("tarefas_clientes")
        .select("id")
        .eq("email", user.email)
        .limit(1)
        .single();

      if (!clienteData) return [];

      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id, titulo, descricao, prioridade, data_limite, approval_status, approval_token,
          created_at, updated_at, responsavel_nome,
          tarefas_colunas!inner(nome, cor),
          tipos_tarefas(nome)
        `)
        .eq("cliente_id", clienteData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        prioridade: t.prioridade,
        data_limite: t.data_limite,
        approval_status: t.approval_status,
        approval_token: t.approval_token,
        created_at: t.created_at,
        updated_at: t.updated_at,
        coluna_nome: t.tarefas_colunas?.nome || "—",
        coluna_cor: t.tarefas_colunas?.cor || "#6b7280",
        tipo_tarefa_nome: t.tipos_tarefas?.nome || null,
        responsavel_nome: t.responsavel_nome,
      })) as ClienteTarefa[];
    },
    enabled: !!user?.email,
  });

  const etapaLabel = (coluna: string) => {
    const map: Record<string, string> = {
      "A Fazer": "Na fila",
      "Em Progresso": "Em produção",
      "Aguardando Aprovação": "Aguardando sua aprovação",
      "Em Revisão": "Em revisão",
      "Concluído": "Concluído",
    };
    return map[coluna] || coluna;
  };

  const approvalLabel = (status: string | null) => {
    if (status === "concluido") return { text: "Aprovado", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    if (status === "em_revisao") return { text: "Mudanças solicitadas", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
    return null;
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  if (selectedTarefa) {
    return <TarefaDetalheView tarefa={selectedTarefa} onBack={() => setSelectedTarefa(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
        <p className="text-muted-foreground">Acompanhe o progresso das suas entregas</p>
      </div>

      {tarefas.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tarefas.map((t) => {
            const approval = approvalLabel(t.approval_status);
            return (
              <Card
                key={t.id}
                className="p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setSelectedTarefa(t)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{t.titulo}</h3>
                    {t.tipo_tarefa_nome && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.tipo_tarefa_nome}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-[11px] font-medium border"
                    style={{
                      backgroundColor: `${t.coluna_cor}15`,
                      color: t.coluna_cor,
                      borderColor: `${t.coluna_cor}40`,
                    }}
                  >
                    {etapaLabel(t.coluna_nome)}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  {t.responsavel_nome && <span>👤 {t.responsavel_nome}</span>}
                  {t.data_limite && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(t.data_limite), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Atualizado {format(new Date(t.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {approval && (
                    <Badge variant="outline" className={cn("text-[10px]", approval.color)}>
                      {approval.text}
                    </Badge>
                  )}
                  {t.approval_token && t.coluna_nome === "Aguardando Aprovação" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/aprovacao/${t.approval_token}`, "_blank");
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Revisar entrega
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Detail View ─── */

function TarefaDetalheView({ tarefa, onBack }: { tarefa: ClienteTarefa; onBack: () => void }) {
  const { data: gridPosts = [] } = useQuery({
    queryKey: ["cliente-grid", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_grid_posts")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("posicao");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: highlights = [] } = useQuery({
    queryKey: ["cliente-highlights", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_grid_highlights")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mockups = [] } = useQuery({
    queryKey: ["cliente-mockups", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_mockups")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("post_index")
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["cliente-links", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_links")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
  });

  const hasGrid = gridPosts.length > 0;
  const hasHighlights = highlights.length > 0;
  const hasMockups = mockups.length > 0;
  const hasLinks = links.length > 0;
  const hasDeliverables = hasGrid || hasHighlights || hasMockups || hasLinks;

  // Build available tabs
  const tabs: { id: string; label: string; icon: React.ReactNode }[] = [];
  if (hasGrid) tabs.push({ id: "grid", label: "Grade", icon: <Grid3X3 className="h-4 w-4" /> });
  if (hasHighlights) tabs.push({ id: "highlights", label: "Destaques", icon: <Layers className="h-4 w-4" /> });
  if (hasMockups) tabs.push({ id: "mockups", label: "Mockups", icon: <FileText className="h-4 w-4" /> });
  if (hasLinks) tabs.push({ id: "links", label: "Links", icon: <Link2 className="h-4 w-4" /> });

  const defaultTab = tabs[0]?.id || "info";

  const etapaLabel = (coluna: string) => {
    const map: Record<string, string> = {
      "A Fazer": "Na fila",
      "Em Progresso": "Em produção",
      "Aguardando Aprovação": "Aguardando sua aprovação",
      "Em Revisão": "Em revisão",
      "Concluído": "Concluído",
    };
    return map[coluna] || coluna;
  };

  const statusBadge = (status: string) => {
    if (status === "aprovado") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Aprovado</Badge>;
    if (status === "reprovado") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">Reprovado</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
  };

  // Group mockups by post_index
  const mockupsByPost = mockups.reduce<Record<number, typeof mockups>>((acc, m) => {
    if (!acc[m.post_index]) acc[m.post_index] = [];
    acc[m.post_index].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{tarefa.titulo}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-xs font-medium"
            style={{
              backgroundColor: `${tarefa.coluna_cor}15`,
              color: tarefa.coluna_cor,
              borderColor: `${tarefa.coluna_cor}40`,
            }}
          >
            {etapaLabel(tarefa.coluna_nome)}
          </Badge>
          {tarefa.tipo_tarefa_nome && (
            <Badge variant="secondary" className="text-xs">{tarefa.tipo_tarefa_nome}</Badge>
          )}
          {tarefa.responsavel_nome && (
            <span className="text-xs text-muted-foreground">👤 {tarefa.responsavel_nome}</span>
          )}
          {tarefa.data_limite && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(new Date(tarefa.data_limite), "dd MMM yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
        {tarefa.descricao && (
          <p className="text-sm text-muted-foreground mt-3">{tarefa.descricao}</p>
        )}
      </div>

      {tarefa.approval_token && tarefa.coluna_nome === "Aguardando Aprovação" && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Entrega disponível para aprovação</p>
              <p className="text-xs text-muted-foreground mt-0.5">Revise os itens e aprove ou solicite alterações</p>
            </div>
            <Button size="sm" className="gap-1.5" asChild>
              <a href={`/aprovacao/${tarefa.approval_token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
                Revisar entrega
              </a>
            </Button>
          </div>
        </Card>
      )}

      {!hasDeliverables ? (
        <Card className="p-8 text-center">
          <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum conteúdo entregue ainda para esta tarefa.</p>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full justify-start">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {hasGrid && (
            <TabsContent value="grid" className="mt-4">
              <div className="grid grid-cols-3 gap-1 max-w-md">
                {gridPosts.map((post: any) => (
                  <div key={post.id} className="relative aspect-square bg-muted rounded overflow-hidden group">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1">{statusBadge(post.status)}</div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {hasHighlights && (
            <TabsContent value="highlights" className="mt-4">
              <div className="flex gap-4 overflow-x-auto pb-2">
                {highlights.map((h: any) => (
                  <div key={h.id} className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30">
                      <img src={h.image_url} alt={h.titulo} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs text-muted-foreground max-w-[70px] truncate text-center">{h.titulo}</span>
                    {statusBadge(h.status)}
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {hasMockups && (
            <TabsContent value="mockups" className="mt-4 space-y-6">
              {Object.entries(mockupsByPost).map(([postIdx, slides]) => (
                <Card key={postIdx} className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Post {Number(postIdx) + 1}</h4>
                  <div className="space-y-3">
                    {slides.map((slide: any, i: number) => (
                      <div key={slide.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            {slides.length > 1 ? `Slide ${i + 1}` : "Conteúdo"}
                          </span>
                          {statusBadge(slide.status)}
                        </div>
                        {slide.titulo && <p className="text-sm font-semibold text-foreground">{slide.titulo}</p>}
                        {slide.subtitulo && <p className="text-xs text-muted-foreground">{slide.subtitulo}</p>}
                        {slide.legenda && <p className="text-sm text-foreground whitespace-pre-wrap">{slide.legenda}</p>}
                        {slide.cta && (
                          <blockquote className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 italic">
                            {slide.cta}
                          </blockquote>
                        )}
                        {slide.feedback && (
                          <div className="text-xs p-2 bg-amber-500/10 rounded text-amber-700">
                            💬 {slide.feedback}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </TabsContent>
          )}

          {hasLinks && (
            <TabsContent value="links" className="mt-4 space-y-2">
              {links.map((link: any) => (
                <Card key={link.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{link.titulo || link.url}</p>
                    {link.titulo && <p className="text-xs text-muted-foreground truncate">{link.url}</p>}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" />
                      Abrir
                    </a>
                  </Button>
                </Card>
              ))}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
