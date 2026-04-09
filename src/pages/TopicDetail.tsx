import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Sparkles, Upload, Bot, Brain, Map, CheckCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

export default function TopicDetail() {
  const { topicId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  const { data: topic } = useQuery({
    queryKey: ["topic", topicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_topics").select("*").eq("id", topicId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!topicId,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons", topicId],
    queryFn: async () => {
      const { data } = await supabase.from("generated_lessons").select("*").eq("topic_id", topicId!).order("lesson_order");
      return data || [];
    },
    enabled: !!topicId,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["topic-files", topicId],
    queryFn: async () => {
      const { data } = await supabase.from("uploaded_files").select("*").eq("topic_id", topicId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!topicId,
  });

  const generateLessons = async () => {
    if (!topic || !user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lessons", {
        body: { topic_id: topic.id, topic_title: topic.title, topic_description: topic.description, num_lessons: 5 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Lessons generated!", description: `${data.lessons?.length || 0} lessons created.` });
      queryClient.invalidateQueries({ queryKey: ["lessons", topicId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const toggleComplete = async (lessonId: string, current: boolean) => {
    await supabase.from("generated_lessons").update({ is_completed: !current }).eq("id", lessonId);
    queryClient.invalidateQueries({ queryKey: ["lessons", topicId] });

    // Update topic progress
    const completed = lessons.filter((l: any) => (l.id === lessonId ? !current : l.is_completed)).length;
    const pct = lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0;
    await supabase.from("learning_topics").update({ progress_percent: pct }).eq("id", topicId);
    queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
  };

  const uploadForTopic = async (fileList: FileList) => {
    if (!user || !topicId) return;
    for (const file of Array.from(fileList)) {
      if (file.size > 20 * 1024 * 1024) continue;
      const storagePath = `${user.id}/${Date.now()}_${file.name}`;
      await supabase.storage.from("user-uploads").upload(storagePath, file);
      const { data: rec } = await supabase.from("uploaded_files").insert({
        user_id: user.id, topic_id: topicId, file_name: file.name,
        file_type: file.type, file_size: file.size, storage_path: storagePath, status: "processing",
      }).select().single();
      if (rec) supabase.functions.invoke("process-document", { body: { file_id: rec.id } }).then(() => queryClient.invalidateQueries({ queryKey: ["topic-files"] }));
    }
    toast({ title: "Files uploaded!" });
    queryClient.invalidateQueries({ queryKey: ["topic-files"] });
  };

  const currentLesson = lessons.find((l: any) => l.id === activeLesson);

  if (!topic) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/my-learning")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-serif text-foreground">{topic.title}</h1>
          {topic.description && <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/ai-tutor?topic=${topicId}`)} className="gap-1"><Bot className="h-4 w-4" /> Chat</Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/quizzes?topic=${topicId}`)} className="gap-1"><Brain className="h-4 w-4" /> Quiz</Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/roadmaps?topic=${topicId}`)} className="gap-1"><Map className="h-4 w-4" /> Roadmap</Button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${topic.progress_percent}%` }} />
        </div>
        <span className="text-sm text-muted-foreground">{Math.round(topic.progress_percent)}%</span>
      </div>

      {/* Upload area */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-card">
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Upload materials</p>
          <p className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""} attached</p>
        </div>
        <input type="file" id="topic-upload" className="hidden" multiple accept=".pdf,.txt,.md,.docx,.doc,.png,.jpg,.jpeg,.webp" onChange={(e) => e.target.files && uploadForTopic(e.target.files)} />
        <Button variant="outline" size="sm" onClick={() => document.getElementById("topic-upload")?.click()}>Add Files</Button>
      </div>

      {/* Files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f: any) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs">
              <FileText className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{f.file_name}</span>
              {f.status === "processed" ? <CheckCircle className="h-3 w-3 text-green-600" /> : <span className="text-yellow-600">...</span>}
            </div>
          ))}
        </div>
      )}

      {/* Generate / Lessons */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-semibold text-foreground">Lessons ({lessons.length})</h2>
        <Button onClick={generateLessons} disabled={generating} className="gap-2">
          <Sparkles className="h-4 w-4" /> {generating ? "Generating..." : lessons.length > 0 ? "Generate More" : "Generate Lessons"}
        </Button>
      </div>

      {activeLesson && currentLesson ? (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveLesson(null)}>← Back to list</Button>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{currentLesson.title}</h3>
              <Button variant={currentLesson.is_completed ? "secondary" : "default"} size="sm" onClick={() => toggleComplete(currentLesson.id, currentLesson.is_completed)}>
                {currentLesson.is_completed ? "Completed ✓" : "Mark Complete"}
              </Button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{currentLesson.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {lessons.map((lesson: any) => (
            <div
              key={lesson.id}
              onClick={() => setActiveLesson(lesson.id)}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${lesson.is_completed ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
                {lesson.is_completed ? "✓" : lesson.lesson_order}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{lesson.title}</p>
              </div>
              {lesson.is_completed && <CheckCircle className="h-4 w-4 text-green-600" />}
            </div>
          ))}
          {lessons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No lessons yet. Click "Generate Lessons" to create AI-powered lessons.</p>
          )}
        </div>
      )}
    </div>
  );
}
