// Suggestion types and statuses, shared by the form, the list and the admin controls.
export const SUGGESTION_TYPES = [
  { key: "idea", label: "Idea", icon: "💡", placeholder: "What would make Pub Bingo better?" },
  { key: "pub", label: "Add a pub", icon: "🍺", placeholder: "Which pub, and where? Anything we should know (website, prices, events)?" },
  { key: "problem", label: "Something's wrong", icon: "⚠️", placeholder: "What went wrong, or which price/detail is out of date?" },
  { key: "other", label: "Other", icon: "💬", placeholder: "Anything else on your mind?" }
];
export const SUGGESTION_STATUS = {
  new: { label: "New", tone: "new" },
  reviewed: { label: "Seen", tone: "seen" },
  planned: { label: "Planned", tone: "planned" },
  in_progress: { label: "In progress", tone: "planned" },
  done: { label: "Done", tone: "done" },
  rejected: { label: "Not doing", tone: "rejected" }
};
