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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { file_id } = await req.json();
    if (!file_id) throw new Error("file_id required");

    // Get file record
    const { data: fileRecord, error: frErr } = await supabaseUser
      .from("uploaded_files")
      .select("*")
      .eq("id", file_id)
      .single();

    if (frErr || !fileRecord) throw new Error("File not found");

    // Download file from storage
    const { data: fileData, error: dlErr } = await supabaseAdmin
      .storage
      .from("user-uploads")
      .download(fileRecord.storage_path);

    if (dlErr || !fileData) throw new Error("Failed to download file");

    let extractedText = "";

    const fileType = fileRecord.file_type.toLowerCase();

    if (fileType.includes("text") || fileRecord.file_name.endsWith(".txt") || fileRecord.file_name.endsWith(".md")) {
      extractedText = await fileData.text();
    } else if (fileType.includes("pdf") || fileRecord.file_name.endsWith(".pdf")) {
      // For PDFs, extract raw text using basic parsing
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      extractedText = extractTextFromPdfBytes(bytes);
      if (!extractedText.trim()) {
        extractedText = "[PDF content detected but text extraction was limited. The AI tutor can still assist based on the topic and other materials.]";
      }
    } else if (fileType.includes("image")) {
      // Use AI to describe the image
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(await fileData.arrayBuffer())));
        const mimeType = fileType.includes("png") ? "image/png" : "image/jpeg";
        
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Extract all text and describe the key information in this image in detail. If it contains diagrams, equations, or notes, transcribe them." },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          extractedText = aiData.choices?.[0]?.message?.content || "[Image uploaded]";
        }
      } else {
        extractedText = "[Image uploaded - visual content]";
      }
    } else {
      // Try as text
      try {
        extractedText = await fileData.text();
      } catch {
        extractedText = `[File uploaded: ${fileRecord.file_name}]`;
      }
    }

    // Truncate if too long
    if (extractedText.length > 50000) {
      extractedText = extractedText.slice(0, 50000) + "\n\n[Content truncated]";
    }

    // Update file record
    await supabaseUser.from("uploaded_files").update({
      extracted_text: extractedText,
      status: "processed",
    }).eq("id", file_id);

    return new Response(JSON.stringify({ success: true, text_length: extractedText.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractTextFromPdfBytes(bytes: Uint8Array): string {
  // Simple PDF text extraction - looks for text between BT and ET markers
  const text = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];
  
  // Extract strings in parentheses within BT/ET blocks
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    const strRegex = /\(([^)]*)\)/g;
    let sm;
    while ((sm = strRegex.exec(block)) !== null) {
      const decoded = sm[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()])/g, "$1");
      if (decoded.trim()) textParts.push(decoded);
    }
  }
  
  return textParts.join(" ").replace(/\s+/g, " ").trim();
}
