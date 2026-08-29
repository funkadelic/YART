import { Component } from "react";

import styles from "./RootLayout.module.css";

import type { ReactNode } from "react";

/**
 * The fallback's two strings.
 *
 * They arrive as props rather than being read from the catalog here, and the
 * reason is the class: this is the only render-fallback mechanism React offers
 * and it can only be a class component, so it cannot call a hook. Its parent is
 * the locale subscriber and hands the copy down.
 *
 * The fallback shows this authored copy and nothing else. A render-time throw's
 * own message is whatever the engine produced, so it would be noise on screen
 * and mild information disclosure, and the surrounding sentence would have to
 * work as a frame around an arbitrary string.
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

// The only render-fallback mechanism React offers. The root error callbacks
// added in React 19 report a caught error but render nothing, so they are not
// an alternative to this. Boundaries also cannot catch a promise rejection,
// which is why the table keeps its own inline error region beside this one.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  // The reporting lifecycle method is omitted; a client-only bundle has nowhere to send a report.

  // Resetting the boundary's own state re-renders the children. A document
  // reload would throw away the fetched dataset and re-download roughly three
  // megabytes to recover from what is most likely a render-local fault.
  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      // a11y: alert rather than status, because the content it replaces is
      // gone. Same reasoning the inline error region already records.
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
