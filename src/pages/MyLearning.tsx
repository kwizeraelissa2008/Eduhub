import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function MyLearning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["topics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_topics")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createTopic = async () => {
    if (!title.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("learning_topics")
        .insert({ user_id: user.id, title: title.trim(), description: description.trim() || null })
        .select()
        .single();
      if (error) throw error;
      toast({ title: "Topic created!", description: "Now upload materials or generate lessons." });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      navigate(`/topic/${data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteTopic = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this topic and all its lessons?")) return;
    await supabase.from("learning_topics").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["topics"] });
    toast({ title: "Topic deleted" });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">My Learning</h1>
          <p className="mt-1 text-sm text-muted-foreground">{topics.length} topic{topics.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Topic</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Learning Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>What do you want to learn?</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Machine Learning, Organic Chemistry, Spanish" />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any specific goals or areas of focus?" rows={3} />
              </div>
              <Button onClick={createTopic} disabled={!title.trim() || creating} className="w-full">
                {creating ? "Creating..." : "Create Topic"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-serif font-semibold text-foreground">No topics yet</h2>
          <p className="text-sm text-muted-foreground">Create a topic to start learning anything you want.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {topics.map((topic: any) => (
            <div
              key={topic.id}
              onClick={() => navigate(`/topic/${topic.id}`)}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-5 cursor-pointer transition-shadow hover:shadow-md group"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{topic.title}</h3>
                <p className="text-sm text-muted-foreground truncate mt-1">{topic.description || "No description"}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {topic.status === "active" ? "Active" : "Completed"} · {Math.round(topic.progress_percent)}% progress
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${topic.progress_percent}%` }} />
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={(e) => deleteTopic(topic.id, e)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
