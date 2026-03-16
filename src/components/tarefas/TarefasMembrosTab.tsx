import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTarefasMembros, TarefaMembro } from "@/hooks/useTarefasMembros";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CountryCodeSelect } from "@/components/whatsapp/CountryCodeSelect";
import { extractCountryCode, formatPhoneByCountry, getPhonePlaceholder, normalizePhone, stripCountryCode } from "@/utils/phoneFormat";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Mail, Phone, Briefcase, CalendarIcon, DollarSign, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

function NovoMembroDialog({ onSubmit, membroEditando, onClose }: {
  onSubmit: (data: any) => void;
  membroEditando?: TarefaMembro | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEditing = !!membroEditando;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialPhoneData = membroEditando?.telefone
    ? extractCountryCode(membroEditando.telefone)
    : { countryCode: "55", phoneWithoutCountry: "" };

  const [nome, setNome] = useState(membroEditando?.nome || "");
  const [email, setEmail] = useState(membroEditando?.email || "");
  const [countryCode, setCountryCode] = useState(initialPhoneData.countryCode);
  const [telefone, setTelefone] = useState(initialPhoneData.phoneWithoutCountry);
  const [cargo, setCargo] = useState(membroEditando?.cargo || "");
  const [observacoes, setObservacoes] = useState(membroEditando?.observacoes || "");
  const [senha, setSenha] = useState(membroEditando?.senha || "");
  const [salario, setSalario] = useState(membroEditando?.salario?.toString() || "");
  const [dataContratacao, setDataContratacao] = useState<Date | undefined>(
    membroEditando?.data_contratacao ? parseISO(membroEditando.data_contratacao) : undefined
  );
  const [diaPagamento, setDiaPagamento] = useState(membroEditando?.dia_pagamento?.toString() || "");
  const [fotoUrl, setFotoUrl] = useState(membroEditando?.foto_url || "");
  const [fotoPreview, setFotoPreview] = useState(membroEditando?.foto_url || "");
  const [uploading, setUploading] = useState(false);
  const [whatsappAvisoPessoal, setWhatsappAvisoPessoal] = useState(membroEditando?.whatsapp_aviso_pessoal || "");
  const [whatsappAvisoGrupo, setWhatsappAvisoGrupo] = useState(membroEditando?.whatsapp_aviso_grupo || "");

  const resetForm = () => {
    setNome(""); setEmail(""); setTelefone(""); setCountryCode("55");
    setCargo(""); setObservacoes(""); setSenha(""); setSalario("");
    setDataContratacao(undefined); setDiaPagamento("");
    setFotoUrl(""); setFotoPreview("");
    setWhatsappAvisoPessoal(""); setWhatsappAvisoGrupo("");
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setFotoPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from("membros-fotos").upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("membros-fotos").getPublicUrl(path);
      setFotoUrl(urlData.publicUrl);
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
      setFotoPreview(membroEditando?.foto_url || "");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const normalizedPhone = normalizePhone(telefone);

    onSubmit({
      ...(membroEditando && { id: membroEditando.id }),
      nome: nome.trim(),
      email: email.trim() || null,
      telefone: normalizedPhone ? `${countryCode}${normalizedPhone}` : null,
      cargo: cargo.trim() || null,
      observacoes: observacoes.trim() || null,
      senha: senha.trim() || null,
      salario: salario ? parseFloat(salario) : null,
      data_contratacao: dataContratacao ? format(dataContratacao, "yyyy-MM-dd") : null,
      dia_pagamento: diaPagamento ? parseInt(diaPagamento) : null,
      foto_url: fotoUrl || null,
      whatsapp_aviso_pessoal: whatsappAvisoPessoal.trim() || null,
      whatsapp_aviso_grupo: whatsappAvisoGrupo.trim() || null,
    });
    resetForm();
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { resetForm(); onClose?.(); }
  };

  const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits) / 100;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSalarioChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) { setSalario(""); return; }
    const num = parseInt(digits) / 100;
    setSalario(num.toString());
  };

  const diasDoMes = Array.from({ length: 31 }, (_, i) => i + 1);

  const getInitials = (n: string) => n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Dialog open={isEditing ? true : open} onOpenChange={isEditing ? () => onClose?.() : handleOpenChange}>
      {!isEditing && (
        <DialogTrigger asChild>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Membro</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Membro" : "Novo Membro"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Foto */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-20 w-20">
                {fotoPreview ? (
                  <AvatarImage src={fotoPreview} alt="Foto" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {nome ? getInitials(nome) : <Camera className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
            <span className="text-xs text-muted-foreground">{uploading ? "Enviando..." : "Clique para adicionar foto"}</span>
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
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div className="space-y-2"><Label>Senha</Label><Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••" /></div>
          <div className="space-y-2"><Label>Cargo / Função</Label><Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Designer, Gestor de Tráfego..." /></div>
          <div className="space-y-2">
            <Label>Salário</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                className="pl-10"
                value={salario ? formatCurrency((parseFloat(salario) * 100).toFixed(0)) : ""}
                onChange={e => handleSalarioChange(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data de Contratação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dataContratacao && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataContratacao ? format(dataContratacao, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataContratacao}
                  onSelect={setDataContratacao}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Dia do Pagamento</Label>
            <Select value={diaPagamento} onValueChange={setDiaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar dia" />
              </SelectTrigger>
              <SelectContent>
                {diasDoMes.map(d => (
                  <SelectItem key={d} value={d.toString()}>Dia {d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>

          {/* WhatsApp Avisos */}
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Contatos para Avisos de Tarefas</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Preencha o número pessoal e/ou do grupo para receber notificações sobre tarefas via WhatsApp.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">WhatsApp Pessoal</Label>
              <Input
                value={whatsappAvisoPessoal}
                onChange={e => setWhatsappAvisoPessoal(e.target.value)}
                placeholder="5521999999999"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">WhatsApp do Grupo</Label>
              <Input
                value={whatsappAvisoGrupo}
                onChange={e => setWhatsappAvisoGrupo(e.target.value)}
                placeholder="ID do grupo ou JID"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={uploading}>{isEditing ? "Salvar" : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TarefasMembrosTab() {
  const { membros, isLoading, criarMembro, atualizarMembro, excluirMembro } = useTarefasMembros();
  const [editando, setEditando] = useState<TarefaMembro | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = membros.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.cargo?.toLowerCase().includes(busca.toLowerCase()) ||
    m.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleCriar = (data: any) => {
    criarMembro.mutate(data, {
      onSuccess: () => toast.success("Membro adicionado!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleAtualizar = (data: any) => {
    const { id, ...rest } = data;
    atualizarMembro.mutate({ id, ...rest }, {
      onSuccess: () => { toast.success("Membro atualizado!"); setEditando(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleExcluir = (id: string) => {
    excluirMembro.mutate(id, {
      onSuccess: () => toast.success("Membro removido"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const getInitials = (nome: string) => nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const getFormattedPhone = (phone: string | null) => {
    if (!phone) return null;
    const { countryCode, phoneWithoutCountry } = extractCountryCode(phone);
    const formatted = formatPhoneByCountry(phoneWithoutCountry, countryCode);
    return formatted ? `+${countryCode} ${formatted}` : `+${countryCode} ${phoneWithoutCountry}`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input placeholder="Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
        <NovoMembroDialog onSubmit={handleCriar} />
      </div>

      {editando && (
        <NovoMembroDialog
          membroEditando={editando}
          onSubmit={handleAtualizar}
          onClose={() => setEditando(null)}
        />
      )}

      {filtrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhum membro da equipe cadastrado
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map(membro => (
            <Card key={membro.id} className="p-4 flex flex-col gap-3 relative h-full">
              {/* Actions top-right */}
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(membro)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleExcluir(membro.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Avatar + Name centered */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                  {membro.foto_url ? (
                    <AvatarImage src={membro.foto_url} alt={membro.nome} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-base font-medium">
                    {getInitials(membro.nome)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm text-center leading-tight">{membro.nome}</p>
                {membro.cargo && (
                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-md px-2 py-0.5">
                    <Briefcase className="h-3 w-3" /> {membro.cargo}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3 flex-1">
                {membro.email && (
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {membro.email}
                  </p>
                )}
                {membro.telefone && (
                  <p className="flex items-center gap-2 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {getFormattedPhone(membro.telefone)}
                  </p>
                )}
                {membro.data_contratacao && (
                  <p className="flex items-center gap-2 truncate">
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" /> Na empresa desde {format(parseISO(membro.data_contratacao), "dd/MM/yyyy")}
                  </p>
                )}
              </div>

              {/* Salary */}
              {membro.salario != null && (
                <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-md px-2 py-1 font-medium text-xs w-fit mt-auto">
                  Salário: R$ {membro.salario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
