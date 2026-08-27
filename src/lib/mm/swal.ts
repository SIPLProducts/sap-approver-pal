/**
 * Brand-styled SweetAlert helpers for the MM Approvals screens.
 *
 * SweetAlert2 touches `document` on import, so it is always loaded lazily
 * inside the helpers (keeps SSR/prerender safe).
 */

export interface SwalResultRow {
  ref: string;
  message: string;
  ok: boolean;
  response?: any;
}

export interface SwalSapResponseOptions {
  title?: string;
  /** Header label for the first column, e.g. "PO Number", "PR / Item". */
  refLabel?: string;
  results: SwalResultRow[];
}

const CUSTOM_CLASS = {
  container: "swal-brand-container",
  popup: "swal-brand-popup",
  title: "swal-brand-title",
  htmlContainer: "swal-brand-html",
  actions: "swal-brand-actions",
  confirmButton: "swal-brand-confirm",
  cancelButton: "swal-brand-cancel",
};

async function loadSwal() {
  const [{ default: Swal }] = await Promise.all([
    import("sweetalert2"),
    import("sweetalert2/dist/sweetalert2.min.css"),
  ]);
  return Swal;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(opts: SwalSapResponseOptions): string {
  const results = opts.results ?? [];
  const refLabel = escapeHtml(opts.refLabel ?? "Document");
  const singleMessageOnly =
    results.length === 1 && !results[0]?.response && !results[0]?.ref;

  if (singleMessageOnly) {
    const r = results[0]!;
    return `<p class="swal-brand-message ${r.ok ? "is-ok" : "is-error"}">${escapeHtml(
      r.message || "-",
    )}</p>`;
  }

  const rows = results
    .map(
      (r) => `<tr>
        <th scope="row">${escapeHtml(r.ref || "—")}</th>
        <td class="${r.ok ? "is-ok" : "is-error"}">${escapeHtml(r.message || "-")}</td>
      </tr>`,
    )
    .join("");

  const raw = results
    .map(
      (r, i) => `<details class="swal-brand-raw">
        <summary>Raw response${r.ref ? ` — ${escapeHtml(r.ref)}` : ` #${i + 1}`}</summary>
        <pre>${escapeHtml(JSON.stringify(r.response ?? { message: r.message }, null, 2))}</pre>
      </details>`,
    )
    .join("");

  return `<div class="swal-brand-body">
    <div class="swal-brand-table-wrap">
      <table class="swal-brand-table">
        <thead><tr><th>${refLabel}</th><th>Message</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${raw}
  </div>`;
}

/** Shows the SAP response / error popup. Resolves when the popup closes. */
export async function swalSapResponse(opts: SwalSapResponseOptions): Promise<void> {
  const Swal = await loadSwal();
  const anyError = (opts.results ?? []).some((r) => !r.ok);
  await Swal.fire({
    title: opts.title || "SAP Response",
    html: buildHtml(opts),
    icon: anyError ? "error" : "success",
    confirmButtonText: "Close",
    width: (opts.results?.length ?? 0) > 1 ? 720 : 560,
    buttonsStyling: false,
    customClass: CUSTOM_CLASS,
    heightAuto: false,
    scrollbarPadding: false,
  });
}

export interface SwalConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Uses destructive styling on the confirm button. Default true. */
  destructive?: boolean;
}

/** Brand-styled confirm popup. Resolves true only when confirmed. */
export async function swalConfirm(opts: SwalConfirmOptions): Promise<boolean> {
  const Swal = await loadSwal();
  const res = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: opts.confirmLabel ?? "Confirm",
    cancelButtonText: opts.cancelLabel ?? "Cancel",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    customClass: {
      ...CUSTOM_CLASS,
      confirmButton:
        opts.destructive === false ? "swal-brand-confirm" : "swal-brand-confirm is-destructive",
    },
  });
  return res.isConfirmed === true;
}
