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

    const { topic_id, topic_title, topic_description, num_lessons } = await req.json();
    if (!topic_id || !topic_title) throw new Error("topic_id and topic_title required");

    // Fetch uploaded files for context
    const { data: files } = await supabase
      .from("uploaded_files")
      .select("file_name, extracted_text")
      .eq("topic_id", topic_id)
      .eq("status", "processed")
      .limit(10);

    const contextText = (files || [])
      .filter((f: any) => f.extracted_text)
      .map((f: any) => `[From ${f.file_name}]:\n${f.extracted_text.slice(0, 3000)}`)
      .join("\n\n---\n\n");

    const lessonCount = num_lessons || 5;

    const prompt = `You are an expert curriculum designer. Generate exactly ${lessonCount} structured lessons for the topic: "${topic_title}"${topic_description ? `. Description: ${topic_description}` : ""}.

${contextText ? `Use the following uploaded reference material as primary source:\n\n${contextText}\n\n` : ""}

Return a JSON array of lesson objects. Each lesson must have:
- "title": string (lesson title)
- "content": string (comprehensive lesson content in Markdown, 400-800 words, with headers, examples, key concepts, and practice suggestions)
- "lesson_order": number (1-based)

Respond ONLY with the JSON array, no other text.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a curriculum designer. Return ONLY valid JSON arrays." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_lessons",
            description: "Create structured lessons",
            parameters: {
              type: "object",
              properties: {
                lessons: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      content: { type: "string" },
                      lesson_order: { type: "integer" },
                    },
                    required: ["title", "content", "lesson_order"],
                  },
                },
              },
              required: ["lessons"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_lessons" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let lessons: any[];

    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      lessons = parsed.lessons;
    } else {
      // Fallback: parse from content
      const content = aiData.choices?.[0]?.message?.content || "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      lessons = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    // Insert lessons into DB
    const lessonRows = lessons.map((l: any) => ({
      user_id: user.id,
      topic_id,
      title: l.title,
      content: l.content,
      lesson_order: l.lesson_order,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("generated_lessons")
      .insert(lessonRows)
      .select();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ lessons: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lessons error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
