import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Basic in-memory rate limiter (windowed counter)
const RL_WINDOW_MS = Number(Deno.env.get('RL_WINDOW_MS') ?? 60000);
const RL_MAX = Number(Deno.env.get('RL_MAX') ?? 120);
const rlStore = new Map<string, { count: number; resetAt: number }>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Build per-request CORS headers from allowed origins
  const origin = req.headers.get('origin') ?? '*';
  const allowedList = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const isAllowed = allowedList.length === 0 ? true : allowedList.includes(origin);
  const reqId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
    'X-Request-Id': reqId,
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit check (IP-based)
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim())
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown';
  const now = Date.now();
  const entry = rlStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rlStore.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
  } else if (entry.count >= RL_MAX) {
    const retry = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
    return new Response(
      JSON.stringify({ error: 'Too many requests', details: { ip, windowMs: RL_WINDOW_MS, max: RL_MAX } }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retry) } }
    );
  } else {
    entry.count++;
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let rpcSlug = slug;

    if (req.method === 'POST') {
      const body = await req.json();
      rpcSlug = body.slug ?? slug;
    }

    if (!rpcSlug) {
      return new Response(
        JSON.stringify({ error: 'Missing slug parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase.rpc('get_public_prompt_by_slug', { _slug: rpcSlug });

    if (error) {
      console.error('RPC error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch public prompt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Prompt not found or not active/expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ prompt: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in public-prompts function:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});