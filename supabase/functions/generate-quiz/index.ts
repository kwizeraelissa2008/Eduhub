import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { topic_id, num_questions } = await req.json();
    if (!topic_id) throw new Error("topic_id required");

    // Get topic info
    const { data: topic } = await supabase.from("learning_topics").select("title, description").eq("id", topic_id).single();
    if (!topic) throw new Error("Topic not found");

    // Get lessons for context
    const { data: lessons } = await supabase
      .from("generated_lessons")
      .select("title, content")
      .eq("topic_id", topic_id)
      .order("lesson_order");

    // Get uploaded file text
    const { data: files } = await supabase
      .from("uploaded_files")
      .select("extracted_text")
      .eq("topic_id", topic_id)
      .eq("status", "processed")
      .limit(5);

    const lessonContext = (lessons || []).map((l: any) => `${l.title}: ${l.content.slice(0, 1000)}`).join("\n\n");
    const fileContext = (files || []).filter((f: any) => f.extracted_text).map((f: any) => f.extracted_text.slice(0, 1500)).join("\n\n");

    const count = num_questions || 5;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a quiz generator. Return ONLY valid JSON via the tool." },
          { role: "user", content: `Generate ${count} multiple-choice quiz questions for the topic "${topic.title}".

Context from lessons:\n${lessonContext}\n\nContext from uploads:\n${fileContext}\n\nEach question should test understanding, not just recall.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_quiz",
            description: "Create quiz questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct_index: { type: "integer" },
                      explanation: { type: "string" },
                    },
                    required: ["question", "options", "correct_index", "explanation"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_quiz" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI error");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let questions: any[];

    if (toolCall) {
      questions = JSON.parse(toolCall.function.arguments).questions;
    } else {
      const content = aiData.choices?.[0]?.message?.content || "[]";
      const m = content.match(/\[[\s\S]*\]/);
      questions = m ? JSON.parse(m[0]) : [];
    }

    return new Response(JSON.stringify({ questions, topic_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
