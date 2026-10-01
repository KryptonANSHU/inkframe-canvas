import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from './reportError';

type ErrorBoundaryProps = {
  /** Names the area in the error report, e.g. "File bar". */
  readonly area: string;
  /** Shown in place of the children once they fail. */
  readonly fallback: ReactNode;
  readonly children: ReactNode;
};

type ErrorBoundaryState = { readonly failed: boolean };

/**
 * Keeps a render failure inside one area: the rest of the UI, the canvas, and the
 * document keep working. React can only catch render errors in a class component,
 * so this is the one class in the codebase.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(
      new Error(`${this.props.area} failed: ${error.message}`, {
        cause: { error, componentStack: info.componentStack },
      }),
    );
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
