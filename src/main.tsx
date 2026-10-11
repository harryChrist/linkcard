import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { Toaster } from "@/components/ui/sonner";
import { Profile } from "@/pages/Profile";

import "./index.css";

type RootErrorBoundaryProps = { children: ReactNode };
type RootErrorBoundaryState = { error: Error | null };

/** Shows a readable message (and a clipped stack) instead of a white screen. */
class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Linkcard failed to render", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const details = String(error.stack || error.message).split("\n").slice(0, 12).join("\n");

    return (
      <div className="flex min-h-[100svh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6 text-left">
          <h1 className="text-base font-semibold text-foreground">Algo deu errado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Não foi possível renderizar a página. Recarregue para tentar novamente.
          </p>
          <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-[#f2a2a2]">
            {details}
          </pre>
        </div>
      </div>
    );
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error('Linkcard could not start: missing <div id="root"> in index.html');
}

createRoot(container).render(
  <StrictMode>
    <RootErrorBoundary>
      <Profile />
      <Toaster />
    </RootErrorBoundary>
  </StrictMode>,
);
