import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, topic_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let contextBlock = "";

    // If topic_id provided, fetch user's knowledge context
    if (topic_id) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get topic
          const { data: topic } = await supabase.from("learning_topics").select("title, description").eq("id", topic_id).single();
          
          // Get lessons
          const { data: lessons } = await supabase
            .from("generated_lessons")
            .select("title, content")
            .eq("topic_id", topic_id)
            .order("lesson_order")
            .limit(5);

          // Get uploaded file text
          const { data: files } = await supabase
            .from("uploaded_files")
            .select("file_name, extracted_text")
            .eq("topic_id", topic_id)
            .eq("status", "processed")
            .limit(5);

          const parts: string[] = [];
          if (topic) parts.push(`Topic: ${topic.title}\nDescription: ${topic.description || "N/A"}`);
          if (lessons?.length) parts.push("Lessons:\n" + lessons.map((l: any) => `- ${l.title}: ${l.content.slice(0, 500)}`).join("\n"));
          if (files?.length) {
            const fileTexts = files.filter((f: any) => f.extracted_text).map((f: any) => `[${f.file_name}]: ${f.extracted_text.slice(0, 1500)}`);
            if (fileTexts.length) parts.push("Uploaded materials:\n" + fileTexts.join("\n\n"));
          }
          if (parts.length) contextBlock = "\n\nUser's knowledge base:\n" + parts.join("\n\n");
        }
      }
    }

    const systemPrompt = `You are an AI Tutor — a warm, knowledgeable, and encouraging educational assistant. You help learners with:
- Explaining concepts clearly with examples
- Study techniques and learning strategies
- Career guidance in tech, science, and professional development
- Breaking down complex topics into simple steps
- Answering questions about their uploaded materials and lessons
- Motivating learners and celebrating their progress

Keep responses concise but helpful. Use emojis sparingly for warmth. Format with markdown when it helps clarity.${contextBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
