import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Clock, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PromptVersionTimelineProps {
  promptId: string;
  onRevertVersion?: (version: any) => void;
}

export function PromptVersionTimeline({ promptId, onRevertVersion }: PromptVersionTimelineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteVersionId, setDeleteVersionId] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["prompt-versions", promptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_versions")
        .select("*")
        .eq("prompt_id", promptId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!promptId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const version = versions?.find(v => v.id === versionId);
      if (version?.is_live) {
        throw new Error("Cannot delete the live version");
      }

      const { error } = await supabase
        .from("prompt_versions")
        .delete()
        .eq("id", versionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-versions", promptId] });
      toast({
        title: "Success",
        description: "Version deleted successfully",
      });
      setDeleteVersionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete version",
        variant: "destructive",
      });
    },
  });

  const setLiveMutation = useMutation({
    mutationFn: async (versionId: string) => {
      // First, set all versions to not live
      const { error: unsetError } = await supabase
        .from("prompt_versions")
        .update({ is_live: false })
        .eq("prompt_id", promptId);

      if (unsetError) throw unsetError;

      // Then set the selected version as live
      const { error: setError } = await supabase
        .from("prompt_versions")
        .update({ is_live: true })
        .eq("id", versionId);

      if (setError) throw setError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-versions", promptId] });
      toast({
        title: "Success",
        description: "Live version updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update live version",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>No versions available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>
            Track changes and revert to previous versions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="relative border-l-2 border-muted pl-6 pb-6 last:pb-0"
                >
                  <div className="absolute -left-2 top-0 h-4 w-4 rounded-full border-2 border-background bg-primary" />
                  
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">Version {version.version_number}</h4>
                          {version.is_live && (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Live
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                        </div>
                        {version.change_message && (
                          <p className="mt-1 text-sm text-muted-foreground italic">
                            "{version.change_message}"
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1">
                        {!version.is_live && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLiveMutation.mutate(version.id)}
                              disabled={setLiveMutation.isPending}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Set Live
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteVersionId(version.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedVersion(expandedVersion === version.id ? null : version.id)}
                        className="h-auto p-0 text-xs font-normal hover:bg-transparent"
                      >
                        {expandedVersion === version.id ? "Hide" : "Show"} details
                      </Button>
                      
                      {expandedVersion === version.id && (
                        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
                          <div>
                            <p className="font-medium">Title:</p>
                            <p className="text-muted-foreground">{version.title}</p>
                          </div>
                          {version.description && (
                            <div>
                              <p className="font-medium">Description:</p>
                              <p className="text-muted-foreground">{version.description}</p>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">Template:</p>
                            <pre className="mt-1 overflow-auto rounded bg-background p-2 text-xs">
                              {version.prompt_template}
                            </pre>
                          </div>
                          {onRevertVersion && !version.is_live && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => onRevertVersion(version)}
                              className="w-full"
                            >
                              <RotateCcw className="mr-2 h-3 w-3" />
                              Revert to This Version
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteVersionId} onOpenChange={() => setDeleteVersionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this version? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVersionId && deleteMutation.mutate(deleteVersionId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
