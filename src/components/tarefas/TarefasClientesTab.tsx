import { useState } from "react";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractCountryCode, formatPhoneByCountry } from "@/utils/phoneFormat";
import { toast } from "sonner";
import { Trash2, Edit, Mail, Phone, Building2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NovoClienteDialog } from "@/components/tarefas/NovoClienteDialog";
import { supabase } from "@/integrations/supabase/client";

export default function TarefasClientesTab() {
  const { clientes, isLoading, criarCliente, atualizarCliente, excluirCliente } = useTarefasClientes();
  const [editando, setEditando] = useState<TarefaCliente | null>(null);
  const [busca, setBusca] = useState("");
  const [subTab, setSubTab] = useState("interno");

  const filtrados = clientes.filter(c =>
    (c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.empresa?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())) &&
    c.tipo === subTab
  );

  const createOrUpdateAuthUser = async (data: any, existingCliente?: TarefaCliente | null) => {
    if (data.tipo !== "interno" || !data.email || !data.senha_acesso) return;

    const isNewAuth = !existingCliente?.senha_acesso || existingCliente?.email !== data.email;

    try {
      if (isNewAuth) {
        // Create new auth user with 'cliente' role
        const { data: result, error } = await supabase.functions.invoke("create-team-member-auth", {
          body: { action: "create", email: data.email, password: data.senha_acesso, fullName: data.nome, role: "cliente" },
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
      } else if (existingCliente) {
        // Just update password if email didn't change
        // We need the auth user id - look it up or just skip if no password change
        // For simplicity, we don't update password on edit unless we track auth_user_id
      }
    } catch (err: any) {
      console.error("Erro ao criar login do cliente:", err);
      toast.error(`Erro ao criar login: ${err.message}`);
      throw err;
    }
  };

  const handleCriar = async (data: any) => {
    try {
      if (data.tipo === "interno" && data.email && data.senha_acesso) {
        await createOrUpdateAuthUser(data);
      }
      criarCliente.mutate(data, {
        onSuccess: () => toast.success("Cliente criado!"),
        onError: (e: any) => toast.error(e.message),
      });
    } catch {
      // Auth creation failed, don't create the client record
    }
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
                <Card key={cliente.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {getInitials(cliente.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{cliente.nome}</p>
                        {cliente.empresa && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <Building2 className="h-3 w-3 shrink-0" /> {cliente.empresa}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditando(cliente)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleExcluir(cliente.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {cliente.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" /> {cliente.email}
                      </p>
                    )}
                    {cliente.telefone && (
                      <p className="flex items-center gap-2 truncate">
                        <Phone className="h-3.5 w-3.5 shrink-0" /> {getFormattedPhone(cliente.telefone)}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
