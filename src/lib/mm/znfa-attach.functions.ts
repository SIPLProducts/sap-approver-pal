/**
 * MM ZNFA Release — Attachment list + attachment document print.
 * Configs: ZNFA_ATTACH_API, ZNFA_ATTACH_PRINT_API
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { invokeZnfaAttachApi } from "./znfa-attach.server";

export type ZnfaAttachListResponse = {
  rows: Record<string, any>[];
  error: string | null;
  sapMessage: string | null;
};

export type ZnfaAttachPrintResponse = {
  base64: string | null;
  dataUrl: string | null;
  mimeType: string;
  error: string | null;
  sapMessage: string | null;
};

const AttachRow = z.object({
  ATTACHMENT_ID: z.string().trim().default(""),
  VENDOR: z.string().trim().default(""),
  NAME1: z.string().trim().default(""),
  NO_ATTACHMENTS: z.string().trim().default(""),
});

export const fetchZnfaAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AttachRow.parse(d))
  .handler(async ({ data }): Promise<ZnfaAttachListResponse> => {
    const payload = [
      {
        CHECK: "X",
        VENDOR: data.VENDOR,
        NAME1: data.NAME1,
        ATTACHMENT_ID: data.ATTACHMENT_ID,
        NO_ATTACHMENTS: data.NO_ATTACHMENTS,
      },
    ];

    const res = await invokeZnfaAttachApi("ZNFA_ATTACH_API", payload, "znfa-attach");
    if (res.error) return { rows: [], error: res.error, sapMessage: null };

    const json = res.json;
    const list: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.ATTACHMENTS)
        ? json.ATTACHMENTS
        : Array.isArray(json?.data)
          ? json.data
          : json && typeof json === "object"
            ? [json]
            : [];

    const rows = list.filter((r) => r && typeof r === "object") as Record<string, any>[];
    const sapMsg = res.sapMessage;
    if (sapMsg && rows.length === 0) return { rows: [], error: null, sapMessage: sapMsg };
    if (rows.length === 0) {
      return { rows: [], error: null, sapMessage: "No attachments returned by SAP." };
    }
    return { rows, error: null, sapMessage: null };
  });

export const fetchZnfaAttachPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ row: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data }): Promise<ZnfaAttachPrintResponse> => {
    const { normalizeBase64, extractBase64Payload } = await import("./znfa-attach.server");
    const res = await invokeZnfaAttachApi(
      "ZNFA_ATTACH_PRINT_API",
      [data.row],
      "znfa-attach-print",
    );
    if (res.error) {
      return { base64: null, dataUrl: null, mimeType: "application/pdf", error: res.error, sapMessage: null };
    }

    const { base64, mimeType, msg } = extractBase64Payload(res.json);
    if (!base64) {
      return {
        base64: null,
        dataUrl: null,
        mimeType: "application/pdf",
        error: null,
        sapMessage: msg || res.sapMessage || "SAP did not return a printable document",
      };
    }
    const normalized = normalizeBase64(base64);
    return {
      base64: normalized,
      dataUrl: `data:${mimeType};base64,${normalized}`,
      mimeType,
      error: null,
      sapMessage: null,
    };
  });
