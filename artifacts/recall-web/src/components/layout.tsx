import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Moon,
  Sun,
  Menu,
  Brain,
  BookMarked,
  Quote,
  LineChart,
  Network,
  PenTool,
  Settings,
  LogOut,
  Upload,
  Rss,
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
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const navLinks = [
    { href: "/saved", label: "Library", icon: BookMarked },
    { href: "/feeds", label: "Feeds", icon: Rss },
    { href: "/highlights", label: "Highlights", icon: Quote },
    { href: "/insights", label: "Insights", icon: LineChart },
    { href: "/graph", label: "Graph", icon: Network },
    { href: "/create", label: "Create", icon: PenTool },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                <nav className="flex flex-col gap-2 mt-8">
                  <Link href="/" className="flex items-center gap-2 px-2 py-1.5 text-xl font-bold mb-6">
                    <Brain className="h-7 w-7 text-primary" />
                    <span>Recall.ai</span>
                  </Link>
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent text-sm font-medium transition"
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link href="/" className="hidden md:flex items-center gap-2 group">
              <Brain className="h-7 w-7 text-primary transition-transform group-hover:scale-110" />
              <span className="font-bold text-xl tracking-tight">Recall.ai</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              {navLinks.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-3 py-1.5 rounded-md transition-colors hover:text-foreground group ${
                      isActive ? "text-foreground" : "text-foreground/60"
                    }`}
                  >
                    {link.label}
                    <span
                      className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary transition-all duration-200 ${
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      {(user as any).avatarUrl && (
                        <img
                          src={(user as any).avatarUrl}
                          alt={user.username || user.email}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                        {user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="w-full flex items-center cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className="shadow-[0_0_12px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.55)] transition-shadow"
                  >
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full relative">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span>© 2026 Recall.ai · Distilling the web</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground transition">Privacy</a>
            <a href="#" className="hover:text-foreground transition">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
