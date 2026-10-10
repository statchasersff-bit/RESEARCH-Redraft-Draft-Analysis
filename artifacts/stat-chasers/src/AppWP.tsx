import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import { Component, type ErrorInfo, type ReactNode } from "react";

const queryClient = new QueryClient();

const DEFAULT_FILTERS_PATH = "/redraft-draft-strategy-analysis/2025/1qb/ppr/no-tep/12";

// In-memory location: never touches window.location, so external scripts
// (e.g. Bluehost analytics appending #utm_medium=...) cannot interfere with
// routing. Filter changes update in-memory URL only.
const { hook } = memoryLocation({ path: DEFAULT_FILTERS_PATH });

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
    console.error("[StatChasers WP] Render error:", error, info);
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
          }}
        >
          <h2>Something went wrong loading StatChasers</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#fff", fontSize: 13 }}>
            {this.state.error.message}
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
      <Route
        path="/redraft-draft-strategy-analysis/:season/:qb/:scoring/:tep/:size"
        component={Dashboard}
      />
      <Route path="/">
        <Redirect to={DEFAULT_FILTERS_PATH} replace />
      </Route>
    </Switch>
  );
}

export default function AppWP() {
  return (
    <ErrorBoundary>
      {/* Single root wrapper: every class in this tool is prefixed rs-app-
          and all custom CSS is scoped under .rs-app-root so nothing collides
          with the host WordPress/Divi global stylesheet. */}
      <div className="rs-app-root">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {/* Memory router: navigation never modifies window.location or
                fires hashchange/popstate events. Immune to external hash
                overrides (e.g. Bluehost analytics). */}
            <WouterRouter hook={hook}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </div>
    </ErrorBoundary>
  );
}
