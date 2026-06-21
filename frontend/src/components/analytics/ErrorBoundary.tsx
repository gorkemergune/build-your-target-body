"use client";

import React from "react";
import { logError } from "@/lib/analytics";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown render error" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError({
      error_type: "render_error",
      message: error?.message ?? "Unknown",
      stack_trace: (error?.stack ?? "") + "\n\nComponent stack:\n" + info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-6">
            <p className="text-lg font-semibold text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">{this.state.message}</p>
            <button
              className="mt-4 text-sm underline text-primary"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
