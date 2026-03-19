'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] px-4">
          <div className="max-w-md w-full bg-white rounded  border border-[#C5A572]/20 p-3 text-center">
            <div className="mb-3">
              <div className="mx-auto w-16 h-16 rounded bg-[#C5A572]/10 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-[#C5A572]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-[#6B7280]">
                {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center px-5 py-2.5 bg-[#C5A572] text-white text-sm font-medium rounded-md hover:bg-[#B8956A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C5A572]/50"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
