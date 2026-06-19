import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const retry = () => {
        this.setState({ hasError: false, error: undefined });
        this.props.onRetry?.();
      };
      return this.props.fallback || (
        <div role="alert" className="flex flex-col items-center justify-center min-h-[50vh] gap-3 p-6">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Something went wrong</p>
          <p className="text-xs text-slate-500 max-w-xs text-center font-mono">{this.state.error?.message}</p>
          <div className="flex gap-2 mt-2">
            <button type="button"
              onClick={retry}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
            >
              Try Again
            </button>
            <button type="button"
              onClick={() => { location.reload(); }}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}