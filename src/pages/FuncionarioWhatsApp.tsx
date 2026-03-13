import { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare, RefreshCw, Plus, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChatWindow } from "@/components/whatsapp/ChatWindow";
import { ChatAvatar } from "@/components/whatsapp/ChatAvatar";
import { CountryCodeSelect } from "@/components/whatsapp/CountryCodeSelect";
import { formatPhoneNumber, formatRelativeTime, truncateText, getInitials, normalizePhoneNumber, getLast8Digits, formatLastMessagePreview } from "@/utils/whatsapp";
import { formatPhoneByCountry, getPhonePlaceholder, stripCountryCode } from "@/utils/phoneFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";

export default function FuncionarioWhatsApp() {
  const { user } = useAuth();
  const { membro, isLoading: membroLoading } = useMembroAtual();
  const isMobile = useIsMobile();

  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState("");
  const [newChatCountryCode, setNewChatCountryCode] = useState("55");

  // WhatsApp config from membro
  const [configOpen, setConfigOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const hasConfig = !!(membro?.whatsapp_base_url && membro?.whatsapp_api_key);

  useEffect(() => {
    if (membro) {
      setBaseUrl(membro.whatsapp_base_url || "");
      setApiKey(membro.whatsapp_api_key || "");
      setInstanceName(membro.whatsapp_instance_name || "");
    }
  }, [membro]);

  const handleSaveConfig = async () => {
    if (!membro?.id || !baseUrl.trim() || !apiKey.trim()) {
      toast.error("URL e API Key são obrigatórios");
      return;
    }
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from("tarefas_membros" as any)
        .update({
          whatsapp_base_url: baseUrl.trim().replace(/\/+$/, ''),
          whatsapp_api_key: apiKey.trim(),
          whatsapp_instance_name: instanceName.trim() || null,
        } as any)
        .eq("id", membro.id);
      if (error) throw error;
      toast.success("Configuração salva!");
      setConfigOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Load chats using uazapi
  const loadChats = async () => {
    if (!membro?.whatsapp_base_url || !membro?.whatsapp_api_key) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-get-chats", {
        body: {
          baseUrl: membro.whatsapp_base_url,
          apiKey: membro.whatsapp_api_key,
        },
      });
      if (error) throw error;
      const chatList = data?.chats || data || [];
      setChats(Array.isArray(chatList) ? chatList : []);
      setChatsLoaded(true);
    } catch (err: any) {
      console.error("Erro ao carregar chats:", err);
      toast.error("Erro ao carregar conversas");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (hasConfig && !chatsLoaded) {
      loadChats();
    }
  }, [hasConfig]);

  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) return chats;
    const term = searchTerm.toLowerCase();
    return chats.filter(
      (c: any) =>
        (c.contact_name || "").toLowerCase().includes(term) ||
        (c.contact_number || "").includes(term)
    );
  }, [chats, searchTerm]);

  if (membroLoading) {
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

  if (!hasConfig) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          <h1 className="text-2xl font-bold">WhatsApp</h1>
        </div>
        <Card className="p-8 text-center space-y-4">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Configure sua instância WhatsApp</h2>
          <p className="text-muted-foreground text-sm">
            Para usar o WhatsApp, configure sua instância com URL e API Key.
          </p>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Settings className="h-4 w-4" />
                Configurar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL da Instância</Label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://sua-instancia.uazapi.com" />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Sua API Key" />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Instância (opcional)</Label>
                  <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="Minha instância" />
                </div>
                <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
                  {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          <h1 className="text-2xl font-bold">WhatsApp</h1>
        </div>
        <div className="flex gap-2">
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL da Instância</Label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://sua-instancia.uazapi.com" />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Sua API Key" />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Instância (opcional)</Label>
                  <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="Minha instância" />
                </div>
                <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
                  {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={loadChats} disabled={isSyncing} size="sm" variant="outline" className="gap-1">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Essa funcionalidade está em desenvolvimento. A lista de conversas e o chat serão integrados com sua instância WhatsApp.
      </div>

      {chatsLoaded && filteredChats.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
        </Card>
      )}

      {!chatsLoaded && !isSyncing && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Carregando conversas...</p>
        </Card>
      )}
    </div>
  );
}
