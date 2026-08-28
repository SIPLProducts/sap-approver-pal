import { describe, expect, it } from "vitest";
import {
  candidateVariants,
  extractBase64Payload,
  normalizeBase64,
  scoreCandidate,
  stringCandidateVariants,
} from "./znfa-attach.server";

const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", "latin1");
const PDF_BASE64 = PDF_BYTES.toString("base64");
const ZIP_BASE64 = Buffer.from("PK\u0003\u0004not-the-document", "latin1").toString("base64");

describe("ZNFA attachment Base64 extraction", () => {
  it("extracts a direct PDF payload", () => {
    const result = extractBase64Payload({ PDF: PDF_BASE64, FILE_EXT: "pdf" });

    expect(result.base64).toBe(PDF_BASE64);
    expect(result.mimeType).toBe("application/pdf");
    expect(scoreCandidate(result.base64 ?? "")).toBe(4);
  });

  it("prefers a valid nested PDF over an earlier ZIP-like DATA field", () => {
    const result = extractBase64Payload({
      DATA: ZIP_BASE64,
      response: { document: { BASE64: PDF_BASE64 } },
    });

    expect(normalizeBase64(result.base64 ?? "")).toBe(PDF_BASE64);
    expect(scoreCandidate(result.base64 ?? "")).toBe(4);
  });

  it("unwraps a middleware data envelope containing PDF Base64", () => {
    const result = extractBase64Payload({
      ok: true,
      status: 200,
      data: [{ CONTENT: PDF_BASE64 }],
    });

    expect(normalizeBase64(result.base64 ?? "")).toBe(PDF_BASE64);
  });

  it("reassembles independently padded SAP line chunks", () => {
    const chunks = [
      PDF_BYTES.subarray(0, 11).toString("base64"),
      PDF_BYTES.subarray(11, 23).toString("base64"),
      PDF_BYTES.subarray(23).toString("base64"),
    ];
    const variants = candidateVariants(chunks);
    const best = variants.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];

    expect(best).toBeTruthy();
    expect(Buffer.from(normalizeBase64(best ?? ""), "base64").toString("latin1")).toBe(
      PDF_BYTES.toString("latin1"),
    );
    expect(scoreCandidate(best ?? "")).toBe(4);
  });

  it("preserves JSON-escaped slash characters in Base64", () => {
    const escaped = PDF_BASE64.replaceAll("/", "\\/");
    const result = extractBase64Payload({ PDF: escaped });

    expect(normalizeBase64(result.base64 ?? "")).toBe(PDF_BASE64);
  });

  it("keeps a prefixed MIME hint paired with its own candidate", () => {
    const result = extractBase64Payload({
      DATA: `data:application/zip;base64,${ZIP_BASE64}`,
      response: { document: { BASE64: PDF_BASE64 } },
    });

    expect(normalizeBase64(result.base64 ?? "")).toBe(PDF_BASE64);
    expect(result.mimeType).toBe("application/pdf");
  });

  it("unwraps a double-encoded middleware response", () => {
    const response = JSON.stringify(JSON.stringify({ data: [{ CONTENT: PDF_BASE64 }] }));
    const result = extractBase64Payload(response);

    expect(normalizeBase64(result.base64 ?? "")).toBe(PDF_BASE64);
    expect(scoreCandidate(result.base64 ?? "")).toBe(4);
  });

  it("reassembles padded chunks stored in one string", () => {
    const chunks = [
      PDF_BYTES.subarray(0, 11).toString("base64"),
      PDF_BYTES.subarray(11, 23).toString("base64"),
      PDF_BYTES.subarray(23).toString("base64"),
    ];
    const result = extractBase64Payload({ CONTENT: chunks.join("\\n") });

    expect(normalizeBase64(result.base64 ?? "")).toBe(PDF_BASE64);
    expect(scoreCandidate(result.base64 ?? "")).toBe(4);
  });

  it("generates a valid PDF candidate from interior padding boundaries", () => {
    const chunks = [
      PDF_BYTES.subarray(0, 11).toString("base64"),
      PDF_BYTES.subarray(11, 23).toString("base64"),
      PDF_BYTES.subarray(23).toString("base64"),
    ];
    const variants = stringCandidateVariants(chunks.join(""));
    const best = variants.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];

    expect(normalizeBase64(best ?? "")).toBe(PDF_BASE64);
  });
});