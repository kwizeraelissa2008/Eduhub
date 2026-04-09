import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Map as MapIcon, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Roadmaps() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedTopic = searchParams.get("topic");

  const [selectedTopic, setSelectedTopic] = useState(preselectedTopic || "");
  const [generating, setGenerating] = useState(false);
  const [roadmap, setRoadmap] = useState<any>(null);

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("learning_topics").select("id, title, roadmap").eq("user_id", user!.id).order("title");
      return data || [];
    },
    enabled: !!user,
  });

  // Load existing roadmap when topic changes
  const currentTopic = topics.find((t: any) => t.id === selectedTopic);
  const displayRoadmap = roadmap || (currentTopic as any)?.roadmap;

  const generateRoadmap = async () => {
    if (!selectedTopic) { toast({ title: "Select a topic", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-roadmap", {
        body: { topic_id: selectedTopic },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRoadmap(data.roadmap);
      toast({ title: "Roadmap generated!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground flex items-center gap-2"><MapIcon className="h-6 w-6 text-primary" /> Roadmaps</h1>
        <p className="mt-1 text-sm text-muted-foreground">AI-generated learning paths for your topics</p>
      </div>

      <div className="flex gap-3">
        <Select value={selectedTopic} onValueChange={(v) => { setSelectedTopic(v); setRoadmap(null); }}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={generateRoadmap} disabled={generating || !selectedTopic} className="gap-2">
          {generating ? "Generating..." : displayRoadmap ? "Regenerate" : "Generate Roadmap"}
        </Button>
      </div>

      {displayRoadmap?.weeks && (
        <div className="space-y-4">
          {displayRoadmap.summary && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-foreground">{displayRoadmap.summary}</p>
            </div>
          )}

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
            {displayRoadmap.weeks.map((week: any, i: number) => (
              <div key={i} className="relative pl-14 pb-8">
                <div className="absolute left-4 top-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">{week.week}</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <h3 className="font-semibold text-foreground">{week.title}</h3>
                  <p className="text-sm text-muted-foreground">{week.goal}</p>
                  <ul className="space-y-1.5">
                    {week.tasks?.map((task: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-foreground">{task}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-primary">🎯 Milestone: {week.milestone}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!displayRoadmap && selectedTopic && !generating && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MapIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Click "Generate Roadmap" to create a personalized learning path.</p>
        </div>
      )}
    </div>
  );
}
