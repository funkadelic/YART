import { Component } from "react";

import styles from "./RootLayout.module.css";

import type { ReactNode } from "react";

/**
 * The fallback's two strings, as props because a class cannot call a hook. The
 * fallback shows this authored copy and never the throw's own message, which is
 * engine text and mild information disclosure.
 */
export interface ErrorBoundaryLabels {
  readonly message: string;
  readonly action: string;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  labels: ErrorBoundaryLabels;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// The only render-fallback mechanism React offers. It cannot catch a promise
// rejection, which is why the table keeps its own inline error region.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  // The reporting lifecycle method is omitted; a client-only bundle has nowhere to send a report.

  // Resetting state re-renders the children. A reload would re-download the
  // whole dataset to recover from a probably render-local fault.
  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      // a11y: role alert, because the content it replaces is gone. Same
      // reasoning the inline error region already records.
      return (
        <div className={styles.fallback} role="alert">
          <p>{this.props.labels.message}</p>
          <button
            type="button"
            className={styles.fallbackButton}
            onClick={this.handleReset}
          >
            {this.props.labels.action}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
