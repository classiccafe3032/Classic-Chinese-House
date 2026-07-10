import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ""
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message + "\n" + error.stack };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Auto-reload on Vite chunk loading errors (PWA cache issues)
    const isChunkError = 
      error.message?.includes("Failed to fetch dynamically imported module") || 
      error.message?.includes("Importing a module script failed");
      
    if (isChunkError) {
      // Set a session storage flag to prevent infinite reload loops just in case
      const reloaded = sessionStorage.getItem("chunk_reload");
      if (!reloaded) {
        sessionStorage.setItem("chunk_reload", "true");
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="bg-destructive/10 text-destructive p-8 rounded-3xl max-w-lg border border-destructive/20 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-sm mb-6 opacity-80">
              A temporary issue occurred while loading this section. Please refresh the page to try again.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-destructive text-destructive-foreground px-6 py-3 rounded-xl font-semibold shadow-lg hover:bg-destructive/90 transition-all"
            >
              Refresh Page
            </button>
            <div className="mt-6 p-4 bg-background/50 rounded-lg text-left overflow-auto max-h-32 text-xs opacity-50 font-mono hidden">
              {this.state.errorMsg}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
