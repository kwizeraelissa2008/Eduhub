import { Bot, Send, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { streamChat, type Msg } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";

export default function AITutor() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const initialPrompt = (location.state as any)?.initialPrompt;
  const preselectedTopic = searchParams.get("topic");

  const [topicId, setTopicId] = useState(preselectedTopic || "");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your AI tutor. Ask me anything — I can reference your uploaded materials and lessons for personalized help. 📚" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const hasAutoSent = useRef(false);

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("learning_topics").select("id, title").eq("user_id", user!.id).order("title");
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialPrompt && !hasAutoSent.current) {
      hasAutoSent.current = true;
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length === updated.length + 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: updated,
        topicId: topicId || undefined,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        onError: (err) => {
          toast({ title: "AI Error", description: err, variant: "destructive" });
          setIsLoading(false);
        },
      });
    } catch {
      toast({ title: "Connection error", description: "Could not reach AI tutor.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold font-serif text-foreground">AI Tutor</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={topicId} onValueChange={setTopicId}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="General chat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              {topics.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setMessages([{ role: "assistant", content: "Chat cleared! How can I help? 📚" }])} className="text-muted-foreground">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              ) : msg.content}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground animate-pulse">Thinking...</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-border">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)} placeholder="Ask about your materials..." className="flex-1" disabled={isLoading} />
        <Button onClick={() => sendMessage(input)} size="icon" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
