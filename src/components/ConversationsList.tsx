import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "./ui/sidebar";

export const ConversationsList = () => {
  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  if (!conversations || conversations.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No recent chats
      </div>
    );
  }

  return (
    <SidebarMenu>
      {conversations.map((conversation) => (
        <SidebarMenuItem key={conversation.id}>
          <SidebarMenuButton asChild>
            <NavLink
              to={`/chat/${conversation.id}`}
              className={({ isActive }) =>
                isActive ? "bg-muted text-primary font-medium" : ""
              }
            >
              <MessageSquare className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">{conversation.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(conversation.updated_at), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
};
