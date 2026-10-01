import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/monitoring';

/**
 * Last line of defence: if rendering crashes, show a way out instead of a blank page, and report
 * the error. Data on the server is never affected by a crash here.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error);
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center"
      >
        <p className="font-display text-3xl font-bold text-gray-900">Something went wrong</p>
        <p className="mt-2 max-w-sm text-gray-600">
          Sorry about that. We’ve been told about the problem. Reloading the page usually fixes it.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Reload
          </button>
          <a
            href="/"
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Go to the home page
          </a>
        </div>
      </div>
    );
  }
}
