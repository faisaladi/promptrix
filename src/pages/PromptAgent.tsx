import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Download, Sparkles } from "lucide-react";

export default function PromptAgent() {
  const { toast } = useToast();
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [inputContent, setInputContent] = useState("");
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [result, setResult] = useState("");
  const [isRunning, setIsRunning] = useState(false);

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

  const handleRun = async () => {
    if (!selectedPrompt) {
      toast({
        title: "Error",
        description: "Please select a prompt",
        variant: "destructive",
      });
      return;
    }

    if (!inputContent.trim()) {
      toast({
        title: "Error",
        description: "Please provide input content",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setResult("");

    try {
      const { data, error } = await supabase.functions.invoke("run-prompt", {
        body: {
          promptTemplate: selectedPrompt.prompt_template,
          inputContent,
          additionalInstruction,
          model: selectedModel,
        },
      });

      if (error) throw error;

      setResult(data.result);

      // Save to chat history
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        await supabase.from("chat_history").insert({
          user_id: user.user.id,
          prompt_id: selectedPromptId,
          input_content: inputContent,
          additional_instruction: additionalInstruction,
          model: selectedModel,
          result: data.result,
        });
      }

      toast({
        title: "Success",
        description: "Prompt executed successfully",
      });
    } catch (error: any) {
      console.error("Error running prompt:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to run prompt",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast({
      title: "Copied",
      description: "Result copied to clipboard",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-result-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Result downloaded successfully",
    });
  };

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
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
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

            <div className="space-y-2">
              <Label htmlFor="input">Input Content</Label>
              <Textarea
                id="input"
                placeholder="Enter your content or paste markdown/text..."
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                className="min-h-[150px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional">Additional Instructions (Optional)</Label>
              <Textarea
                id="additional"
                placeholder="Add any extra instructions..."
                value={additionalInstruction}
                onChange={(e) => setAdditionalInstruction(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Free)</SelectItem>
                  <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (Free)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Free)</SelectItem>
                  <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                  <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRun}
              disabled={isRunning || !selectedPromptId}
              className="w-full bg-gradient-to-r from-primary to-primary-glow shadow-glow transition-all hover:shadow-lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run Prompt
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>AI-generated output</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <pre className="whitespace-pre-wrap text-sm">{result}</pre>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} variant="outline" className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Run a prompt to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}