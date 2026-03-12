import { useState } from "react";
import { useTarefasMembros, TarefaMembro } from "@/hooks/useTarefasMembros";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CountryCodeSelect } from "@/components/whatsapp/CountryCodeSelect";
import { extractCountryCode, formatPhoneByCountry, getPhonePlaceholder, normalizePhone, stripCountryCode } from "@/utils/phoneFormat";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Mail, Phone, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function NovoMembroDialog({ onSubmit, membroEditando, onClose }: {
  onSubmit: (data: any) => void;
  membroEditando?: TarefaMembro | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEditing = !!membroEditando;

  const initialPhoneData = membroEditando?.telefone
    ? extractCountryCode(membroEditando.telefone)
    : { countryCode: "55", phoneWithoutCountry: "" };

  const [nome, setNome] = useState(membroEditando?.nome || "");
  const [email, setEmail] = useState(membroEditando?.email || "");
  const [countryCode, setCountryCode] = useState(initialPhoneData.countryCode);
  const [telefone, setTelefone] = useState(initialPhoneData.phoneWithoutCountry);
  const [cargo, setCargo] = useState(membroEditando?.cargo || "");
  const [observacoes, setObservacoes] = useState(membroEditando?.observacoes || "");

  const resetForm = () => {
    setNome(""); setEmail(""); setTelefone(""); setCountryCode("55");
    setCargo(""); setObservacoes("");
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
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Membro</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Membro" : "Novo Membro"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
          <div className="space-y-2"><Label>Cargo / Função</Label><Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Designer, Gestor de Tráfego..." /></div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2 shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEditing ? "Salvar" : "Criar"}</Button>
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

  const getInitials = (nome: string) => {
    return nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(membro => (
            <Card key={membro.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(membro.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{membro.nome}</p>
                    {membro.cargo && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Briefcase className="h-3 w-3 shrink-0" /> {membro.cargo}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditando(membro)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleExcluir(membro.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
