import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, User, Video, ArrowLeft, Calendar, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { TarefaCliente } from "@/hooks/useTarefasClientes";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

// Shared type for meeting member (can be admin or team member)
export interface MeetingMember {
  id: string;
  nome: string;
  cargo?: string | null;
  isAdmin?: boolean;
}

// --- Step: Select Client ---
interface SelectClientStepProps {
  busca: string;
  onBuscaChange: (v: string) => void;
  filtrados: TarefaCliente[];
  saving: boolean;
  requerReuniao: boolean;
  onSelectClient: (c: TarefaCliente) => void;
  onNovoCliente: () => void;
}

export function SelectClientStep({
  busca, onBuscaChange, filtrados, saving, requerReuniao, onSelectClient, onNovoCliente,
}: SelectClientStepProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => onBuscaChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onNovoCliente}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      <ScrollArea className="flex-1 max-h-[50vh]">
        {filtrados.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
            <Button variant="link" size="sm" onClick={onNovoCliente}>Cadastrar novo cliente</Button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtrados.map(cliente => (
              <button
                key={cliente.id}
                disabled={saving}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                  "hover:bg-accent/50 transition-colors",
                  "disabled:opacity-50"
                )}
                onClick={() => onSelectClient(cliente)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[cliente.email, cliente.telefone].filter(Boolean).join(" • ") || "Sem contato"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// --- Step: Select Member (team members + admin) ---
interface SelectMemberStepProps {
  onSelect: (m: MeetingMember) => void;
  onBack: () => void;
  clienteNome: string;
}

export function SelectMemberStep({ onSelect, onBack, clienteNome }: SelectMemberStepProps) {
  const { user } = useAuth();
  const { membros, isLoading } = useTarefasMembros();
  const [busca, setBusca] = useState("");

  // Build list: admin first, then team members
  const allMembers: MeetingMember[] = useMemo(() => {
    const list: MeetingMember[] = [];

    // Add admin (current user)
    if (user) {
      list.push({
        id: user.id,
        nome: user.user_metadata?.full_name || user.email || "Administrador",
        cargo: "Administrador",
        isAdmin: true,
      });
    }

    // Add team members
    for (const m of membros) {
      list.push({
        id: m.id,
        nome: m.nome,
        cargo: m.cargo,
        isAdmin: false,
      });
    }

    return list;
  }, [user, membros]);

  const filtrados = allMembers.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.cargo?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <p className="text-sm text-muted-foreground">
        Selecione quem será o responsável pela reunião com <strong className="text-foreground">{clienteNome}</strong>
      </p>

      {allMembers.length > 3 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
      )}

      <ScrollArea className="flex-1 max-h-[50vh]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtrados.map(member => (
              <button
                key={member.id}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                  "hover:bg-accent/50 transition-colors"
                )}
                onClick={() => onSelect(member)}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  member.isAdmin ? "bg-primary/20" : "bg-primary/10"
                )}>
                  {member.isAdmin ? (
                    <Shield className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{member.nome}</p>
                  {member.cargo && (
                    <p className="text-xs text-muted-foreground truncate">{member.cargo}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// --- Step: Schedule Meeting ---
interface ScheduleMeetingStepProps {
  member: MeetingMember;
  clienteNome: string;
  templateNome: string;
  saving: boolean;
  onBack: () => void;
  onConfirm: (data: { titulo: string; dataHora: string; duracao: number; memberNome: string }) => void;
}

export function ScheduleMeetingStep({
  member, clienteNome, templateNome, saving, onBack, onConfirm,
}: ScheduleMeetingStepProps) {
  const [reuniaoTitulo, setReuniaoTitulo] = useState(`Reunião - ${clienteNome} - ${templateNome}`);
  const [reuniaoDuracao, setReuniaDuracao] = useState("60");
  const [reuniaoData, setReuniaoData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reuniaoHora, setReuniaoHora] = useState("08:00");

  const handleConfirm = () => {
    if (!reuniaoData || !reuniaoHora) return;
    const dataHora = new Date(`${reuniaoData}T${reuniaoHora}:00`).toISOString();
    onConfirm({
      titulo: reuniaoTitulo.trim() || `Reunião - ${clienteNome}`,
      dataHora,
      duracao: parseInt(reuniaoDuracao) || 60,
      memberNome: member.nome,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 self-start" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {member.isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
        <span>Responsável: <strong className="text-foreground">{member.nome}</strong></span>
      </div>

      <div className="space-y-2">
        <Label>Título da Reunião</Label>
        <Input value={reuniaoTitulo} onChange={e => setReuniaoTitulo(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input
            type="date"
            value={reuniaoData}
            onChange={e => setReuniaoData(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
          />
        </div>
        <div className="space-y-2">
          <Label>Hora *</Label>
          <Input
            type="time"
            value={reuniaoHora}
            onChange={e => setReuniaoHora(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Duração (minutos)</Label>
        <Input
          type="number"
          value={reuniaoDuracao}
          onChange={e => setReuniaDuracao(e.target.value)}
          min={15}
          step={15}
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t mt-auto">
        <Button variant="outline" onClick={onBack} disabled={saving}>Voltar</Button>
        <Button
          onClick={handleConfirm}
          disabled={saving || !reuniaoData || !reuniaoHora}
          className="gap-1.5"
        >
          <Video className="h-4 w-4" />
          {saving ? "Salvando..." : "Atribuir e Agendar"}
        </Button>
      </div>
    </div>
  );
}
