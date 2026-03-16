import { Calendar, DollarSign, TrendingUp, Settings, UserCog, FileText, LogOut, MessageSquare, UserX, Handshake, UserPlus, Users, ChevronLeft, ChevronRight, Send, Database, Instagram, Wallet, ClipboardList, Video, Shield, Settings2, ListChecks, Building2, UsersRound, Package, LayoutDashboard } from "lucide-react";
import { MetaIcon } from "@/components/icons/MetaIcon";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import noktaLogoDefault from "@/assets/nokta-logo.png";
import googleAdsIcon from "@/assets/google-ads-icon.png";
import { createContext, useContext, useMemo } from "react";
import { AdminClientSwitcher } from "./AdminClientSwitcher";
import { useUserFeatureAccess } from "@/hooks/useUserFeatureAccess";

// Mapeamento de href para feature_key
const hrefToFeatureKey: Record<string, string> = {
  "/admin/dashboard": "dashboard",
  "/admin/whatsapp": "whatsapp",
  "/admin/disparos": "disparos",
  "/admin/extrator": "extrator",
  "/admin/instagram": "instagram",
  "/admin/formularios": "formularios",
  "/admin/reunioes": "reunioes",
  "/admin/metricas-campanhas": "meta-ads",
  "/admin/google-ads": "google-ads",
  "/admin/configuracoes": "configuracoes",
  "/admin/paineis": "paineis",
  "/admin/tarefas": "tarefas",
  "/admin/tipos-tarefas": "tarefas",
  "/admin/tarefas-clientes": "tarefas-clientes",
  "/admin/equipe": "equipe",
  "/admin/produtos-tarefas": "produtos-tarefas",
  "/admin/financeiro": "financeiro",
};

export const navigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "WhatsApp", href: "/admin/whatsapp", icon: MessageSquare },
  { name: "Disparos", href: "/admin/disparos", icon: Send },
  { name: "Extrator", href: "/admin/extrator", icon: Database },
  { name: "Instagram", href: "/admin/instagram", icon: Instagram },
  { name: "Formulários", href: "/admin/formularios", icon: ClipboardList },
  { name: "Meta Ads", href: "/admin/metricas-campanhas", icon: MetaIcon },
  { name: "Google Ads", href: "/admin/google-ads", icon: ({ className }: { className?: string }) => <img src={googleAdsIcon} alt="Google Ads" className={cn("h-5 w-5 shrink-0 brightness-0 invert opacity-80", className)} /> },
  { name: "Reuniões", href: "/admin/reunioes", icon: Video },
  { name: "Tarefas", href: "/admin/tarefas", icon: ListChecks },
  { name: "Produtos", href: "/admin/produtos-tarefas", icon: Package },
  { name: "Clientes", href: "/admin/tarefas-clientes", icon: Building2 },
  { name: "Equipe", href: "/admin/equipe", icon: UsersRound },
  { name: "Financeiro", href: "/admin/financeiro", icon: DollarSign },
  { name: "Painéis", href: "/admin/paineis", icon: Settings2 },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

// Map tab_key -> navigation item
const getTabKey = (href: string) => {
  const stripped = href.replace(/^\/admin\/?/, "");
  return stripped || "calendario";
};

const navByKey = new Map(navigation.map((item) => [getTabKey(item.href), item]));

// Context para compartilhar o estado do sidebar
const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}>({
  collapsed: false,
  setCollapsed: () => {},
});

export const useSidebarCollapse = () => useContext(SidebarContext);

interface SidebarContentProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SidebarContent = ({ onNavigate, collapsed = false, onToggleCollapse }: SidebarContentProps) => {
  const { user, signOut } = useAuth();
  const { isFeatureEnabled } = useUserFeatureAccess();
  const { data: panelConfigs } = useQuery({
    queryKey: ["panel-tabs-config-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panel_tabs_config")
        .select("*")
        .eq("panel_type", "admin")
        .order("ordem");
      if (error) return [];
      return data;
    },
  });

  // Build navigation items from DB order, or fallback to hardcoded
  const orderedNavItems = useMemo(() => {
    if (!panelConfigs || panelConfigs.length === 0) {
      // Fallback: use hardcoded navigation with no dividers
      return navigation
        .filter(item => {
          const featureKey = hrefToFeatureKey[item.href];
          if (featureKey && !isFeatureEnabled(featureKey)) return false;
          return true;
        })
        .map(item => ({ type: 'item' as const, item }));
    }

    const result: Array<{ type: 'item'; item: typeof navigation[0] } | { type: 'divider' }> = [];

    for (const config of panelConfigs) {
      if ((config as any).is_divider) {
        result.push({ type: 'divider' });
        continue;
      }

      if (!config.is_visible) continue;

      const navItem = navByKey.get(config.tab_key);
      if (!navItem) continue;

      const featureKey = hrefToFeatureKey[navItem.href];
      if (featureKey && !isFeatureEnabled(featureKey)) continue;

      result.push({ type: 'item', item: navItem });
    }

    // Add any nav items not in config (e.g. newly added) at the end
    const configuredKeys = new Set(panelConfigs.filter(c => !(c as any).is_divider).map(c => c.tab_key));
    for (const item of navigation) {
      const key = getTabKey(item.href);
      if (!configuredKeys.has(key)) {
        const featureKey = hrefToFeatureKey[item.href];
        if (featureKey && !isFeatureEnabled(featureKey)) continue;
        result.push({ type: 'item', item });
      }
    }

    return result;
  }, [panelConfigs, isFeatureEnabled]);

  const handleLogout = async () => {
    await signOut();
    onNavigate?.();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo / Expand Button */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2 py-4" : "justify-center px-6 py-4"
        )}>
          {collapsed && onToggleCollapse ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expandir menu
              </TooltipContent>
            </Tooltip>
          ) : (
            <img 
              src={noktaLogoDefault} 
              alt="Logo" 
              className="h-8 w-auto object-contain transition-all brightness-0 invert"
            />
        )}
        </div>

        {/* Admin Client Switcher */}
        <AdminClientSwitcher collapsed={collapsed} />

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto flex flex-col",
          collapsed ? "py-4 gap-6 items-center" : "px-3 py-4 space-y-1"
        )}>
          {orderedNavItems.map((entry, idx) => {
            if (entry.type === 'divider') {
              if (collapsed) return null;
              return <div key={`div-${idx}`} className="my-2 border-t border-sidebar-border" />;
            }

            const item = entry.item;
            return (
              <div key={item.href}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.href}
                        end={item.href === "/admin"}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center justify-center h-10 w-10 rounded-lg text-sm font-medium transition-all",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <item.icon className={cn("h-5 w-5", isActive && "text-sidebar-primary")} />
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    to={item.href}
                    end={item.href === "/admin"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn("h-5 w-5", isActive && "text-sidebar-primary")} />
                        <span>{item.name}</span>
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse Toggle Button */}
        {onToggleCollapse && !collapsed && (
          <div className="px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="w-full justify-center gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Recolher menu</span>
            </Button>
          </div>
        )}

        {/* User Info */}
        <div className={cn(
          "border-t border-sidebar-border space-y-2",
          collapsed ? "p-2" : "p-4"
        )}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center py-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-medium cursor-default">
                    {user?.user_metadata?.full_name?.charAt(0).toUpperCase() || 
                     user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                <p>{user?.user_metadata?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground">Plano Premium</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                {user?.user_metadata?.full_name?.charAt(0).toUpperCase() || 
                 user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">Plano Premium</p>
              </div>
            </div>
          )}
          
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleLogout}
                  className="w-full border-sidebar-border hover:bg-sidebar-accent"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Sair do sistema
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-2 border-sidebar-border hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
              Sair do sistema
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = ({ collapsed = false, onToggleCollapse }: SidebarProps) => {
  return (
    <aside className={cn(
      "hidden md:flex fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>
  );
};
