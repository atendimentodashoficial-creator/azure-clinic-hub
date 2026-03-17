import { Building2 } from "lucide-react";
import TarefasClientesTab from "@/components/tarefas/TarefasClientesTab";
import { NovoClienteDialog } from "@/components/tarefas/NovoClienteDialog";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { toast } from "sonner";

export default function TarefasClientesPage() {
  const { criarCliente } = useTarefasClientes();

  const handleCriar = (data: any) => {
    criarCliente.mutate(data, {
      onSuccess: () => toast.success("Cliente criado!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Clientes
          </h1>
          <p className="text-muted-foreground">Gerencie os clientes vinculados às tarefas</p>
        </div>
        <NovoClienteDialog onSubmit={handleCriar} />
      </div>
      <TarefasClientesTab />
    </div>
  );
}
