import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Type-safe shape for the edge response
type PublicPromptRow = {
  slug: string;
  prompt_id: string;
  version_id: string;
  title: string | null;
  description: string | null;
  prompt_template: string;
  version_number: number | null;
  allow_copy: boolean;
};

type PublicPromptResponse = { prompt: PublicPromptRow };

const PublicPrompt = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicPromptRow | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke<PublicPromptResponse>("public-prompts", {
          body: { slug },
        });

        if (fnErr) {
          throw new Error(fnErr.message ?? "Failed to load public prompt");
        }

        const { prompt } = fnData;
        if (active) setData(prompt);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unexpected error";
        if (active) setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    run();

    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null);
    });

    return () => {
      active = false;
    };
  }, [slug]);

  const canCopy = data?.allow_copy ?? false;

  const onCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.prompt_template);
      toast({ title: "Copied", description: "Prompt template copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy to clipboard.", variant: "destructive" });
    }
  };

  const onSaveToLibrary = async () => {
    if (!sessionUserId) {
      navigate("/signin");
      return;
    }
    if (!data) return;

    type Inserts = Database["public"]["Tables"]["prompts"]["Insert"];

    const payload: Inserts = {
      title: data.title ?? `Imported: ${data.slug}`,
      description: data.description ?? null,
      prompt_template: data.prompt_template,
      user_id: sessionUserId!,
      use_case: "other",
      is_active: true,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("prompts")
      .insert(payload)
      .select("id")
      .single();
    if (insertError || !inserted) {
      toast({ title: "Save failed", description: insertError?.message ?? "Unknown error", variant: "destructive" });
      return;
    }

    // Also insert a prompt_version with the shared template
    type PVInsert = Database["public"]["Tables"]["prompt_versions"]["Insert"];
    const versionPayload: PVInsert = {
      prompt_id: inserted.id,
      version_number: 1,
      prompt_template: data.prompt_template,
      is_live: true,
      created_by: sessionUserId!,
      title: data.title ?? `Imported: ${data.slug}`,
    };

    const { error: vErr } = await supabase.from("prompt_versions").insert(versionPayload);
    if (vErr) {
      toast({ title: "Version save failed", description: vErr.message, variant: "destructive" });
      return;
    }

    toast({ title: "Saved", description: "Prompt added to your library." });
    navigate("/library");
  };

  if (loading) {
    return (
      <div className="container py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-6 w-96" />
        <Skeleton className="mt-6 h-[200px] w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Public Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-destructive">{error ?? "Prompt not found or not public."}</div>
            <div className="mt-4">
              <Link to="/">
                <Button variant="outline">Go Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-title text-2xl">Public Prompt</h1>
        <div className="text-sm text-muted-foreground">Slug: {data.slug}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data.title ?? "Untitled Prompt"}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.description && <p className="text-sm text-muted-foreground mb-4">{data.description}</p>}

          <div className="grid gap-2">
            <Label>Prompt Template</Label>
            <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm">{data.prompt_template}</pre>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Version: {data.version_number ?? "n/a"}</span>
              <span>Prompt ID: {data.prompt_id}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onCopy} disabled={!canCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
            <Button variant="outline" onClick={onSaveToLibrary}>
              Save to Library
            </Button>
            <Link to="/">
              <Button variant="ghost">Back</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicPrompt;