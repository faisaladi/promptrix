import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "@/components/ChatMessage";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function ChatInterface() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Fetch conversation details
  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, prompts(title)")
        .eq("id", conversationId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (userMessage: string) => {
      // Use the conversation's model (from system message or latest message), fallback to a safe default
      const modelToUse =
        messages?.find((m) => m.role === "system" && m.model)?.model ||
        [...(messages ?? [])].reverse().find((m) => m.model)?.model ||
        "openai/gpt-4o-mini";

      // Build Supabase Functions URL and auth
      const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-session`;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const res = await fetch(functionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          conversationId,
          userMessage,
          model: modelToUse,
          stream: true,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json?.details?.message || json?.error || text);
        } catch {
          throw new Error(text || "AI service error");
        }
      }

      setIsStreaming(true);
      setStreamingText("");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // leftover partial

        for (const evt of events) {
          const lines = evt.split("\n");
          let eventType = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }

          if (eventType === "token") {
            try {
              const token = JSON.parse(dataStr);
              setStreamingText((prev) => prev + token);
            } catch {
              setStreamingText((prev) => prev + dataStr);
            }
          } else if (eventType === "error") {
            try {
              const details = JSON.parse(dataStr);
              toast.error(details?.message || "AI service error");
            } catch {
              toast.error("AI service error");
            }
          } else if (eventType === "done") {
            try {
              const payload = JSON.parse(dataStr);
              finalMessage = payload?.message || streamingText;
            } catch {
              finalMessage = streamingText;
            }
          }
        }
      }

      setIsStreaming(false);
      setStreamingText("");

      // Invalidate to fetch saved assistant message
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);

      setInput("");
      return { conversationId, message: finalMessage };
    },
    onSuccess: () => {
      // No-op: already invalidated and cleared input in mutationFn
    },
    onError: (error: any) => {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
      setIsStreaming(false);
      setStreamingText("");
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No conversation selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold">{conversation?.title}</h2>
          {conversation?.prompts && (
            <p className="text-sm text-muted-foreground">
              Using: {conversation.prompts.title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant" | "system"}
              content={msg.content}
              timestamp={msg.created_at}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Start the conversation by sending a message
            </p>
          </div>
        )}
        {isStreaming && streamingText && (
          <ChatMessage
            role="assistant"
            content={streamingText}
            timestamp={new Date().toISOString()}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <Card className="m-4 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="min-h-[60px] max-h-[200px]"
            disabled={sendMessage.isPending || isStreaming}
          />
          <Button
            type="submit"
            disabled={!input.trim() || sendMessage.isPending || isStreaming}
            className="self-end"
          >
            {sendMessage.isPending || isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
