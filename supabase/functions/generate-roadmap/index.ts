import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

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

    const { topic_id } = await req.json();
    if (!topic_id) throw new Error("topic_id required");

    const { data: topic } = await supabase.from("learning_topics").select("*").eq("id", topic_id).single();
    if (!topic) throw new Error("Topic not found");

    // Get uploaded context
    const { data: files } = await supabase
      .from("uploaded_files")
      .select("extracted_text")
      .eq("topic_id", topic_id)
      .eq("status", "processed")
      .limit(5);

    const fileContext = (files || []).filter((f: any) => f.extracted_text).map((f: any) => f.extracted_text.slice(0, 1500)).join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a learning path designer." },
          { role: "user", content: `Create a structured learning roadmap for: "${topic.title}"${topic.description ? ` (${topic.description})` : ""}.

${fileContext ? `Reference material:\n${fileContext}\n\n` : ""}

Create a 4-week roadmap with milestones.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_roadmap",
            description: "Create learning roadmap",
            parameters: {
              type: "object",
              properties: {
                weeks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      week: { type: "integer" },
                      title: { type: "string" },
                      goal: { type: "string" },
                      tasks: { type: "array", items: { type: "string" } },
                      milestone: { type: "string" },
                    },
                    required: ["week", "title", "goal", "tasks", "milestone"],
                  },
                },
                summary: { type: "string" },
              },
              required: ["weeks", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_roadmap" } },
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
    let roadmap: any;

    if (toolCall) {
      roadmap = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "{}";
      const m = content.match(/\{[\s\S]*\}/);
      roadmap = m ? JSON.parse(m[0]) : { weeks: [], summary: "" };
    }

    // Save roadmap to topic
    await supabase.from("learning_topics").update({ roadmap }).eq("id", topic_id);

    return new Response(JSON.stringify({ roadmap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-roadmap error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
