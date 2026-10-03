import { useApp } from "../AppContext.jsx";
import { friendlyError } from "../api/errors.js";
import { usePending } from "./usePending.js";

// Admin: hide a price report (the drink goes back to its previous price) or restore it.
export function useHideReport() {
  const { api, toast, notifyChange } = useApp();
  const { run, isPending } = usePending();
  const toggleHidden = report => run(report.id, async () => {
    try {
      await api.admin.setReportHidden(report.id, !report.is_hidden);
      toast(report.is_hidden ? "Report restored." : "Report hidden. The price has gone back to the one before it.", "success");
      notifyChange();
    } catch (err) {
      toast(friendlyError(err, "Couldn't change the report."), "error");
    }
  });
  return { toggleHidden, isHiding: isPending };
}
