import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
          <SidebarTrigger className="flex items-center gap-2">
            <Menu className="h-5 w-5" />
            <span className="font-semibold">Menu</span>
          </SidebarTrigger>
        </header>
        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 bg-gradient-to-br from-background to-secondary/20">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};