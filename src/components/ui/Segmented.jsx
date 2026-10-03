// A small set of mutually exclusive options shown as one control ("Cheapest | Nearest").
// options: [{ value, label, disabled?, title?, describedBy? }]. label can include a badge.
export default function Segmented({ label, options, value, onChange, wide = false }) {
  return (
    <div className={`segmented ${wide ? "wide" : ""}`.trim()} role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "active" : ""}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          title={option.title}
          aria-describedby={option.describedBy}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
