import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { PromptVersionTimeline } from "./PromptVersionTimeline";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: any;
}

export function PromptDialog({ open, onOpenChange, prompt }: PromptDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("edit");
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      use_case: "product",
      title: "",
      description: "",
      prompt_template: "",
      is_active: true,
      tags: "",
      change_message: "",
    },
  });

  useEffect(() => {
    if (prompt) {
      reset({
        use_case: prompt.use_case,
        title: prompt.title,
        description: prompt.description || "",
        prompt_template: prompt.prompt_template,
        is_active: prompt.is_active,
        tags: prompt.tags?.join(", ") || "",
        change_message: "",
      });
    } else {
      reset({
        use_case: "product",
        title: "",
        description: "",
        prompt_template: "",
        is_active: true,
        tags: "",
        change_message: "",
      });
    }
    setActiveTab("edit");
  }, [prompt, reset]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const tags = data.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter((t: string) => t);

      const payload = {
        user_id: user.user.id,
        use_case: data.use_case,
        title: data.title,
        description: data.description,
        prompt_template: data.prompt_template,
        is_active: data.is_active,
        tags,
      };

      if (prompt) {
        // Update the main prompt
        const { error: updateError } = await supabase
          .from("prompts")
          .update(payload)
          .eq("id", prompt.id);
        if (updateError) throw updateError;

        // Get the latest version number
        const { data: versions, error: versionsError } = await supabase
          .from("prompt_versions")
          .select("version_number")
          .eq("prompt_id", prompt.id)
          .order("version_number", { ascending: false })
          .limit(1);

        if (versionsError) throw versionsError;

        const nextVersion = (versions?.[0]?.version_number || 0) + 1;

        // Create new version
        const { error: versionError } = await supabase
          .from("prompt_versions")
          .insert({
            prompt_id: prompt.id,
            version_number: nextVersion,
            title: data.title,
            description: data.description,
            prompt_template: data.prompt_template,
            change_message: data.change_message || "Updated prompt",
            is_live: true,
            created_by: user.user.id,
          });

        if (versionError) throw versionError;

        // Set all other versions to not live
        const { error: unsetError } = await supabase
          .from("prompt_versions")
          .update({ is_live: false })
          .eq("prompt_id", prompt.id)
          .neq("version_number", nextVersion);

        if (unsetError) throw unsetError;
      } else {
        const { error } = await supabase.from("prompts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({ queryKey: ["active-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["prompt-versions"] });
      toast({
        title: "Success",
        description: prompt ? "Prompt updated and new version created" : "Prompt created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save prompt",
        variant: "destructive",
      });
    },
  });

  const handleRevertVersion = (version: any) => {
    setValue("title", version.title);
    setValue("description", version.description || "");
    setValue("prompt_template", version.prompt_template);
    setValue("change_message", `Reverted to version ${version.version_number}`);
    setActiveTab("edit");
    toast({
      title: "Version Loaded",
      description: "Make changes and save to create a new version based on this one",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{prompt ? "Edit Prompt" : "Create New Prompt"}</DialogTitle>
          <DialogDescription>
            {prompt ? "Update your prompt template and view version history" : "Add a new prompt template to your library"}
          </DialogDescription>
        </DialogHeader>

        {prompt ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="history">Version History</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="max-h-[60vh] overflow-y-auto">
              <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="use_case">Use Case</Label>
              <Select
                value={watch("use_case")}
                onValueChange={(value) => setValue("use_case", value)}
              >
                <SelectTrigger id="use_case">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title", { required: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} className="resize-none" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt_template">Prompt Template</Label>
            <Textarea
              id="prompt_template"
              {...register("prompt_template", { required: true })}
              placeholder="Write your prompt template here. Use {input} or {content} as placeholders for user input."
              className="min-h-[200px] resize-none font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" {...register("tags")} placeholder="evaluation, analysis, review" />
          </div>

          {prompt && (
            <div className="space-y-2">
              <Label htmlFor="change_message">Change Message</Label>
              <Input 
                id="change_message" 
                {...register("change_message")} 
                placeholder="Describe what changed in this version"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={watch("is_active")}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active (available in Prompt Agent)
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {prompt ? "Save as New Version" : "Create"}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="history" className="max-h-[60vh] overflow-y-auto">
        <PromptVersionTimeline 
          promptId={prompt.id}
          onRevertVersion={handleRevertVersion}
        />
      </TabsContent>
    </Tabs>
        ) : (
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="use_case">Use Case</Label>
                <Select
                  value={watch("use_case")}
                  onValueChange={(value) => setValue("use_case", value)}
                >
                  <SelectTrigger id="use_case">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" {...register("title", { required: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} className="resize-none" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt_template">Prompt Template</Label>
              <Textarea
                id="prompt_template"
                {...register("prompt_template", { required: true })}
                placeholder="Write your prompt template here. Use {input} or {content} as placeholders for user input."
                className="min-h-[200px] resize-none font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" {...register("tags")} placeholder="evaluation, analysis, review" />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={watch("is_active")}
                onCheckedChange={(checked) => setValue("is_active", checked)}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active (available in Prompt Agent)
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}