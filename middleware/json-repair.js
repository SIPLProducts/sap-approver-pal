// JSON parsing helpers for SAP responses. Some SAP endpoints return almost-JSON
// with either missing values (`"FIELD": ,`) or raw control characters inside
// quoted strings. Native JSON.parse rejects those responses, so the middleware
// repairs only the JSON syntax problems while preserving the response data.

function escapeJsonControlChar(ch) {
  switch (ch) {
    case "\b": return "\\b";
    case "\f": return "\\f";
    case "\n": return "\\n";
    case "\r": return "\\r";
    case "\t": return "\\t";
    default: return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
  }
}

export function repairSapJsonText(text) {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        // Preserve existing valid escape sequences. If SAP sends a backslash
        // followed by a literal control char, complete it as a valid escape.
        out += ch.charCodeAt(0) <= 0x1f ? escapeJsonControlChar(ch).slice(1) : ch;
        escape = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch.charCodeAt(0) <= 0x1f) {
        out += escapeJsonControlChar(ch);
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ":") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && (text[j] === "," || text[j] === "}" || text[j] === "]")) {
        out += ": null";
        i = j - 1;
        continue;
      }
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && (text[j] === "}" || text[j] === "]")) {
        i = j - 1;
        continue;
      }
    }

    out += ch;
  }

  return out;
}

export function safeParseSapJson(text) {
  if (text == null || text === "") return { value: null, repaired: false };
  try {
    return { value: JSON.parse(text), repaired: false };
  } catch {}

  const repairedText = repairSapJsonText(String(text));
  try {
    return { value: JSON.parse(repairedText), repaired: true };
  } catch (e) {
    return {
      value: { __parse_error: e.message, __raw_preview: String(text).slice(0, 1000) },
      repaired: true,
    };
  }
}