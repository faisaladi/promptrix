import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      // Create new conversation
      if (!promptId) {
        return new Response(JSON.stringify({ error: 'promptId required for new conversation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch prompt version
      let promptVersion;
      if (promptVersionId) {
        // Use specific version
        const { data: version } = await supabaseClient
          .from('prompt_versions')
          .select('*')
          .eq('id', promptVersionId)
          .single();
        promptVersion = version;
      } else {
        // Use live version
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

      // Add system message with prompt version template
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

    const resolvedModel = (() => {
      const map: Record<string, string> = {
        'google/gemini-2.5-flash': 'google/gemini-flash-1.5',
        'google/gemini-2.5-flash-lite': 'google/gemini-flash-1.5',
        'google/gemini-2.5-pro': 'google/gemini-2.5-pro',
        'openai/gpt-5': 'openai/gpt-4o',
        'openai/gpt-5-mini': 'openai/gpt-4o-mini',
      };
      return map[model] || model;
    })();

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
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
      }

      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      const streamResp = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(`event: start\ndata: {"conversationId":"${conversation.id}"}\n\n`));
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? '';
                if (delta) {
                  assistantMessage += delta;
                  controller.enqueue(new TextEncoder().encode(`event: token\ndata: ${JSON.stringify(delta)}\n\n`));
                }
              } catch {
                controller.enqueue(new TextEncoder().encode(`event: raw\ndata: ${JSON.stringify(data)}\n\n`));
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
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
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
