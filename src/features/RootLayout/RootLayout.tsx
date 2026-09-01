import type { ReactNode } from "react";

import { useLocale } from "../../hooks/useLocale";
import { Header } from "../Header";
import { Footer } from "../Footer";
import { ErrorBoundary } from "./ErrorBoundary";
import styles from "./RootLayout.module.css";

interface RootLayoutProps {
  readonly children: ReactNode;
}

export function RootLayout({ children }: RootLayoutProps) {
  // Subscribed here on the boundary's behalf: a class cannot call a hook, and
  // the boundary has to be a class.
  const { catalog } = useLocale();

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <ErrorBoundary
          labels={{
            message: catalog.renderFailure,
            action: catalog.renderFailureRetry,
          }}
        >
          {children}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
