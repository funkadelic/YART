import { useState } from "react";

import type { ResolvedTheme, ThemeChoice } from "../theme/resolveTheme";

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const resolved: ResolvedTheme = "light";

  return { choice, setChoice, resolved };
}
