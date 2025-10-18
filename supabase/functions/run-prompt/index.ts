import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { promptTemplate, inputContent, additionalInstruction, model } = await req.json();
    
    console.log('Running prompt with model:', model);
    
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

    console.log('Sending request to OpenRouter');

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
      console.error('OpenRouter error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    console.log('Successfully generated result');

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in run-prompt function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});