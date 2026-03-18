import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Loader2, Plus, Trash2, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface RAGDocument {
  id: string;
  content: string;
  metadata: any;
  created_at: string;
}

export function DisparosRAGConfig() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents" as any)
        .select("id, content, metadata, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments((data as any) || []);
    } catch (err: any) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !newContent.trim()) {
      toast.error("Preencha o conteúdo do documento");
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
          metadata: { title: newTitle.trim() || undefined },
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
    if (!deleteId || !user) return;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
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
            Adicione informações à base de conhecimento da I.A. Os textos serão convertidos automaticamente em vetores para busca semântica.
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Título (opcional)</Label>
              <Input
                placeholder="Ex: Horários de funcionamento"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Conteúdo</Label>
              <Textarea
                placeholder="Digite ou cole aqui as informações que a I.A. deve saber..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={6}
              />
            </div>

            <Button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
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
              Documentos ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  {doc.metadata?.title && (
                    <p className="text-sm font-medium truncate">{doc.metadata.title}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">
                    {doc.content}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(doc.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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
