import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Upload, Brain, Flame, Plus } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("learning_topics").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: streak } = useQuery({
    queryKey: ["streak", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("learning_streaks").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: filesCount = 0 } = useQuery({
    queryKey: ["files-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("uploaded_files").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: quizCount = 0 } = useQuery({
    queryKey: ["quiz-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("quiz_results").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name?.split(" ")[0] || "Learner";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">{greeting}, {displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your universal learning dashboard</p>
        </div>
        <Button onClick={() => navigate("/my-learning")} className="gap-2">
          <Plus className="h-4 w-4" /> New Topic
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Topics" value={topics.length} subtitle="active" />
        <StatCard label="Streak" value={streak?.current_streak ?? 0} subtitle="days" />
        <StatCard label="Uploads" value={filesCount} subtitle="files" />
        <StatCard label="Quizzes" value={quizCount} subtitle="completed" />
      </div>

      {topics.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-foreground">Recent Topics</h2>
          <div className="grid gap-3">
            {topics.slice(0, 5).map((topic: any) => (
              <div
                key={topic.id}
                onClick={() => navigate(`/topic/${topic.id}`)}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-5 cursor-pointer transition-shadow hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{topic.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">{topic.description || "No description"}</p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${topic.progress_percent}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(topic.progress_percent)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-serif font-semibold text-foreground">Start your learning journey</h2>
          <p className="text-sm text-muted-foreground">Create a topic, upload materials, and let AI generate personalized lessons.</p>
          <Button onClick={() => navigate("/my-learning")}>Create First Topic</Button>
        </div>
      )}
    </div>
  );
}
