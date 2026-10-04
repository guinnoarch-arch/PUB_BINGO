import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Keeps a piece of page state (a filter, a tab) in the address bar, so refresh, sharing a link and
// back/forward all keep it. setParam(key, value) clears the key when value is empty; arrays are
// stored comma-separated.
export function useUrlParams() {
  const [params, setParams] = useSearchParams();
  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      const text = Array.isArray(value) ? value.join(",") : value;
      if (text) next.set(key, text); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);
  return [params, setParam];
}

// "a,b,c" → ["a", "b", "c"]
export const listParam = value => (value ? value.split(",").filter(Boolean) : []);
