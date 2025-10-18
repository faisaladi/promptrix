import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PromptAgent() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [userMessage, setUserMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("openai/gpt-4o-mini");

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["active-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .eq("is_active", true)
        .order("title");
      
      if (error) throw error;
      return data;
    },
  });

  const selectedPrompt = prompts?.find(p => p.id === selectedPromptId);

  const { data: versions } = useQuery({
    queryKey: ["prompt-versions", selectedPromptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_versions")
        .select("*")
        .eq("prompt_id", selectedPromptId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedPromptId,
  });

  const startChat = useMutation({
    mutationFn: async () => {
      if (!selectedPromptId || !userMessage.trim()) {
        throw new Error("Please select a prompt and enter a message");
      }

      const { data, error } = await supabase.functions.invoke("chat-session", {
        body: {
          promptId: selectedPromptId,
          promptVersionId: selectedVersionId || undefined,
          userMessage,
          model: selectedModel,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      navigate(`/chat/${data.conversationId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start chat",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-glow">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompt Agent</h1>
          <p className="text-muted-foreground">Run your prompts with AI models</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-md transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Select and configure your prompt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Select Prompt</Label>
              <Select 
                value={selectedPromptId} 
                onValueChange={(value) => {
                  setSelectedPromptId(value);
                  setSelectedVersionId("");
                }}
              >
                <SelectTrigger id="prompt">
                  <SelectValue placeholder="Choose a prompt" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : prompts?.length === 0 ? (
                    <SelectItem value="empty" disabled>No active prompts</SelectItem>
                  ) : (
                    prompts?.map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPrompt && (
                <p className="text-sm text-muted-foreground">{selectedPrompt.description}</p>
              )}
            </div>

            {selectedPromptId && versions && versions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="version">Prompt Version</Label>
                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                  <SelectTrigger id="version">
                    <SelectValue placeholder="Live version (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        v{version.version_number} - {version.title}
                        {version.is_live && " (Live)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message">Start your conversation...</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                className="min-h-[200px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai/gpt-4o-mini">OpenAI GPT-4o Mini</SelectItem>
                  <SelectItem value="openai/gpt-4o">OpenAI GPT-4o</SelectItem>
                  <SelectItem value="google/gemini-flash-1.5">Gemini Flash 1.5</SelectItem>
                  <SelectItem value="google/gemini-pro-1.5">Gemini Pro 1.5</SelectItem>
                  <SelectItem value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B Instruct (Free)</SelectItem>
                  <SelectItem value="qwen/qwen-2.5-7b-instruct:free">Qwen 2.5 7B Instruct (Free)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => startChat.mutate()}
              disabled={startChat.isPending || !selectedPromptId || !userMessage.trim()}
              className="w-full bg-gradient-to-r from-primary to-primary-glow shadow-glow transition-all hover:shadow-lg"
            >
              {startChat.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Chat...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Start Chat
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Chat-based interaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed bg-muted/30">
              <div className="space-y-4 text-center px-6">
                <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                <div className="space-y-2">
                  <h3 className="font-semibold">Start a Conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Select a prompt, type your message, and click "Start Chat" to begin an interactive conversation with AI. 
                    You can continue the conversation in the chat interface.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}