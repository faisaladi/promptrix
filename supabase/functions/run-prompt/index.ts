import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Basic in-memory rate limiter (windowed counter)
const RL_WINDOW_MS = Number(Deno.env.get('RL_WINDOW_MS') ?? 60000);
const RL_MAX = Number(Deno.env.get('RL_MAX') ?? 60);
const rlStore = new Map<string, { count: number; resetAt: number }>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '*';
  const allowedList = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const isAllowed = allowedList.length === 0 ? true : allowedList.includes(origin);
  const reqId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim())
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown';
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
    const { promptTemplate, inputContent, additionalInstruction, model } = await req.json();
    console.log(JSON.stringify({ level: 'info', reqId, ip, origin, event: 'run-prompt.start', model }));
    
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('LOVABLE_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('AI service not configured');
    }

    // Construct the full prompt
    let fullPrompt = promptTemplate;
    
    // Replace placeholders if they exist
    if (inputContent) {
      fullPrompt = fullPrompt.replace(/\{input\}/g, inputContent);
      fullPrompt = fullPrompt.replace(/\{content\}/g, inputContent);
    }
    
    if (additionalInstruction) {
      fullPrompt += `\n\nAdditional instructions: ${additionalInstruction}`;
    }

    const OPENROUTER_URL = Deno.env.get('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    };
    const referer = Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL');
    if (referer) headers['HTTP-Referer'] = referer;
    headers['X-Title'] = 'Promptrix Run Prompt';

    const modelSlugMap: Record<string, string> = {
      'google/gemini-2.5-flash': 'google/gemini-flash-1.5',
      'google/gemini-2.5-flash-lite': 'google/gemini-flash-1.5',
      'google/gemini-2.5-pro': 'google/gemini-2.5-pro',
      'openai/gpt-5': 'openai/gpt-4o',
      'openai/gpt-5-mini': 'openai/gpt-4o-mini',
    };
    const resolvedModel = (() => {
       const candidate = model || 'openai/gpt-4o-mini';
       return modelSlugMap[candidate] || candidate;
     })();

    const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any;
      try { errorJson = JSON.parse(errorText); } catch (_) {}
      const message = errorJson?.error?.message || errorText;
      const code = errorJson?.error?.code || response.status;
      console.error(JSON.stringify({ level: 'error', reqId, ip, origin, event: 'run-prompt.provider-error', status: response.status, code, message }));
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded. Please try again later.',
            details: { provider: 'OpenRouter', status: response.status, code, message, model: resolvedModel }
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: 'Payment required. Please add credits to your workspace.',
            details: { provider: 'OpenRouter', status: response.status, code, message, model: resolvedModel }
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      return new Response(
        JSON.stringify({
          error: 'AI service error',
          details: { provider: 'OpenRouter', status: response.status, code, message, model: resolvedModel }
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    console.log(JSON.stringify({ level: 'info', reqId, ip, origin, event: 'run-prompt.success' }));

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ level: 'error', reqId, ip, origin, event: 'run-prompt.error', message: errorMessage }));
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});