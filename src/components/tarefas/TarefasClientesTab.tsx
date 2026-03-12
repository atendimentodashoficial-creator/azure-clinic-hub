import { useState } from "react";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, MoreVertical, Trash2, Edit, Building2, Instagram, Link, Globe, MessageSquare } from "lucide-react";

function NovoClienteDialog({ onSubmit, clienteEditando, onClose }: {
  onSubmit: (data: any) => void;
  clienteEditando?: TarefaCliente | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEditing = !!clienteEditando;
  const [formTab, setFormTab] = useState("info");

  const [nome, setNome] = useState(clienteEditando?.nome || "");
  const [email, setEmail] = useState(clienteEditando?.email || "");
  const [senhaAcesso, setSenhaAcesso] = useState(clienteEditando?.senha_acesso || "");
  const [telefone, setTelefone] = useState(clienteEditando?.telefone || "");
  const [empresa, setEmpresa] = useState(clienteEditando?.empresa || "");
  const [cnpj, setCnpj] = useState(clienteEditando?.cnpj || "");
  const [site, setSite] = useState(clienteEditando?.site || "");
  const [instagramUrl, setInstagramUrl] = useState(clienteEditando?.instagram || "");
  const [linktree, setLinktree] = useState(clienteEditando?.linktree || "");
  const [googleMeuNegocio, setGoogleMeuNegocio] = useState(clienteEditando?.google_meu_negocio || "");
  const [observacoes, setObservacoes] = useState(clienteEditando?.observacoes || "");
  const [grupoWhatsapp, setGrupoWhatsapp] = useState(clienteEditando?.grupo_whatsapp || "");
  const [tipo, setTipo] = useState(clienteEditando?.tipo || "interno");

  const resetForm = () => {
    setNome(""); setEmail(""); setSenhaAcesso(""); setTelefone(""); setEmpresa("");
    setCnpj(""); setSite(""); setInstagramUrl(""); setLinktree(""); setGoogleMeuNegocio("");
    setObservacoes(""); setGrupoWhatsapp(""); setTipo("interno"); setFormTab("info");
  };

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!email.trim()) { toast.error("Email é obrigatório"); return; }
    if (!isEditing && !senhaAcesso.trim()) { toast.error("Senha de acesso é obrigatória"); return; }
    onSubmit({
      ...(clienteEditando && { id: clienteEditando.id }),
      nome: nome.trim(),
      email: email.trim(),
      senha_acesso: senhaAcesso.trim() || undefined,
      telefone: telefone.trim() || null,
      empresa: empresa.trim() || null,
      cnpj: cnpj.trim() || null,
      site: site.trim() || null,
      instagram: instagramUrl.trim() || null,
      linktree: linktree.trim() || null,
      google_meu_negocio: googleMeuNegocio.trim() || null,
      observacoes: observacoes.trim() || null,
      grupo_whatsapp: grupoWhatsapp.trim() || null,
      tipo,
    });
    resetForm();
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { resetForm(); onClose?.(); }
  };

  return (
    <Dialog open={isEditing ? true : open} onOpenChange={isEditing ? () => onClose?.() : handleOpenChange}>
      {!isEditing && (
        <DialogTrigger asChild>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Cliente</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <p className="text-sm text-muted-foreground">Preencha as informações do cliente. O email é obrigatório para que o cliente possa acessar o sistema.</p>
        </DialogHeader>
        <Tabs value={formTab} onValueChange={setFormTab}>
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informações Gerais</TabsTrigger>
            <TabsTrigger value="redes" className="flex-1">Redes Sociais</TabsTrigger>
          </TabsList>
          <ScrollArea className="max-h-[60vh] pr-2">
            <TabsContent value="info" className="space-y-4 mt-4">
              <div>
                <Label>Tipo de Cliente *</Label>
                <RadioGroup value={tipo} onValueChange={setTipo} className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="interno" id="tipo-interno" />
                    <label htmlFor="tipo-interno" className="text-sm cursor-pointer">Cliente Interno</label>
                    <Badge variant="secondary" className="text-xs">Contrato fechado</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="preview" id="tipo-preview" />
                    <label htmlFor="tipo-preview" className="text-sm cursor-pointer">Cliente Preview</label>
                    <Badge className="text-xs bg-amber-500/20 text-amber-400 border-0">Prospect</Badge>
                  </div>
                </RadioGroup>
                {tipo === "preview" && <p className="text-xs text-muted-foreground mt-1">Clientes Preview têm acesso apenas à landing page para apresentação</p>}
              </div>
              <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vantero.co@gmail.com" /></div>
              <div>
                <Label>Senha de Acesso {!isEditing && "*"}</Label>
                <Input type="password" value={senhaAcesso} onChange={e => setSenhaAcesso(e.target.value)} placeholder="••••••" />
                <p className="text-xs text-muted-foreground mt-1">Esta senha será usada pelo cliente para acessar a área de clientes</p>
              </div>
              <div><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999 ou +351964044402" /></div>
              <div><Label>Empresa</Label><Input value={empresa} onChange={e => setEmpresa(e.target.value)} /></div>
              <div><Label>CNPJ</Label><Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Observações</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>
              <div>
                <Label className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> Grupo WhatsApp do Cliente</Label>
                <Input value={grupoWhatsapp} onChange={e => setGrupoWhatsapp(e.target.value)} placeholder="XXXXXXXXXXXX@g.us" />
                <p className="text-xs text-muted-foreground mt-1">ID do grupo onde serão enviados os avisos deste cliente. Use o formato: XXXXX@g.us</p>
              </div>
            </TabsContent>
            <TabsContent value="redes" className="space-y-4 mt-4">
              <div>
                <Label>Site</Label>
                <Input value={site} onChange={e => setSite(e.target.value)} placeholder="https://www.exemplo.com.br" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Instagram className="h-4 w-4" /> Instagram</Label>
                <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/seu-usuario" />
                <p className="text-xs text-muted-foreground mt-1">Este link será exibido na aba Instagram do painel do cliente</p>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Link className="h-4 w-4" /> Linktree</Label>
                <Input value={linktree} onChange={e => setLinktree(e.target.value)} placeholder="https://linktr.ee/seu-usuario" />
                <p className="text-xs text-muted-foreground mt-1">Este link será exibido na aba Linktree do painel do cliente</p>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Globe className="h-4 w-4" /> Google Meu Negócio</Label>
                <Input value={googleMeuNegocio} onChange={e => setGoogleMeuNegocio(e.target.value)} placeholder="https://g.page/seu-negocio" />
                <p className="text-xs text-muted-foreground mt-1">Este link será exibido na aba Google do painel do cliente</p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEditing ? "Salvar" : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TarefasClientesTab() {
  const { clientes, isLoading, criarCliente, atualizarCliente, excluirCliente } = useTarefasClientes();
  const [editando, setEditando] = useState<TarefaCliente | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.empresa?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum cliente cadastrado
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map(cliente => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>{cliente.email}</TableCell>
                  <TableCell>{cliente.empresa || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={cliente.tipo === "interno" ? "secondary" : "outline"} className={cliente.tipo === "preview" ? "bg-amber-500/20 text-amber-400 border-0" : ""}>
                      {cliente.tipo === "interno" ? "Interno" : "Preview"}
                    </Badge>
                  </TableCell>
                  <TableCell>{cliente.telefone || "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditando(cliente)}>
                          <Edit className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExcluir(cliente.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
