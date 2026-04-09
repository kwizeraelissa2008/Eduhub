import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Brain, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Question = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export default function Quizzes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedTopic = searchParams.get("topic");

  const [selectedTopic, setSelectedTopic] = useState(preselectedTopic || "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("learning_topics").select("id, title").eq("user_id", user!.id).order("title");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["quiz-history", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_results")
        .select("*, learning_topics(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const generateQuiz = async () => {
    if (!selectedTopic) { toast({ title: "Select a topic first", variant: "destructive" }); return; }
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { topic_id: selectedTopic, num_questions: 5 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuestions(data.questions || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const submitQuiz = async () => {
    if (!user || !selectedTopic) return;
    const score = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0);
    setSubmitted(true);

    await supabase.from("quiz_results").insert({
      user_id: user.id,
      topic_id: selectedTopic,
      score,
      total_questions: questions.length,
      questions: questions as any,
      answers: answers as any,
    });

    queryClient.invalidateQueries({ queryKey: ["quiz-history"] });
    toast({ title: `Score: ${score}/${questions.length}`, description: score === questions.length ? "Perfect! 🎉" : "Review the explanations below." });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-foreground flex items-center gap-2"><Brain className="h-6 w-6 text-primary" /> Quizzes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Test your knowledge with AI-generated quizzes</p>
      </div>

      <div className="flex gap-3">
        <Select value={selectedTopic} onValueChange={setSelectedTopic}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={generateQuiz} disabled={generating || !selectedTopic} className="gap-2">
          {generating ? "Generating..." : <><Brain className="h-4 w-4" /> Generate Quiz</>}
        </Button>
      </div>

      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="font-medium text-foreground">{qi + 1}. {q.question}</p>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = q.correct_index === oi;
                  let style = "border-border hover:border-primary/50";
                  if (submitted && isCorrect) style = "border-green-500 bg-green-50 dark:bg-green-950";
                  else if (submitted && selected && !isCorrect) style = "border-red-500 bg-red-50 dark:bg-red-950";
                  else if (selected) style = "border-primary bg-primary/5";

                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers({ ...answers, [qi]: oi })}
                      className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${style}`}
                    >
                      <div className="flex items-center gap-2">
                        {submitted && isCorrect && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                        {submitted && selected && !isCorrect && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {submitted && <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">{q.explanation}</p>}
            </div>
          ))}

          <div className="flex gap-3">
            {!submitted ? (
              <Button onClick={submitQuiz} disabled={Object.keys(answers).length < questions.length}>
                Submit ({Object.keys(answers).length}/{questions.length} answered)
              </Button>
            ) : (
              <Button onClick={generateQuiz} className="gap-2"><RotateCcw className="h-4 w-4" /> New Quiz</Button>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-serif font-semibold text-foreground">History</h2>
          {history.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{(r as any).learning_topics?.title || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{r.score}/{r.total_questions}</p>
                <p className="text-xs text-muted-foreground">{Math.round((r.score / r.total_questions) * 100)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
