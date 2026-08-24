import type { ReactNode } from "react";

import { Header } from "../Header";
import { Footer } from "../Footer";
import { ErrorBoundary } from "./ErrorBoundary";
import styles from "./RootLayout.module.css";

interface RootLayoutProps {
  readonly children: ReactNode;
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
