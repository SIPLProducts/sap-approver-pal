/**
 * Public server function invoked from the login form.
 * Calls the SAP API named "Login_API" (configured in SAP API Settings) with
 * payload { LOGIN: { USER, PASSWORD } } and returns ok/status only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SapProfilePayload = {
  user: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  contact?: string;
  plants: Array<{
    code: string;
    name?: string;
    roles: Array<{ role: string; label?: string; activities: string[] }>;
  }>;
};

type SapLoginResult = {
  ok: boolean;
  status: number;
  error?: string;
  email?: string;
  tokenHash?: string;
  profile?: SapProfilePayload;
};

function pickStr(r: Record<string, unknown> | null | undefined, ...keys: string[]): string | undefined {
  if (!r) return undefined;
  for (const k of keys) {
    const v = r[k] ?? r[k.toLowerCase()] ?? r[k.toUpperCase()];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return [v];
  return [];
}

function pickValue(r: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  if (!r) return undefined;
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(r)) {
      if (k.toLowerCase() === lower) return v;
    }
  }
  return undefined;
}

function collectActivityCodes(value: unknown, depth = 0): string[] {
  if (depth > 6 || value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const code = String(value).trim().toUpperCase();
    return code ? [code] : [];
  }
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((item) => collectActivityCodes(item, depth + 1))));
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const out: string[] = [];
  for (const key of ["ACTIVITY", "SCREEN", "CODE"]) {
    const direct = pickValue(record, key);
    if (typeof direct === "string" || typeof direct === "number") {
      const code = String(direct).trim().toUpperCase();
      if (code) out.push(code);
    }
  }
  for (const key of ["ACTIVITIES", "ACTIVITY", "SCREENS", "SCREEN"]) {
    const nested = pickValue(record, key);
    if (nested !== undefined && nested !== value && typeof nested !== "string" && typeof nested !== "number") {
      out.push(...collectActivityCodes(nested, depth + 1));
    }
  }
  return Array.from(new Set(out));
}

function extractSapProfile(body: unknown): SapProfilePayload | undefined {
  // Find the first object in the response that has a USER + PLANTS shape.
  const queue: unknown[] = [body];
  let found: Record<string, unknown> | null = null;
  let depth = 0;
  while (queue.length && depth < 200) {
    depth += 1;
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const item of cur) queue.push(item);
      continue;
    }
    const rec = cur as Record<string, unknown>;
    const hasUser =
      pickStr(rec, "USER", "USERID", "USER_ID", "USERNAME") !== undefined;
    const hasPlants = "PLANTS" in rec || "plants" in rec;
    if (hasUser && hasPlants) {
      found = rec;
      break;
    }
    for (const v of Object.values(rec)) queue.push(v);
  }
  if (!found) return undefined;

  const plantsRaw = asArray((found as any).PLANTS ?? (found as any).plants);
  type R = { role: string; label?: string; activities: string[] };
  type P = { code: string; name?: string; roles: R[] };
  const plants: P[] = [];
  for (const p of plantsRaw) {
    const pr = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const code = pickStr(pr, "PLANT", "PLANT_CODE", "CODE", "WERKS");
    if (!code) continue;
    const name = pickStr(pr, "PLANT_NAME", "NAME", "DESCRIPTION");
    const rolesRaw = asArray((pr as any).ROLES ?? (pr as any).roles);
    const roles: R[] = [];
    for (const r of rolesRaw) {
      const rr = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const role = pickStr(rr, "ROLE", "ROLE_CODE", "ROLE_ID");
      if (!role) continue;
      const label = pickStr(rr, "ROLE_DES", "ROLE_NAME", "DESCRIPTION");
      const actsRaw =
        pickValue(rr, "ACTIVITIES") ??
        pickValue(rr, "ACTIVITY") ??
        pickValue(rr, "SCREENS") ??
        pickValue(rr, "SCREEN");
      const activities = collectActivityCodes(actsRaw ?? rr);
      roles.push({ role, label, activities: Array.from(new Set(activities)) });
    }
    plants.push({ code, name, roles });
  }

  return {
    user: pickStr(found, "USER", "USERID", "USER_ID", "USERNAME") ?? "",
    firstName: pickStr(found, "FIRST_NAME", "FIRSTNAME"),
    lastName: pickStr(found, "LAST_NAME", "LASTNAME"),
    email: pickStr(found, "EMAIL"),
    status: pickStr(found, "STATUS"),
    contact: pickStr(found, "CONTACT", "PHONE", "MOBILE"),
    plants,
  };
}

function parseResponseBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function statusValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function collectObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectObjects(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];
  return [record, ...Object.values(record).flatMap((item) => collectObjects(item, depth + 1))];
}

function sapLoginSucceeded(body: unknown): boolean {
  const records = collectObjects(body);
  if (records.some((record) => record.ok === true || record.success === true)) return true;

  return records.some((record) => {
    const values = Object.entries(record).map(([key, value]) => [key.toLowerCase(), stringValue(value).trim().toLowerCase()] as const);
    const status = values.find(([key]) => /^(status|code|returncode|responsecode|type|result)$/.test(key))?.[1];
    const message = values.find(([key]) => /^(message|msg|text|description|remarks|returnmessage)$/.test(key))?.[1] ?? "";

    if (["s", "success", "successful", "ok", "true", "200"].includes(status ?? "")) return true;
    if (message && /\b(login\s*success|authenticated|welcome)\b/i.test(message)) return true;
    return false;
  });
}

function sapLoginRejected(body: unknown): boolean {
  return collectObjects(body).some((record) => {
    if (record.ok === false || record.success === false) return true;
    const text = Object.entries(record)
      .filter(([key]) => /^(error|message|msg|text|description|remarks|returnmessage|status|code|type|result)$/i.test(key))
      .map(([, value]) => stringValue(value).trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
    return /\b(fail|failed|failure|invalid|denied|reject|rejected|unauthorized|forbidden|locked|incorrect|wrong|not successful)\b/i.test(text);
  });
}

function loginErrorFromBody(body: unknown, fallback: string): string {
  const record = asRecord(body);
  if (typeof record?.error === "string") return record.error;
  const nested = record?.data;
  const nestedRecord = asRecord(nested);
  if (typeof nestedRecord?.error === "string") return nestedRecord.error;
  if (typeof nestedRecord?.message === "string") return nestedRecord.message;
  if (typeof nested === "string" && nested.trim()) return nested.slice(0, 200);
  if (typeof body === "string" && body.trim()) return body.slice(0, 200);
  if (body != null) return JSON.stringify(body).slice(0, 200);
  return fallback;
}

function syntheticSapEmail(username: string): string {
  const local = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .slice(0, 64)
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  return `${local || "sap-user"}@sap-login.invalid`;
}

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
}

async function createBackendSessionForSapUser(supabaseAdmin: any, username: string) {
  const sapUserId = username.trim();

  // 1. Try to match an admin-provisioned profile by sap_user_id
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, sap_user_id, full_name")
    .ilike("sap_user_id", sapUserId)
    .maybeSingle();

  let userId: string | undefined = existingProfile?.id;
  let email: string =
    existingProfile?.email && /@/.test(existingProfile.email)
      ? existingProfile.email
      : syntheticSapEmail(sapUserId);

  // 2. Ensure an auth.users row exists for this profile/email
  let authUser = await findAuthUserByEmail(supabaseAdmin, email);

  if (!authUser && userId) {
    // Profile exists but no auth user yet — create one bound to the profile id
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      id: userId,
      email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: {
        full_name: existingProfile?.full_name || sapUserId,
        sap_user_id: sapUserId,
        auth_source: "sap",
      },
    });
    if (error && !/already|exist|registered/i.test(error.message)) throw error;
    authUser = data?.user ?? (await findAuthUserByEmail(supabaseAdmin, email));
  }

  if (!authUser && !userId) {
    // No profile, no auth user — create both via synthetic email
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: {
        full_name: sapUserId,
        sap_user_id: sapUserId,
        auth_source: "sap",
      },
    });
    if (error && !/already|exist|registered/i.test(error.message)) throw error;
    authUser = data?.user ?? (await findAuthUserByEmail(supabaseAdmin, email));
  }

  if (!authUser?.id) throw new Error("Could not create backend session for SAP user.");
  userId = authUser.id;

  // 3. Ensure profile exists; do not overwrite existing fields
  if (!existingProfile) {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: sapUserId,
        email,
        sap_user_id: sapUserId,
        status: "Active",
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;
  } else {
    // Backfill sap_user_id only if missing
    if (!existingProfile.sap_user_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ sap_user_id: sapUserId })
        .eq("id", userId);
    }
  }

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const tokenHash = link?.properties?.hashed_token;
  if (!tokenHash) throw new Error("Could not create backend login token.");

  return { email, tokenHash, userId };
}

async function persistSapProfile(supabaseAdmin: any, userId: string, profile: SapProfilePayload) {
  try {
    await supabaseAdmin.from("profiles").update({ sap_profile: profile }).eq("id", userId);
  } catch {
    /* ignore — best effort */
  }
}

export const sapLogin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        username: z.string().min(1).max(200),
        password: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<SapLoginResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("sap_api_configs")
      .select("*")
      .eq("name", "Login_API")
      .eq("is_active", true)
      .maybeSingle();

    if (!cfg) {
      return {
        ok: false,
        status: 0,
        error: "Login_API is not configured in SAP API Settings",
      };
    }

    const payload = { LOGIN: { USER: data.username, PASSWORD: data.password } };
    const t0 = Date.now();
    let ok = false;
    let status = 0;
    let message = "";
    let error: string | undefined;
    let session: { email: string; tokenHash: string; userId?: string } | undefined;
    let profile: SapProfilePayload | undefined;
    let loginPath = "direct";

    try {
      const [{ data: g }, { data: gs }] = await Promise.all([
        supabaseAdmin
          .from("sap_global_settings")
          .select("middleware_url, sap_base_url, sap_username")
          .eq("id", "default")
          .maybeSingle(),
        supabaseAdmin
          .from("sap_global_secrets")
          .select("proxy_secret, sap_password")
          .eq("id", "default")
          .maybeSingle(),
      ]);

      if (g?.middleware_url) {
        loginPath = "middleware";
        const url = `${g.middleware_url.replace(/\/$/, "")}/login/Login_API`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (gs?.proxy_secret) headers["x-shared-secret"] = gs.proxy_secret;
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ inputs: payload }),
        });
        const rawText = await res.text().catch(() => "");
        const body = parseResponseBody(rawText);
        const bodyRecord = asRecord(body);
        ok = res.ok && sapLoginSucceeded(body) && !sapLoginRejected(body);
        if (ok) profile = extractSapProfile(body);
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${status}`;
        if (!ok) {
          if (res.status === 401) {
            error = "Middleware rejected the shared secret. Check the proxy secret configuration.";
          } else if (res.status === 404) {
            error = "Middleware login route was not found. Restart or redeploy the Node middleware.";
          } else if (res.status === 403) {
            error = loginErrorFromBody(body, "SAP rejected the login request (403).");
          } else {
            error = loginErrorFromBody(body, `Login failed (${status})`);
          }
        }
      } else {
        const { data: creds } = await supabaseAdmin
          .from("sap_api_credentials")
          .select("extra_headers")
          .eq("config_id", cfg.id)
          .maybeSingle();

        const { resolveSapUrl } = await import("@/lib/sap/url");
        const target = resolveSapUrl(cfg.endpoint_url, g?.sap_base_url ?? null);
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (cfg.auth_type === "basic" && g?.sap_username && gs?.sap_password) {
          headers.Authorization =
            "Basic " + Buffer.from(`${g.sap_username}:${gs.sap_password}`).toString("base64");
        }
        for (const [k, v] of Object.entries(
          (creds?.extra_headers ?? {}) as Record<string, string>,
        )) {
          headers[k] = v;
        }

        const method = (cfg.http_method ?? "POST").toUpperCase();
        const res = await fetch(target, {
          method,
          headers,
          body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(payload),
        });
        const rawText = await res.text().catch(() => "");
        const body = parseResponseBody(rawText);
        const bodyRecord = asRecord(body);
        ok = res.ok && sapLoginSucceeded(body) && !sapLoginRejected(body);
        if (ok) profile = extractSapProfile(body);
        status = statusValue(bodyRecord?.status) ?? res.status;
        message = `${res.status} ${res.statusText}`;
        if (!ok) {
          error = loginErrorFromBody(body, `Invalid SAP credentials (${res.status})`);
        }
      }

      if (ok) {
        session = await createBackendSessionForSapUser(supabaseAdmin, data.username);
        if (profile && (session as any)?.userId) {
          await persistSapProfile(supabaseAdmin, (session as any).userId, profile);
        }
      }
    } catch (e) {
      ok = false;
      message = (e as Error).message;
      error = message;
    }

    await supabaseAdmin.from("sap_api_sync_log").insert({
      config_id: cfg.id,
      status: ok ? "ok" : "error",
      latency_ms: Date.now() - t0,
      message: `login ${loginPath}: ${message}`,
    });

    return { ok, status, error, email: session?.email, tokenHash: session?.tokenHash, profile };
  });
