import { useState } from "react";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractCountryCode, formatPhoneByCountry } from "@/utils/phoneFormat";
import { toast } from "sonner";
import { Trash2, Edit, Mail, Phone, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NovoClienteDialog } from "@/components/tarefas/NovoClienteDialog";
import { ClienteTarefasDialog } from "@/components/tarefas/ClienteTarefasDialog";

export default function TarefasClientesTab() {
  const { clientes, isLoading, criarCliente, atualizarCliente, excluirCliente } = useTarefasClientes();
  const [editando, setEditando] = useState<TarefaCliente | null>(null);
  const [busca, setBusca] = useState("");
  const [subTab, setSubTab] = useState("interno");
  const [clienteDetalhe, setClienteDetalhe] = useState<TarefaCliente | null>(null);

  const filtrados = clientes.filter(c =>
    (c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.empresa?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())) &&
    c.tipo === subTab
  );

  const handleCriar = (data: any) => {
    criarCliente.mutate(data, {
      onSuccess: () => toast.success("Cliente criado!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleAtualizar = (data: any) => {
    const { id, ...rest } = data;
    atualizarCliente.mutate({ id, ...rest }, {
      onSuccess: () => { toast.success("Cliente atualizado!"); setEditando(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleExcluir = (id: string) => {
    excluirCliente.mutate(id, {
      onSuccess: () => toast.success("Cliente excluído"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const getInitials = (nome: string) => {
    return nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getFormattedPhone = (phone: string | null) => {
    if (!phone) return "—";

    const { countryCode, phoneWithoutCountry } = extractCountryCode(phone);
    const formattedPhone = formatPhoneByCountry(phoneWithoutCountry, countryCode);

    return formattedPhone ? `+${countryCode} ${formattedPhone}` : `+${countryCode} ${phoneWithoutCountry}`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
        <NovoClienteDialog onSubmit={handleCriar} />
      </div>

      {editando && (
        <NovoClienteDialog
          clienteEditando={editando}
          onSubmit={handleAtualizar}
          onClose={() => setEditando(null)}
        />
      )}

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="interno">Internos</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value={subTab} className="mt-4">
          {filtrados.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              Nenhum cliente {subTab === "interno" ? "interno" : "preview"} cadastrado
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtrados.map(cliente => (
                <Card key={cliente.id} className="p-5 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setClienteDetalhe(cliente)}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={cliente.foto_perfil_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {getInitials(cliente.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{cliente.nome}</p>
                        {cliente.empresa && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Building2 className="h-3 w-3 shrink-0" /> {cliente.empresa}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditando(cliente); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleExcluir(cliente.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground pl-1">
                    {cliente.email && (
                      <p className="flex items-center gap-2.5 truncate">
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground/70" /> <span className="truncate">{cliente.email}</span>
                      </p>
                    )}
                    {cliente.telefone && (
                      <p className="flex items-center gap-2.5 truncate">
                        <Phone className="h-4 w-4 shrink-0 text-muted-foreground/70" /> <span className="truncate">{getFormattedPhone(cliente.telefone)}</span>
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ClienteTarefasDialog
        cliente={clienteDetalhe}
        open={!!clienteDetalhe}
        onClose={() => setClienteDetalhe(null)}
      />
    </div>
  );
}
