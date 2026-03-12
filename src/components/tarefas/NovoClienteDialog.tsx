import { useState } from "react";
import { TarefaCliente } from "@/hooks/useTarefasClientes";
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
import { Plus, Instagram, Link, Globe, MessageSquare } from "lucide-react";

interface NovoClienteDialogProps {
  onSubmit: (data: any) => void;
  clienteEditando?: TarefaCliente | null;
  onClose?: () => void;
  /** If true, dialog open state is controlled externally */
  externalOpen?: boolean;
  /** Hide the trigger button (used when opened externally) */
  hideTrigger?: boolean;
}

export function NovoClienteDialog({ onSubmit, clienteEditando, onClose, externalOpen, hideTrigger }: NovoClienteDialogProps) {
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
  const detectDocTipo = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 11) return "cpf";
    return "cnpj";
  };
  const [docTipo, setDocTipo] = useState<"cpf" | "cnpj">(clienteEditando?.cnpj ? detectDocTipo(clienteEditando.cnpj) : "cnpj");
  const [site, setSite] = useState(clienteEditando?.site || "");
  const [instagramUrl, setInstagramUrl] = useState(clienteEditando?.instagram || "");
  const [linktree, setLinktree] = useState(clienteEditando?.linktree || "");
  const [googleMeuNegocio, setGoogleMeuNegocio] = useState(clienteEditando?.google_meu_negocio || "");
  const [observacoes, setObservacoes] = useState(clienteEditando?.observacoes || "");
  const [grupoWhatsapp, setGrupoWhatsapp] = useState(clienteEditando?.grupo_whatsapp || "");
  const [tipo, setTipo] = useState(clienteEditando?.tipo || "interno");

  const resetForm = () => {
    setNome(""); setEmail(""); setSenhaAcesso(""); setTelefone(""); setCountryCode("55"); setEmpresa("");
    setCnpj(""); setDocTipo("cnpj"); setSite(""); setInstagramUrl(""); setLinktree(""); setGoogleMeuNegocio("");
    setObservacoes(""); setGrupoWhatsapp(""); setTipo("interno"); setFormTab("info");
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const handleDocChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    setCnpj(docTipo === "cnpj" ? formatCnpj(digits) : formatCpf(digits));
  };

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (tipo === "interno" && !email.trim()) { toast.error("Email é obrigatório para clientes internos"); return; }
    if (!isEditing && tipo === "interno" && !senhaAcesso.trim()) { toast.error("Senha de acesso é obrigatória"); return; }
    const normalizedPhone = normalizePhone(telefone);

    onSubmit({
      ...(clienteEditando && { id: clienteEditando.id }),
      nome: nome.trim(),
      email: email.trim(),
      senha_acesso: senhaAcesso.trim() || undefined,
      telefone: normalizedPhone ? `${countryCode}${normalizedPhone}` : null,
      empresa: empresa.trim() || null,
      cnpj: cnpj.trim() || null,
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

  const isOpen = externalOpen !== undefined ? externalOpen : (isEditing ? true : open);
  const onOpenChange = externalOpen !== undefined ? (v: boolean) => { if (!v) { resetForm(); onClose?.(); } } : (isEditing ? () => onClose?.() : handleOpenChange);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {!isEditing && !hideTrigger && (
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{docTipo === "cnpj" ? "CNPJ" : "CPF"}</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => { setDocTipo(docTipo === "cnpj" ? "cpf" : "cnpj"); setCnpj(""); }}
                  >
                    Usar {docTipo === "cnpj" ? "CPF" : "CNPJ"}
                  </button>
                </div>
                <Input
                  value={cnpj}
                  onChange={e => handleDocChange(e.target.value)}
                  placeholder={docTipo === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                />
              </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEditing ? "Salvar" : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
