import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Save, RefreshCw, Workflow, Pencil, Maximize2, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface ExpandedPrompt {
  key: string;
  label: string;
  sublabel?: string;
  source: "per" | "bulk";
}

export function AgentesSDRManager({ filterTag, emptyIcon, emptyMessage }: AgentesSDRManagerProps = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<string>>(new Set());
  const [perWorkflowPrompts, setPerWorkflowPrompts] = useState<Record<string, string>>({});
  const [bulkPrompts, setBulkPrompts] = useState<Record<string, string>>({});
  const [expandedPrompt, setExpandedPrompt] = useState<ExpandedPrompt | null>(null);

  useEffect(() => { loadWorkflows(); }, []);

  const pKey = (wfId: string, name: string) => `${wfId}::${name}`;
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
        const perWf: Record<string, string> = {};
        const bulk: Record<string, string> = {};
        for (const wf of filtered) {
          for (const agent of wf.agents) {
            const cleaned = cleanPrompt(agent.systemPrompt);
            perWf[pKey(wf.id, agent.nodeName)] = cleaned;
            if (!bulk[agent.nodeName]) bulk[agent.nodeName] = cleaned;
          }
        }
        setPerWorkflowPrompts(perWf);
        setBulkPrompts(bulk);
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedWorkflowIds(
      selectedWorkflowIds.size === workflows.length ? new Set() : new Set(workflows.map(w => w.id))
    );
  };

  const handleSavePerWorkflow = async (wfId: string) => {
    const wf = workflows.find(w => w.id === wfId);
    if (!wf) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const updates = wf.agents
        .map(a => ({ nodeName: a.nodeName, newPrompt: perWorkflowPrompts[pKey(wfId, a.nodeName)] || "" }))
        .filter(u => u.newPrompt.trim());
      const { data, error } = await supabase.functions.invoke("n8n-manage-workflows", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "update_prompts", workflow_ids: [wfId], updates },
      });
      if (error) throw error;
      if (data?.updated?.length > 0) toast.success(`Workflow "${wf.name}" atualizado!`);
      if (data?.errors?.length > 0) toast.warning(data.errors[0]);
      await loadWorkflows();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulk = async () => {
    if (selectedWorkflowIds.size === 0) { toast.error("Selecione pelo menos um workflow"); return; }
    const updates = Object.entries(bulkPrompts)
      .filter(([_, p]) => p.trim())
      .map(([nodeName, newPrompt]) => ({ nodeName, newPrompt }));
    if (updates.length === 0) { toast.error("Nenhum prompt para atualizar"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data, error } = await supabase.functions.invoke("n8n-manage-workflows", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "update_prompts", workflow_ids: Array.from(selectedWorkflowIds), updates },
      });
      if (error) throw error;
      if (data?.updated?.length > 0) toast.success(`Atualizado em ${data.updated.length} workflow(s)!`);
      if (data?.errors?.length > 0) toast.warning(`${data.errors.length} erro(s): ${data.errors[0]}`);
      await loadWorkflows();
    } catch {
      toast.error("Erro ao salvar prompts");
    } finally {
      setSaving(false);
    }
  };

  const getExpandedValue = () => {
    if (!expandedPrompt) return "";
    if (expandedPrompt.source === "bulk") return bulkPrompts[expandedPrompt.key] || "";
    return perWorkflowPrompts[expandedPrompt.key] || "";
  };

  const setExpandedValue = (val: string) => {
    if (!expandedPrompt) return;
    if (expandedPrompt.source === "bulk") {
      setBulkPrompts(prev => ({ ...prev, [expandedPrompt.key]: val }));
    } else {
      setPerWorkflowPrompts(prev => ({ ...prev, [expandedPrompt.key]: val }));
    }
  };

  const agentOrder = ["agente_principal", "agente_horarios", "remarcação", "cancelamento"];
  const sortAgents = (agents: AgentNode[]) => [...agents].sort((a, b) => {
    const aIdx = agentOrder.findIndex(n => a.nodeName.toLowerCase().includes(n.toLowerCase()));
    const bIdx = agentOrder.findIndex(n => b.nodeName.toLowerCase().includes(n.toLowerCase()));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
  const allAgentNames = Array.from(new Set(workflows.flatMap(wf => wf.agents.map(a => a.nodeName))));
  allAgentNames.sort((a, b) => {
    const aIdx = agentOrder.findIndex(n => a.toLowerCase().includes(n.toLowerCase()));
    const bIdx = agentOrder.findIndex(n => b.toLowerCase().includes(n.toLowerCase()));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

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
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Expanded Prompt Dialog */}
      <Dialog open={!!expandedPrompt} onOpenChange={(open) => !open && setExpandedPrompt(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              {expandedPrompt?.label}
            </DialogTitle>
            {expandedPrompt?.sublabel && (
              <p className="text-xs text-muted-foreground">{expandedPrompt.sublabel}</p>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <Textarea
              value={getExpandedValue()}
              onChange={(e) => setExpandedValue(e.target.value)}
              className="h-full font-mono text-sm resize-none"
              placeholder="System prompt do agente..."
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              System Prompts dos Agentes
            </CardTitle>
            <div className="flex items-center gap-2">
              {bulkMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    {selectedWorkflowIds.size === workflows.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setBulkMode(false); setSelectedWorkflowIds(new Set()); }} className="text-xs h-7 gap-1">
                    <X className="h-3 w-3" /> Cancelar
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setBulkMode(true)} className="text-xs h-7 gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Editar em Massa
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadWorkflows}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Workflows Accordion */}
          <Accordion type="multiple" className="space-y-2">
            {workflows.map(wf => (
              <AccordionItem key={wf.id} value={wf.id} className="border rounded-lg px-4">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center gap-3 text-sm font-medium w-full">
                    {bulkMode && (
                      <Checkbox
                        checked={selectedWorkflowIds.has(wf.id)}
                        onCheckedChange={(e) => { e; toggleWorkflow(wf.id); }}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      />
                    )}
                    <Workflow className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{wf.name}</span>
                    <Badge variant={wf.active ? "default" : "secondary"} className="text-[10px] h-5 shrink-0">
                      {wf.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  {sortAgents(wf.agents).map(agent => {
                    const key = pKey(wf.id, agent.nodeName);
                    return (
                      <div key={agent.nodeName} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">{agent.nodeName}</span>
                            <Badge variant="outline" className="text-[9px] h-3.5">
                              {agent.nodeType.includes("agentTool") ? "Sub-agente" : "Principal"}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Expandir editor"
                            onClick={() => setExpandedPrompt({ key, label: agent.nodeName, sublabel: wf.name, source: "per" })}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          value={perWorkflowPrompts[key] || ""}
                          onChange={(e) =>
                            setPerWorkflowPrompts(prev => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder="System prompt do agente..."
                          className="min-h-[180px] font-mono text-xs"
                        />
                      </div>
                    );
                  })}
                  <div className="flex justify-end pt-2">
                    <Button size="sm" onClick={() => handleSavePerWorkflow(wf.id)} disabled={saving} className="gap-1.5">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar este workflow
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Bulk Edit Section - only visible in bulk mode */}
          {bulkMode && (
            <div className="mt-6 pt-6 border-t space-y-4">
              <p className="text-xs text-muted-foreground">
                Edite o prompt por agente e aplique nos {selectedWorkflowIds.size} workflow{selectedWorkflowIds.size !== 1 ? "s" : ""} selecionado{selectedWorkflowIds.size !== 1 ? "s" : ""}.
              </p>
              {allAgentNames.map(agentName => {
                const selectedWithAgent = workflows.filter(
                  wf => selectedWorkflowIds.has(wf.id) && wf.agents.some(a => a.nodeName === agentName)
                ).length;
                return (
                  <div key={agentName} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{agentName}</span>
                        {selectedWithAgent > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {selectedWithAgent} workflow{selectedWithAgent !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Expandir editor"
                        onClick={() => setExpandedPrompt({ key: agentName, label: agentName, sublabel: "Edição em massa", source: "bulk" })}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={bulkPrompts[agentName] || ""}
                      onChange={(e) => setBulkPrompts(prev => ({ ...prev, [agentName]: e.target.value }))}
                      placeholder="System prompt do agente..."
                      className="min-h-[160px] font-mono text-xs"
                    />
                  </div>
                );
              })}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBulk} disabled={saving || selectedWorkflowIds.size === 0} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Aplicar nos {selectedWorkflowIds.size} Workflow{selectedWorkflowIds.size !== 1 ? "s" : ""} Selecionado{selectedWorkflowIds.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
