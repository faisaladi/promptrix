import { useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: any;
}

export function PromptDialog({ open, onOpenChange, prompt }: PromptDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      use_case: "product",
      title: "",
      description: "",
      prompt_template: "",
      is_active: true,
      tags: "",
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
      });
    } else {
      reset({
        use_case: "product",
        title: "",
        description: "",
        prompt_template: "",
        is_active: true,
        tags: "",
      });
    }
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
        const { error } = await supabase
          .from("prompts")
          .update(payload)
          .eq("id", prompt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prompts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({ queryKey: ["active-prompts"] });
      toast({
        title: "Success",
        description: prompt ? "Prompt updated successfully" : "Prompt created successfully",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{prompt ? "Edit Prompt" : "Create New Prompt"}</DialogTitle>
          <DialogDescription>
            {prompt ? "Update your prompt template" : "Add a new prompt template to your library"}
          </DialogDescription>
        </DialogHeader>
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
              {prompt ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}