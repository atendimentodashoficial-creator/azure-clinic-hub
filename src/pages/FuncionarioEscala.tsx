import { useMembroAtual } from "@/hooks/useMembroAtual";
import { EscalaMembrosTab } from "@/components/reunioes/EscalaMembrosTab";
import { Skeleton } from "@/components/ui/skeleton";

export default function FuncionarioEscala() {
  const { membro, isLoading } = useMembroAtual();

  if (isLoading) {
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minha Escala</h1>
        <p className="text-muted-foreground">Gerencie seus horários de trabalho</p>
      </div>
      <EscalaMembrosTab membroIdFixo={membro.id} />
    </div>
  );
}
