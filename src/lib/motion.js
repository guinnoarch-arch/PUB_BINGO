// Respect the "reduce motion" setting for movement started from code (CSS handles the rest).
export function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export const scrollBehavior = () => (prefersReducedMotion() ? "auto" : "smooth");
