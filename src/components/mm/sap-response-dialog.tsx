import { useEffect, useRef } from "react";
import { swalSapResponse } from "@/lib/mm/swal";

export interface SapResponseRow {
  /** Document / item identifier shown in the first column. */
  ref: string;
  message: string;
  ok: boolean;
  /** Optional raw SAP payload for the collapsible block. */
  response?: any;
}

export interface SapResponseDialogState {
  open: boolean;
  title: string;
  /** Header label for the first column, e.g. "PO Number", "PR / Item". */
  refLabel?: string;
  results: SapResponseRow[];
}

/**
 * Renders SAP response / error popups through SweetAlert while keeping the
 * existing state-driven prop contract used across the MM Approvals screens.
 */
export function SapResponseDialog({
  dialog,
  onOpenChange,
  defaultTitle = "SAP Response",
}: {
  dialog: SapResponseDialogState | null;
  onOpenChange: (open: boolean) => void;
  defaultTitle?: string;
}) {
  const shownRef = useRef(false);

  useEffect(() => {
    const open = !!dialog?.open;
    if (!open) {
      shownRef.current = false;
      return;
    }
    if (shownRef.current) return;
    shownRef.current = true;
    void swalSapResponse({
      title: dialog?.title ?? defaultTitle,
      refLabel: dialog?.refLabel,
      results: dialog?.results ?? [],
    }).then(() => {
      onOpenChange(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog?.open, dialog?.title, dialog?.results]);

  return null;
}
