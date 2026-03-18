import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Save, RefreshCw, Workflow, Eye, EyeOff } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AgentNode {
  nodeName: string;
  nodeType: string;
  systemPrompt: string;
}

interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  agents: AgentNode[];
  tags: string[];
}

interface AgentesSDRManagerProps {
  filterTag?: string;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
}

export function AgentesSDRManager({ filterTag, emptyIcon, emptyMessage }: AgentesSDRManagerProps = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<string>>(new Set());
  // key: "workflowId::agentNodeName" -> prompt
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"por-fluxo" | "unificado">("por-fluxo");

  useEffect(() => {
    loadWorkflows();
  }, []);

  const promptKey = (wfId: string, agentName: string) => `${wfId}::${agentName}`;

  const cleanPrompt = (raw: string) => raw.replace(/\n\n### INFORMACOES ADICIONAIS[\s\S]*$/, "");

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke("n8n-manage-workflows", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "list" },
      });

      if (error) throw error;
      if (Array.isArray(data)) {
        const filtered = filterTag
          ? data.filter((wf: WorkflowSummary) => wf.tags?.some(t => t.toLowerCase() === filterTag.toLowerCase()))
          : data;
        setWorkflows(filtered);

        const prompts: Record<string, string> = {};
        for (const wf of filtered) {
          for (const agent of wf.agents) {
            prompts[promptKey(wf.id, agent.nodeName)] = cleanPrompt(agent.systemPrompt);
          }
        }
        setEditingPrompts(prompts);
      }
    } catch (err: any) {
      console.error("Error loading workflows:", err);
      toast.error("Erro ao carregar workflows do n8n");
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = (id: string) => {
    setSelectedWorkflowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedWorkflowIds.size === workflows.length) {
      setSelectedWorkflowIds(new Set());
    } else {
      setSelectedWorkflowIds(new Set(workflows.map(w => w.id)));
    }
  };

  const handleSave = async () => {
    if (selectedWorkflowIds.size === 0) {
      toast.error("Selecione pelo menos um workflow");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Build per-workflow updates
      const perWorkflowUpdates: Record<string, { nodeName: string; newPrompt: string }[]> = {};
      for (const wfId of selectedWorkflowIds) {
        const wf = workflows.find(w => w.id === wfId);
        if (!wf) continue;
        const updates = wf.agents
          .map(agent => ({
            nodeName: agent.nodeName,
            newPrompt: editingPrompts[promptKey(wfId, agent.nodeName)] || "",
          }))
          .filter(u => u.newPrompt.trim());
        if (updates.length > 0) perWorkflowUpdates[wfId] = updates;
      }

      if (Object.keys(perWorkflowUpdates).length === 0) {
        toast.error("Nenhum prompt para atualizar");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("n8n-manage-workflows", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: "update_prompts_per_workflow",
          per_workflow_updates: perWorkflowUpdates,
        },
      });

      if (error) throw error;

      if (data?.updated?.length > 0) {
        toast.success(`Atualizado em ${data.updated.length} workflow(s)!`);
      }
      if (data?.errors?.length > 0) {
        console.error("Update errors:", data.errors);
        toast.warning(`${data.errors.length} erro(s): ${data.errors[0]}`);
      }

      await loadWorkflows();
    } catch (err: any) {
      console.error("Error saving:", err);
      toast.error("Erro ao salvar prompts");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando workflows do n8n...</span>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-12">
        {emptyIcon || <Workflow className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />}
        <p className="text-muted-foreground text-sm">{emptyMessage || "Nenhum workflow com agentes encontrado no n8n"}</p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={loadWorkflows}>
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Workflow Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-5 w-5 text-primary" />
              Workflows com Agentes
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                {selectedWorkflowIds.size === workflows.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadWorkflows}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {workflows.map(wf => (
              <div
                key={wf.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedWorkflowIds.has(wf.id)
                    ? "bg-primary/5 border-primary/30"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => toggleWorkflow(wf.id)}
              >
                <Checkbox
                  checked={selectedWorkflowIds.has(wf.id)}
                  onCheckedChange={() => toggleWorkflow(wf.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{wf.name}</span>
                    <Badge variant={wf.active ? "default" : "secondary"} className="text-[10px] h-5">
                      {wf.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {wf.agents.map(agent => (
                      <Badge key={agent.nodeName} variant="outline" className="text-[10px] h-4 gap-1">
                        <Bot className="h-2.5 w-2.5" />
                        {agent.nodeName}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Editors - Per Workflow */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-primary" />
                System Prompts dos Agentes
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Veja e edite os prompts de cada workflow individualmente ({selectedWorkflowIds.size} selecionado{selectedWorkflowIds.size !== 1 ? "s" : ""})
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum agente encontrado</p>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {workflows.map(wf => (
                <AccordionItem key={wf.id} value={wf.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Workflow className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{wf.name}</span>
                      <Badge variant={wf.active ? "default" : "secondary"} className="text-[10px] h-4">
                        {wf.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {wf.agents.length} agente{wf.agents.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-4">
                    {wf.agents.map(agent => (
                      <div key={agent.nodeName} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{agent.nodeName}</span>
                          <Badge variant="outline" className="text-[9px] h-3.5">
                            {agent.nodeType.includes("agentTool") ? "Sub-agente" : "Principal"}
                          </Badge>
                        </div>
                        <Textarea
                          value={editingPrompts[promptKey(wf.id, agent.nodeName)] || ""}
                          onChange={(e) =>
                            setEditingPrompts(prev => ({
                              ...prev,
                              [promptKey(wf.id, agent.nodeName)]: e.target.value,
                            }))
                          }
                          placeholder="System prompt do agente..."
                          className="min-h-[180px] font-mono text-xs"
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || selectedWorkflowIds.size === 0}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Aplicar nos {selectedWorkflowIds.size} Workflow{selectedWorkflowIds.size !== 1 ? "s" : ""} Selecionado{selectedWorkflowIds.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
