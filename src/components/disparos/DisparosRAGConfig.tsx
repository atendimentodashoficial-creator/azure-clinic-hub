import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Loader2, Plus, Trash2, FileText, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface RAGDocument {
  id: number;
  content: string;
  metadata: any;
}

export function DisparosRAGConfig() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [noConfig, setNoConfig] = useState(false);

  useEffect(() => {
    if (user) loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    setLoading(true);
    setNoConfig(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("rag-embed-document", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "list" },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Configure a conexão")) {
          setNoConfig(true);
        }
        return;
      }

      setDocuments(data?.documents || []);
    } catch (err: any) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !newContent.trim() || !newTitle.trim()) {
      toast.error("Preencha o nome e o conteúdo do documento");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke("rag-embed-document", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: "insert",
          content: newContent.trim(),
          name: newTitle.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Documento adicionado e embedding gerado com sucesso!");
      setNewContent("");
      setNewTitle("");
      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao adicionar documento: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null || !user) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("rag-embed-document", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "delete", documentId: deleteId },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Documento removido");
      setDeleteId(null);
      await loadDocuments();
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getDocTitle = (doc: RAGDocument) => {
    return doc.metadata?.source || doc.content?.substring(0, 50) || "Sem título";
  };

  const getDocPreview = (doc: RAGDocument) => {
    // Remove the title line from preview if content starts with it
    const source = doc.metadata?.source;
    if (source && doc.content?.startsWith(source)) {
      return doc.content.substring(source.length).trim();
    }
    return doc.content || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (noConfig) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Configure a conexão com o Supabase externo na aba <strong>"Supabase"</strong> para usar a Base RAG.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Base de Conhecimento (RAG)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Adicione informações à base de conhecimento da I.A. Os textos serão convertidos automaticamente em vetores para busca semântica no Supabase externo.
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Nome do Documento *</Label>
              <Input
                placeholder="Ex: Dúvidas Frequentes, Preços dos serviços..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Este nome será usado no system prompt para o agente localizar o documento.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Conteúdo *</Label>
              <Textarea
                placeholder="Digite ou cole aqui as informações que a I.A. deve saber..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={6}
              />
            </div>

            <Button
              onClick={handleAdd}
              disabled={saving || !newContent.trim() || !newTitle.trim()}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Gerando embedding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar à Base
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos na Base ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getDocTitle(doc)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {getDocPreview(doc)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      ID: {doc.id}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => setDeleteId(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {documents.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Nenhum documento na base ainda.
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O documento será removido da base de conhecimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
