import { useState } from "react";

const isBlank = value => value == null || String(value).trim() === "";

// Form validation that doesn't nag while you type:
// - checkField(key) on blur shows a problem with what you've entered (an empty field waits for submit);
// - once a field's error is showing, it updates as you type, so it clears as soon as it's fixed;
// - validateAll() on submit shows everything and bumps `attempt` (the error summary uses it).
// validate(values) returns { fieldKey: "message" } for every problem.
export function useValidation(validate, values) {
  const [shown, setShown] = useState(() => new Set());
  const [attempt, setAttempt] = useState(0);
  const all = validate(values);
  const errors = Object.fromEntries([...shown].filter(key => all[key]).map(key => [key, all[key]]));

  const checkField = key => {
    if (isBlank(values[key]) || !all[key] || shown.has(key)) return;
    setShown(prev => new Set(prev).add(key));
  };

  const validateAll = () => {
    const problems = Object.keys(all).filter(key => all[key]);
    setShown(new Set(problems));
    setAttempt(a => a + 1);
    return problems.length === 0;
  };

  const reset = () => setShown(new Set());

  return { errors, checkField, validateAll, reset, attempt };
}
