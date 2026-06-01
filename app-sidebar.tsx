import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Calendar, Users, Settings, LogOut, Scissors, UserCog, BarChart3, Package } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Clienti", url: "/clienti", icon: Users },
  { title: "Staff", url: "/staff", icon: UserCog },
  { title: "Magazzino", url: "/magazzino", icon: Package },
  { title: "Report Azienda", url: "/statistiche", icon: BarChart3 },
  { title: "Impostazioni", url: "/impostazioni", icon: Settings },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Scissors className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sidebar-foreground leading-tight">Prenotello</span>
            <span className="text-xs text-muted-foreground">Gestionale</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Esci">
              <LogOut className="h-4 w-4" />
              <span>Esci</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
