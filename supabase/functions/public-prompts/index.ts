// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let slug: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        slug = body?.slug ?? null;
      } catch {
        slug = null;
      }
    } else {
      slug = url.searchParams.get("slug");
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ error: { status: 400, message: "Missing slug" } }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data, error } = await supabase.rpc("get_public_prompt_by_slug", { _slug: slug });

    if (error) {
      return new Response(
        JSON.stringify({ error: { status: 500, message: error.message } }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return new Response(
        JSON.stringify({ error: { status: 404, message: "Prompt not found or not public" } }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Supabase rpc returns array for RETURNS TABLE; normalize
    const row = Array.isArray(data) ? data[0] : data;

    return new Response(JSON.stringify({ prompt: row }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: { status: 500, message: e?.message ?? "Unexpected error" } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});