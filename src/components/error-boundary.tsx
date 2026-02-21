/**
 * ErrorBoundary
 *
 * Catches render-time errors in any child tree and shows a fallback UI
 * instead of crashing the whole page. Must be a class component — hooks
 * cannot intercept render errors.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom error message</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */

'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Custom fallback. Defaults to a small red alert card. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Something went wrong</p>
          {this.state.error?.message && (
            <p className="mt-1 text-xs text-red-600 font-mono">{this.state.error.message}</p>
          )}
          <button
            className="mt-3 text-xs text-red-700 underline hover:text-red-900"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
