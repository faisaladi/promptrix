import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Basic in-memory rate limiter (windowed counter)
const RL_WINDOW_MS = Number(Deno.env.get('RL_WINDOW_MS') ?? 60000);
const RL_MAX = Number(Deno.env.get('RL_MAX') ?? 60);
const rlStore = new Map<string, { count: number; resetAt: number }>();

serve(async (req: Request) => {
  // Build per-request CORS headers from allowed origins
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId, promptId, promptVersionId, userMessage, model = 'openai/gpt-4o-mini', stream = false } = await req.json();

    let conversation;
    let messages = [];

    // If conversationId exists, fetch existing conversation and messages
    if (conversationId) {
      const { data: existingConversation, error: convError } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError) {
        console.error('Error fetching conversation:', convError);
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      conversation = existingConversation;

      // Fetch all messages in the conversation
      const { data: existingMessages } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      messages = existingMessages || [];
    } else {
      // Create or reuse a new conversation (dedup within a short time window)
      if (!promptId) {
        return new Response(JSON.stringify({ error: 'promptId required for new conversation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch prompt version
      let promptVersion;
      if (promptVersionId) {
        const { data: version } = await supabaseClient
          .from('prompt_versions')
          .select('*')
          .eq('id', promptVersionId)
          .single();
        promptVersion = version;
      } else {
        const { data: version } = await supabaseClient
          .from('prompt_versions')
          .select('*')
          .eq('prompt_id', promptId)
          .eq('is_live', true)
          .single();
        promptVersion = version;
      }

      if (!promptVersion) {
        return new Response(JSON.stringify({ error: 'Prompt version not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate title from first 50 chars of user message
      const title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');

      // Deduplicate: try to reuse a recent conversation created within last 15s
      const dedupSinceIso = new Date(Date.now() - 15_000).toISOString();
      const { data: recentConvos, error: recentErr } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('prompt_id', promptId)
        .eq('title', title)
        .gte('created_at', dedupSinceIso)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentErr) {
        console.error('Error checking recent conversations for dedup:', recentErr);
      }

      if (recentConvos && recentConvos.length > 0) {
        conversation = recentConvos[0];
      } else {
        // Create conversation with version tracking
        const { data: newConversation, error: createError } = await supabaseClient
          .from('conversations')
          .insert({
            user_id: user.id,
            prompt_id: promptId,
            prompt_version_id: promptVersion.id,
            title,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating conversation:', createError);
          return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        conversation = newConversation;
      }

      // Guard against duplicate system message insertion
      const { data: existingSystem, error: sysCheckErr } = await supabaseClient
        .from('messages')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('role', 'system')
        .limit(1);

      if (sysCheckErr) {
        console.error('Error checking system message presence:', sysCheckErr);
      }

      if (!existingSystem || existingSystem.length === 0) {
        const { error: systemMsgError } = await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            role: 'system',
            content: promptVersion.prompt_template,
            model,
          });

        if (systemMsgError) {
          console.error('Error creating system message:', systemMsgError);
        }
      }
    }

    // Save user message
    const { error: userMsgError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage,
        model,
      });

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
      return new Response(JSON.stringify({ error: 'Failed to save message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all messages again to include the new user message
    const { data: allMessages } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    // Prepare messages for AI
    const aiMessages = (allMessages || []).map(msg => ({
      role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Call AI service (OpenRouter preferred; fallback Lovable if present)
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('LOVABLE_API_KEY');
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENROUTER_URL = Deno.env.get('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    };
    const referer = Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL');
    if (referer) headers['HTTP-Referer'] = referer;
    headers['X-Title'] = 'Promptrix Chat';

    const resolvedModel = model;

    if (stream) {
      const aiResponse = await fetch(`${OPENROUTER_URL}/chat/completions`, {
        method: 'POST',
        headers: { ...headers, 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          model: resolvedModel,
          messages: aiMessages,
          stream: true,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        let errorJson: any;
        try { errorJson = JSON.parse(errorText); } catch (_) {}
        const message = errorJson?.error?.message || errorText;
        const code = errorJson?.error?.code || aiResponse.status;

        const sseError = new ReadableStream({
          start(controller) {
            const payload = { provider: 'OpenRouter', status: aiResponse.status, code, message, model: resolvedModel };
            controller.enqueue(new TextEncoder().encode(`event: error\ndata: ${JSON.stringify(payload)}\n\n`));
            controller.close();
          }
        });

        return new Response(sseError, {
          status: aiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
        });
      }

      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      const streamResp = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`event: start\ndata: {"conversationId":"${conversation.id}"}\n\n`));

          let upstreamBuffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            upstreamBuffer += decoder.decode(value, { stream: true });

            const events = upstreamBuffer.split('\n\n');
            upstreamBuffer = events.pop() || '';

            for (const evt of events) {
              const lines = evt.split('\n');
              // Aggregate all data lines per SSE event (multi-line data supported)
              const dataStr = lines
                .filter(l => l.startsWith('data:'))
                .map(l => l.slice(5).trim())
                .join('\n');

              if (!dataStr || dataStr === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? '';
                if (delta) {
                  assistantMessage += delta;
                  controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(delta)}\n\n`));
                }
              } catch {
                controller.enqueue(encoder.encode(`event: raw\ndata: ${JSON.stringify(dataStr)}\n\n`));
              }
            }
          }

          try {
            await supabaseClient.from('messages').insert({
              conversation_id: conversation.id,
              role: 'assistant',
              content: assistantMessage,
              model,
            });
          } catch (err) {
            console.error('Error saving assistant message (stream):', err);
          }

          controller.enqueue(new TextEncoder().encode(`event: done\ndata: {"message": ${JSON.stringify(assistantMessage)}}\n\n`));
          controller.close();
        }
      });

      return new Response(streamResp, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
      });

    } else {
      const aiResponse = await fetch(`${OPENROUTER_URL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: resolvedModel,
          messages: aiMessages,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('OpenRouter error:', aiResponse.status, errorText);
        
        let errorJson: any;
        try { errorJson = JSON.parse(errorText); } catch (_) {}
        const message = errorJson?.error?.message || errorText;
        const code = errorJson?.error?.code || aiResponse.status;

        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({
            error: 'Rate limit exceeded. Please try again later.',
            details: { provider: 'OpenRouter', status: aiResponse.status, code, message, model: resolvedModel }
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({
            error: 'Payment required. Please add credits to your workspace.',
            details: { provider: 'OpenRouter', status: aiResponse.status, code, message, model: resolvedModel }
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          error: 'AI service error',
          details: { provider: 'OpenRouter', status: aiResponse.status, code, message, model: resolvedModel }
        }), {
          status: aiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiData = await aiResponse.json();
      const assistantMessage = aiData.choices?.[0]?.message?.content;

      if (!assistantMessage) {
        return new Response(JSON.stringify({ error: 'No response from AI' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save assistant message
      const { error: assistantMsgError } = await supabaseClient
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          role: 'assistant',
          content: assistantMessage,
          model,
        });

      if (assistantMsgError) {
        console.error('Error saving assistant message:', assistantMsgError);
      }

      return new Response(JSON.stringify({
        conversationId: conversation.id,
        message: assistantMessage,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in chat-session function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
