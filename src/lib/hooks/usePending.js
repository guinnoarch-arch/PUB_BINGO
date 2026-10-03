import { useCallback, useRef, useState } from "react";

// Tracks which async actions are running, so their buttons can be disabled and a fast double-click
// can't start the same action twice. Keys are anything that identifies the action (an id, "save"…).
export function usePending() {
  const running = useRef(new Set());
  const [, setVersion] = useState(0);

  const run = useCallback(async (key, task) => {
    if (running.current.has(key)) return undefined;
    running.current.add(key);
    setVersion(v => v + 1);
    try {
      return await task();
    } finally {
      running.current.delete(key);
      setVersion(v => v + 1);
    }
  }, []);

  const isPending = useCallback(key => running.current.has(key), []);
  return { run, isPending };
}
