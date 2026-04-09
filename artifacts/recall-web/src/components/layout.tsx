import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  Brain,
  BookMarked,
  Quote,
  LineChart,
  Network,
  PenTool,
  Settings,
  LogOut,
  Rss,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const navLinks = [
    { href: "/saved", label: "Library", icon: BookMarked },
    { href: "/feeds", label: "Feeds", icon: Rss },
    { href: "/teams", label: "Teams", icon: Users },
    { href: "/highlights", label: "Highlights", icon: Quote },
    { href: "/insights", label: "Insights", icon: LineChart },
    { href: "/graph", label: "Graph", icon: Network },
    { href: "/create", label: "Create", icon: PenTool },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[var(--surface)] text-[var(--on-surface)]">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 w-full bg-[var(--surface)] px-4 h-16 flex items-center justify-between border-b border-transparent">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-bright)]">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] glass border-transparent p-0">
              <nav className="flex flex-col gap-1 p-4 mt-4">
                <Link href="/" className="flex items-center gap-3 px-3 py-3 mb-6">
                  <div className="relative">
                    <Brain className="h-7 w-7 text-[var(--secondary)] drop-shadow-[0_0_8px_rgba(83,221,252,0.5)]" />
                  </div>
                  <span className="font-bold text-xl tracking-tight text-white" style={{ fontFamily: 'var(--app-font-display)' }}>Recall.ai</span>
                </Link>
                {navLinks.map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                        isActive 
                          ? "bg-[var(--surface-bright)] text-[var(--primary)] shadow-[inset_3px_0_0_var(--primary)]" 
                          : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-[var(--secondary)] drop-shadow-[0_0_8px_rgba(83,221,252,0.5)]" />
            <span className="font-bold text-lg tracking-tight text-white" style={{ fontFamily: 'var(--app-font-display)' }}>Recall.ai</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border border-[var(--outline-variant)]">
                    {(user as any).avatarUrl && (
                      <img
                        src={(user as any).avatarUrl}
                        alt={user.username || user.email}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-[var(--surface-bright)] text-[var(--primary)] text-sm font-bold">
                      {user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass border-[var(--outline-variant)]" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-[var(--on-surface)]">{user.username || "User"}</p>
                    <p className="text-xs leading-none text-[var(--on-surface-muted)]">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--outline-variant)]" />
                <DropdownMenuItem asChild className="hover:bg-[var(--surface-bright)] cursor-pointer">
                  <Link href="/settings" className="w-full flex items-center">
                    <Settings className="mr-2 h-4 w-4 text-[var(--on-surface-muted)]" />
                    <span className="text-[var(--on-surface)]">Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="hover:bg-[var(--surface-bright)] cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4 text-[var(--error)]" />
                  <span className="text-[var(--error)]">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[var(--on-surface-muted)]">
                Log in
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[var(--surface)] border-r border-[var(--outline-variant)] sticky top-0 h-screen shrink-0 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-3 px-6 mb-8 group">
          <div className="relative">
            <Brain className="h-7 w-7 text-[var(--secondary)] drop-shadow-[0_0_8px_rgba(83,221,252,0.5)] transition-transform group-hover:scale-105" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white" style={{ fontFamily: 'var(--app-font-display)' }}>Recall.ai</span>
        </Link>
        
        <nav className="flex-1 flex flex-col gap-1 px-3">
          {navLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all relative ${
                  isActive 
                    ? "bg-[var(--surface-bright)] text-[var(--primary)]" 
                    : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--on-surface)]"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-[var(--primary)] rounded-r-full shadow-[0_0_8px_var(--primary)]" />
                )}
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 pt-4 border-t border-[var(--outline-variant)]">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full text-left hover:bg-[var(--surface-high)] p-2 -mx-2 rounded-md transition-colors">
                  <Avatar className="h-8 w-8 border border-[var(--outline-variant)]">
                    {(user as any).avatarUrl && (
                      <img
                        src={(user as any).avatarUrl}
                        alt={user.username || user.email}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-[var(--surface-bright)] text-[var(--primary)] text-sm font-bold">
                      {user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[var(--on-surface)]">{user.username || "User"}</p>
                    <p className="text-xs truncate text-[var(--on-surface-muted)]">{user.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass border-[var(--outline-variant)] ml-4 mb-2" align="end" side="right" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-[var(--on-surface)]">{user.username || "User"}</p>
                    <p className="text-xs leading-none text-[var(--on-surface-muted)]">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--outline-variant)]" />
                <DropdownMenuItem asChild className="hover:bg-[var(--surface-bright)] cursor-pointer">
                  <Link href="/settings" className="w-full flex items-center">
                    <Settings className="mr-2 h-4 w-4 text-[var(--on-surface-muted)]" />
                    <span className="text-[var(--on-surface)]">Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="hover:bg-[var(--surface-bright)] cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4 text-[var(--error)]" />
                  <span className="text-[var(--error)]">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/login">
                <Button variant="ghost" className="w-full justify-center text-[var(--on-surface-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--on-surface)]">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button className="w-full justify-center gradient-btn">
                  Sign up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 w-full relative min-w-0 bg-[var(--surface)]">{children}</main>
    </div>
  );
}
