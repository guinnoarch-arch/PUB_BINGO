import { ExternalLink as ExternalLinkIcon } from "lucide-react";

// A link to another website. Opens in a new tab, and says so to screen readers.
export default function ExternalLink({ href, children, className = "", ...rest }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`external-link ${className}`.trim()} {...rest}>
      {children}
      <ExternalLinkIcon aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
