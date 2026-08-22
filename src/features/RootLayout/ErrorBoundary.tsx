import { Component } from "react";

import styles from "./RootLayout.module.css";

import type { ReactNode } from "react";

// The fallback shows authored copy and nothing else. A render-time throw's own
// message is whatever the engine produced, so it would be noise on screen and
// mild information disclosure, and the surrounding sentence would have to work
// as a frame around an arbitrary string.
const FALLBACK_MESSAGE =
  "This part of the page could not be displayed. The city data is still loaded, so showing it again may work.";
const RECOVERY_LABEL = "Show it again";

export interface ErrorBoundaryProps {
  children: ReactNode;
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
          <p>{FALLBACK_MESSAGE}</p>
          <button
            type="button"
            className={styles.fallbackButton}
            onClick={this.handleReset}
          >
            {RECOVERY_LABEL}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
