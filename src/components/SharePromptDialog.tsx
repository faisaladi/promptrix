import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, Copy } from "lucide-react";

interface SharePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Database["public"]["Tables"]["prompts"]["Row"];
}

// Local type alias for the new table (from extended types.ts)
type ShareRow = Database["public"]["Tables"]["prompt_public_shares"]["Row"];
type ShareInsert = Database["public"]["Tables"]["prompt_public_shares"]["Insert"];
type PVRow = Database["public"]["Tables"]["prompt_versions"]["Row"];

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base || "prompt"}-${rand}`;
}

export function SharePromptDialog({ open, onOpenChange, prompt }: SharePromptDialogProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<ShareRow | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [versionMode, setVersionMode] = useState<"live" | "fixed">("live");
  const [fixedVersionId, setFixedVersionId] = useState<string | null>(null);
  const [allowCopy, setAllowCopy] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Load existing share (if any)
  const { data: shareData } = useQuery({
    queryKey: ["share", prompt.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_public_shares")
        .select("*")
        .eq("prompt_id", prompt.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ShareRow | null;
    },
    enabled: open,
  });

  // Load versions for fixed selection
  const { data: versions } = useQuery({
    queryKey: ["prompt-versions", prompt.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_versions")
        .select("id, version_number, is_live")
        .eq("prompt_id", prompt.id)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data as Pick<PVRow, "id" | "version_number" | "is_live">[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (shareData) {
      setEditing(shareData);
      setSlug(shareData.slug);
      setVersionMode(shareData.version_mode);
      setFixedVersionId(shareData.fixed_version_id);
      setAllowCopy(shareData.allow_copy);
      setIsActive(shareData.is_active);
      setExpiresAt(shareData.expires_at);
    } else {
      const initialSlug = slugify(prompt.title);
      setEditing(null);
      setSlug(initialSlug);
      setVersionMode("live");
      setFixedVersionId(null);
      setAllowCopy(true);
      setIsActive(false);
      setExpiresAt(null);
    }
  }, [shareData, open, prompt.title]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Ensure slug uniqueness if creating
      let finalSlug = slug;
      if (!editing) {
        for (let i = 0; i < 3; i++) {
          const { data: existing } = await supabase
            .from("prompt_public_shares")
            .select("id")
            .eq("slug", finalSlug)
            .limit(1)
            .maybeSingle();
          if (!existing) break;
          finalSlug = slugify(prompt.title);
        }
      }

      const { data: userInfo } = await supabase.auth.getUser();
      const ownerId = userInfo.user?.id;
      if (!ownerId) throw new Error("Not authenticated");

      // Convert expiration to UTC ISO string for timestamptz consistency
      const expiresAtIso = expiresAt ? new Date(expiresAt).toISOString() : null;

      if (editing) {
        const { error } = await supabase
          .from("prompt_public_shares")
          .update({
            slug: finalSlug,
            version_mode: versionMode,
            fixed_version_id: versionMode === "fixed" ? fixedVersionId : null,
            allow_copy: allowCopy,
            is_active: isActive,
            expires_at: expiresAtIso,
          })
          .eq("id", editing.id);
        if (error) throw error;
        return { slug: finalSlug };
      } else {
        const payload: ShareInsert = {
          prompt_id: prompt.id,
          owner_id: ownerId,
          slug: finalSlug,
          version_mode: versionMode,
          fixed_version_id: versionMode === "fixed" ? fixedVersionId : null,
          is_active: isActive,
          allow_copy: allowCopy,
          expires_at: expiresAtIso,
        };
        const { error } = await supabase.from("prompt_public_shares").insert(payload);
        if (error) throw error;
        return { slug: finalSlug };
      }
    },
    onSuccess: ({ slug }) => {
      toast({ title: "Share saved", description: `Public link ready: /p/${slug}` });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    },
  });

  const linkUrl = useMemo(() => `${window.location.origin}/p/${slug}`, [slug]);

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Prompt Publicly</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              <div className="text-xs text-muted-foreground">Link: {linkUrl}</div>
              <Button variant="outline" size="sm" onClick={onCopyLink} className="mt-1">
                <Copy className="mr-2 h-4 w-4" /> Copy Link
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Version Mode</Label>
              <Select value={versionMode} onValueChange={(v) => setVersionMode(v as "live" | "fixed")}> 
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live (always latest)</SelectItem>
                  <SelectItem value="fixed">Fixed (choose a version)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {versionMode === "fixed" && (
            <div className="space-y-2">
              <Label>Fixed Version</Label>
              <Select
                value={fixedVersionId ?? ""}
                onValueChange={(v) => setFixedVersionId(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      Version {v.version_number} {v.is_live ? "(live)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch checked={allowCopy} onCheckedChange={(checked) => setAllowCopy(!!checked)} />
              <Label className="cursor-pointer">Allow copy</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={(checked) => setIsActive(!!checked)} />
              <Label className="cursor-pointer">Active</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expires At (optional)</Label>
            <Input
              type="datetime-local"
              value={expiresAt ?? ""}
              onChange={(e) => setExpiresAt(e.target.value || null)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}