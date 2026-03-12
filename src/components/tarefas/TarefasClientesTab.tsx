import { useState } from "react";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountryCodeSelect } from "@/components/whatsapp/CountryCodeSelect";
import { extractCountryCode, formatPhoneByCountry, getPhonePlaceholder, normalizePhone, stripCountryCode } from "@/utils/phoneFormat";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Instagram, Link, Globe, MessageSquare, Mail, Phone, Building2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function NovoClienteDialog({ onSubmit, clienteEditando, onClose }: {
  onSubmit: (data: any) => void;
  clienteEditando?: TarefaCliente | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEditing = !!clienteEditando;
  const [formTab, setFormTab] = useState("info");

  const initialPhoneData = clienteEditando?.telefone
    ? extractCountryCode(clienteEditando.telefone)
    : { countryCode: "55", phoneWithoutCountry: "" };

  const [nome, setNome] = useState(clienteEditando?.nome || "");
  const [email, setEmail] = useState(clienteEditando?.email || "");
  const [senhaAcesso, setSenhaAcesso] = useState(clienteEditando?.senha_acesso || "");
  const [countryCode, setCountryCode] = useState(initialPhoneData.countryCode);
  const [telefone, setTelefone] = useState(initialPhoneData.phoneWithoutCountry);
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
    setNome(""); setEmail(""); setSenhaAcesso(""); setTelefone(""); setCountryCode("55"); setEmpresa("");
    setCnpj(""); setSite(""); setInstagramUrl(""); setLinktree(""); setGoogleMeuNegocio("");
    setObservacoes(""); setGrupoWhatsapp(""); setTipo("interno"); setFormTab("info");
  };

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!email.trim()) { toast.error("Email é obrigatório"); return; }
    if (!isEditing && tipo === "interno" && !senhaAcesso.trim()) { toast.error("Senha de acesso é obrigatória"); return; }
    const normalizedPhone = normalizePhone(telefone);

    onSubmit({
      ...(clienteEditando && { id: clienteEditando.id }),
      nome: nome.trim(),
      email: email.trim(),
      senha_acesso: senhaAcesso.trim() || undefined,
      telefone: normalizedPhone ? `${countryCode}${normalizedPhone}` : null,
      empresa: empresa.trim() || null,
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
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <p className="text-sm text-muted-foreground">Preencha as informações do cliente. O email é obrigatório para que o cliente possa acessar o sistema.</p>
        </DialogHeader>
        <Tabs value={formTab} onValueChange={setFormTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="info" className="flex-1">Informações Gerais</TabsTrigger>
            <TabsTrigger value="redes" className="flex-1">Redes Sociais</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto pr-1">
            <TabsContent value="info" className="space-y-4 mt-4">
              <div>
                <Label className="mb-2">Tipo de Cliente *</Label>
                <RadioGroup value={tipo} onValueChange={setTipo} className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="interno" id="tipo-interno" />
                    <label htmlFor="tipo-interno" className="text-sm cursor-pointer">Cliente Interno</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="preview" id="tipo-preview" />
                    <label htmlFor="tipo-preview" className="text-sm cursor-pointer">Cliente Preview</label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <CountryCodeSelect
                  value={countryCode}
                  onChange={setCountryCode}
                  phoneValue={formatPhoneByCountry(telefone, countryCode)}
                  onPhoneChange={(val) => setTelefone(stripCountryCode(val, countryCode))}
                  placeholder={getPhonePlaceholder(countryCode)}
                />
              </div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vantero.co@gmail.com" /></div>
              {tipo === "interno" && (
                <div className="space-y-2">
                  <Label>Senha de Acesso {!isEditing && "*"}</Label>
                  <Input type="password" value={senhaAcesso} onChange={e => setSenhaAcesso(e.target.value)} placeholder="••••••" />
                </div>
              )}
              <div className="space-y-2"><Label>Empresa</Label><Input value={empresa} onChange={e => setEmpresa(e.target.value)} /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> Grupo WhatsApp</Label>
                <Input value={grupoWhatsapp} onChange={e => setGrupoWhatsapp(e.target.value)} placeholder="XXXXXXXXXXXX@g.us" />
              </div>
            </TabsContent>
            <TabsContent value="redes" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Site</Label><Input value={site} onChange={e => setSite(e.target.value)} placeholder="https://www.exemplo.com.br" /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Instagram className="h-4 w-4" /> Instagram</Label>
                <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/seu-usuario" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Link className="h-4 w-4" /> Linktree</Label>
                <Input value={linktree} onChange={e => setLinktree(e.target.value)} placeholder="https://linktr.ee/seu-usuario" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Globe className="h-4 w-4" /> Google Meu Negócio</Label>
                <Input value={googleMeuNegocio} onChange={e => setGoogleMeuNegocio(e.target.value)} placeholder="https://g.page/seu-negocio" />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex justify-end gap-2 pt-2 shrink-0">
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
  const [subTab, setSubTab] = useState("interno");

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
                        <Phone className="h-3.5 w-3.5 shrink-0" /> {cliente.telefone}
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
