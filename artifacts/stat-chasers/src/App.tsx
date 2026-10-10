import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import { Component, type ErrorInfo, type ReactNode } from "react";

const queryClient = new QueryClient();

const DEFAULT_FILTERS_PATH = "/redraft-draft-strategy-analysis/2025/1qb/ppr/no-tep/12";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[StatChasers] Render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "2rem",
            fontFamily: "monospace",
            background: "#0B1F3A",
            color: "#C9A227",
            minHeight: "100vh",
          }}
        >
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#fff", fontSize: 13 }}>
            {this.state.error.message}
            {"\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/redraft-draft-strategy-analysis/:season/:qb/:scoring/:tep/:size" component={Dashboard} />
      <Route path="/redraft-draft-strategy-analysis">
        <Redirect to={DEFAULT_FILTERS_PATH} replace />
      </Route>
      <Route path="/">
        <Redirect to={DEFAULT_FILTERS_PATH} replace />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      {/* Single root wrapper: every class in this tool is prefixed rs-app-
          and all custom CSS is scoped under .rs-app-root so nothing collides
          with the host WordPress/Divi global stylesheet. */}
      <div className="rs-app-root">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {/* Default Wouter browser-location (history.replaceState) — never
                fires hashchange, so the Replit canvas parent frame is not
                notified of navigation and does not reset the iframe src. */}
            <WouterRouter>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;
