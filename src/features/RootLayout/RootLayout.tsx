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
  // The layout subscribes to the locale on the boundary's behalf. A class
  // component cannot call a hook, and the boundary below has to be a class
  // because that is the only render-fallback mechanism React offers, so its two
  // strings are read here and handed down.
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
