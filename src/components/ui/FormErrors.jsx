import { useEffect, useRef } from "react";
import { CircleAlert } from "lucide-react";

// Errors are never shown by colour alone: each has an icon and text, and the field gets a red border
// through aria-invalid (see global.css).

// The id of a field's error message, for aria-describedby.
export const errorIdFor = fieldId => `${fieldId}-error`;

// Props that link a field to its error: red border via aria-invalid, and the message read out.
function fieldErrorProps(fieldId, error) {
  return { "aria-invalid": Boolean(error), "aria-describedby": error ? errorIdFor(fieldId) : undefined };
}

// The error under one field. id must match the field's aria-describedby.
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <span id={id} className="field-error">
      <CircleAlert className="error-icon" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

// For a form with several fields: props(key) links a field to its error, message(key) renders it.
// fieldIds: { fieldKey: "dom-id" }
export function fieldErrorBinding(errors, fieldIds) {
  return {
    props: key => fieldErrorProps(fieldIds[key], errors[key]),
    message: key => <FieldError id={errorIdFor(fieldIds[key])}>{errors[key]}</FieldError>
  };
}

// A form-level error, e.g. "Can't reach Pub Bingo" after submitting.
export function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="form-error" role="alert">
      <CircleAlert className="error-icon" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// Shown at the top of a form when submitting finds more than one problem. Each item links to its
// field. Takes focus so keyboard and screen-reader users land on it.
// errors: { fieldKey: "message" }; fieldIds: { fieldKey: "dom-id" }
export function ErrorSummary({ errors, fieldIds, attempt }) {
  const ref = useRef(null);
  // In the order the fields appear on the page (fieldIds is listed in that order).
  const entries = Object.keys(fieldIds).filter(key => errors?.[key]).map(key => [key, errors[key]]);
  const show = entries.length > 1;
  useEffect(() => {
    if (show) ref.current?.focus();
  }, [show, attempt]);
  if (!show) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <p className="error-summary-title">
        <CircleAlert className="error-icon" aria-hidden="true" />
        <span>There are {entries.length} things to fix:</span>
      </p>
      <ul>
        {entries.map(([key, message]) => (
          <li key={key}>
            <a href={`#${fieldIds[key]}`} onClick={event => { event.preventDefault(); document.getElementById(fieldIds[key])?.focus(); }}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Marks a field as required next to its label. The input also gets aria-required.
export function Required() {
  return <span className="required-mark" aria-hidden="true"> *</span>;
}

export function RequiredHint() {
  return <p className="muted small-text required-hint">Fields marked <span className="required-mark">*</span> are required.</p>;
}
