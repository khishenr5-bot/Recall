import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Saved from "@/pages/saved";
import Highlights from "@/pages/highlights";
import Insights from "@/pages/insights";
import Graph from "@/pages/graph";
import Create from "@/pages/create";
import Share from "@/pages/share";
import Settings from "@/pages/settings";
import ShareTarget from "@/pages/share-target";
import Feeds from "@/pages/feeds";
import Wrapped from "@/pages/wrapped";
import Teams from "@/pages/teams";
import Notes from "@/pages/notes";
import Canvas from "@/pages/canvas";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Layout><Home /></Layout>} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/share/:token" component={(params) => <Layout><Share token={params.params.token} /></Layout>} />
      <Route path="/share-target" component={ShareTarget} />
      <Route path="/wrapped/:year" component={(p) => <Layout><Wrapped year={Number(p.params.year)} /></Layout>} />
      <Route path="/wrapped" component={() => <Layout><Wrapped /></Layout>} />

      <Route path="/saved" component={() => <ProtectedRoute><Layout><Saved /></Layout></ProtectedRoute>} />
      <Route path="/highlights" component={() => <ProtectedRoute><Layout><Highlights /></Layout></ProtectedRoute>} />
      <Route path="/insights" component={() => <ProtectedRoute><Layout><Insights /></Layout></ProtectedRoute>} />
      <Route path="/graph" component={() => <ProtectedRoute><Layout><Graph /></Layout></ProtectedRoute>} />
      <Route path="/create" component={() => <ProtectedRoute><Layout><Create /></Layout></ProtectedRoute>} />
      <Route path="/settings" component={() => <ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/feeds" component={() => <ProtectedRoute><Layout><Feeds /></Layout></ProtectedRoute>} />
      <Route path="/teams" component={() => <ProtectedRoute><Layout><Teams /></Layout></ProtectedRoute>} />
      <Route path="/notes" component={() => <ProtectedRoute><Layout><Notes /></Layout></ProtectedRoute>} />
      <Route path="/canvas" component={() => <ProtectedRoute><Layout><Canvas /></Layout></ProtectedRoute>} />
      
      <Route component={() => <Layout><NotFound /></Layout>} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="recall-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
