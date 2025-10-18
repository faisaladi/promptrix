import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Library, Pencil, Trash2 } from "lucide-react";
import { PromptDialog } from "@/components/PromptDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export default function PromptLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prompts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete prompt",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (prompt: any) => {
    setEditingPrompt(prompt);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this prompt?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPrompt(null);
  };

  const availableUseCases = useMemo(() => {
    return Array.from(new Set((prompts || []).map((p: any) => (p.use_case || "").trim()).filter(Boolean)));
  }, [prompts]);

  const availableTags = useMemo(() => {
    return Array.from(new Set((prompts || []).flatMap((p: any) => Array.isArray(p.tags) ? p.tags : []).filter(Boolean)));
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const list = prompts || [];
    return list.filter((p: any) => {
      const useCaseOk = selectedUseCase ? p.use_case === selectedUseCase : true;
      const tagsOk = selectedTags.length > 0 ? selectedTags.every((t) => Array.isArray(p.tags) && p.tags.includes(t)) : true;
      return useCaseOk && tagsOk;
    });
  }, [prompts, selectedUseCase, selectedTags]);

  const toggleTag = (tag: string, checked: boolean) => {
    setSelectedTags((prev) => {
      if (checked) {
        return prev.includes(tag) ? prev : [...prev, tag];
      } else {
        return prev.filter((t) => t !== tag);
      }
    });
  };

  const clearFilters = () => {
    setSelectedUseCase("");
    setSelectedTags([]);
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-glow">
            <Library className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prompt Library</h1>
            <p className="text-muted-foreground">Manage your prompt templates</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-to-r from-primary to-primary-glow shadow-glow transition-all hover:shadow-lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Prompt
        </Button>
      </div>

      {/* Filters */}
      {!isLoading && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Select value={selectedUseCase} onValueChange={(value) => setSelectedUseCase(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Use Case" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {availableUseCases.map((uc) => (
                <SelectItem key={uc} value={uc} className="capitalize">
                  {uc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Tags {selectedTags.length > 0 ? `(${selectedTags.length})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {availableTags.length === 0 ? (
                <div className="px-2 py-1 text-sm text-muted-foreground">No tags</div>
              ) : (
                availableTags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={(checked) => toggleTag(tag, !!checked)}
                  >
                    {tag}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {(selectedUseCase || selectedTags.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-3/4 rounded bg-muted"></div>
                <div className="h-4 w-full rounded bg-muted"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : prompts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex h-[400px] flex-col items-center justify-center">
            <Library className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No prompts yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first prompt template to get started
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Prompt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPrompts.map((prompt: any) => (
            <Card key={prompt.id} className="group relative shadow-md transition-all hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {prompt.title}
                      {prompt.is_active && (
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2">{prompt.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Badge variant="outline" className="capitalize">
                      {prompt.use_case}
                    </Badge>
                  </div>
                  {prompt.tags && prompt.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {prompt.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(prompt)}
                      className="flex-1"
                    >
                      <Pencil className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(prompt.id)}
                      className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PromptDialog
        open={isDialogOpen}
        onOpenChange={handleCloseDialog}
        prompt={editingPrompt}
      />
    </div>
  );
}