import type { ReactNode } from "react";

import { useLocale } from "../../hooks/useLocale";
import type { DomainId } from "../../i18n/catalogs/en";
import { Header } from "../Header";
import { Footer } from "../Footer";
import { ErrorBoundary } from "./ErrorBoundary";
import styles from "./RootLayout.module.css";

interface RootLayoutProps {
  readonly children: ReactNode;
  // Which page's copy the fallback speaks. The layout is the locale subscriber
  // and resolves the copy itself, so the boundary below can stay a class.
  readonly domain: DomainId;
}

export function RootLayout({ children, domain }: RootLayoutProps) {
  // Subscribed here on the boundary's behalf, because a class cannot call a
  // hook and the boundary has to be a class.
  const { catalog } = useLocale();

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <ErrorBoundary
          labels={{
            message: catalog[domain].renderFailure,
            action: catalog.common.renderFailureRetry,
          }}
        >
          {children}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
