import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Upload as UploadIcon, FileText, Image, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Uploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("learning_topics").select("id, title").eq("user_id", user!.id).order("title");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["uploaded-files", user?.id, selectedTopic],
    queryFn: async () => {
      let query = supabase.from("uploaded_files").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (selectedTopic !== "all") query = query.eq("topic_id", selectedTopic);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const uploadFiles = useCallback(async (fileList: FileList) => {
    if (!user || fileList.length === 0) return;
    if (topics.length === 0) {
      toast({ title: "Create a topic first", description: "Go to My Learning to create a topic before uploading.", variant: "destructive" });
      return;
    }
    const topicId = selectedTopic !== "all" ? selectedTopic : topics[0]?.id;
    if (!topicId) return;

    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        if (file.size > 20 * 1024 * 1024) {
          toast({ title: "File too large", description: `${file.name} exceeds 20MB limit.`, variant: "destructive" });
          continue;
        }

        const storagePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("user-uploads").upload(storagePath, file);
        if (uploadErr) throw uploadErr;

        const { data: fileRecord, error: insertErr } = await supabase.from("uploaded_files").insert({
          user_id: user.id,
          topic_id: topicId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          status: "processing",
        }).select().single();
        if (insertErr) throw insertErr;

        // Trigger processing
        supabase.functions.invoke("process-document", { body: { file_id: fileRecord.id } }).then(({ error }) => {
          if (error) console.error("Processing error:", error);
          queryClient.invalidateQueries({ queryKey: ["uploaded-files"] });
        });
      }

      toast({ title: "Files uploaded!", description: "Processing will complete shortly." });
      queryClient.invalidateQueries({ queryKey: ["uploaded-files"] });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [user, topics, selectedTopic, toast, queryClient]);

  const deleteFile = async (id: string, path: string) => {
    await supabase.storage.from("user-uploads").remove([path]);
    await supabase.from("uploaded_files").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["uploaded-files"] });
    toast({ title: "File deleted" });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const statusIcon = (status: string) => {
    if (status === "processed") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === "processing") return <Clock className="h-4 w-4 text-yellow-600 animate-spin" />;
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const fileIcon = (type: string) => {
    if (type.includes("image")) return <Image className="h-5 w-5 text-primary" />;
    return <FileText className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Uploads</h1>
          <p className="mt-1 text-sm text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        </div>
        <Select value={selectedTopic} onValueChange={setSelectedTopic}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {topics.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
      >
        <UploadIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-3">Drag & drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground mb-4">PDF, TXT, DOCX, images · Max 20MB</p>
        <input
          type="file"
          id="file-input"
          className="hidden"
          multiple
          accept=".pdf,.txt,.md,.docx,.doc,.png,.jpg,.jpeg,.webp"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <Button variant="outline" disabled={uploading || topics.length === 0} onClick={() => document.getElementById("file-input")?.click()}>
          {uploading ? "Uploading..." : "Browse Files"}
        </Button>
        {topics.length === 0 && <p className="text-xs text-destructive mt-2">Create a learning topic first</p>}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 group">
              {fileIcon(f.file_type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                <p className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(1)} KB</p>
              </div>
              <div className="flex items-center gap-2">
                {statusIcon(f.status)}
                <span className="text-xs text-muted-foreground capitalize">{f.status}</span>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => deleteFile(f.id, f.storage_path)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
