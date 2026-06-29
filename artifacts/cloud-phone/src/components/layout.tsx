import { Link, useLocation } from "wouter";
import { Server, Smartphone, LayoutDashboard, Monitor, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Emulators", href: "/emulators", icon: Smartphone },
    { name: "Profiles", href: "/profiles", icon: Settings },
    { name: "System", href: "/system", icon: Server },
  ];

  return (
    <div className="flex h-screen w-full bg-background font-sans text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col z-20">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <Monitor className="h-5 w-5" />
            <span className="font-semibold text-foreground tracking-tight">Cloud Android</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className="block">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 px-3 relative font-medium",
                    isActive 
                      ? "bg-primary/10 text-primary hover:bg-primary/15" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
              U
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Administrator</span>
              <span className="text-xs text-muted-foreground">admin@cloud</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
        <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 z-10">
          <h1 className="text-sm font-medium text-muted-foreground">
            {navItems.find((n) => location === n.href || (n.href !== "/" && location.startsWith(n.href)))?.name || 'Overview'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-accent/50 px-3 py-1.5 rounded-full border border-border/50">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected to server
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
