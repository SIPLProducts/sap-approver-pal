import { supabase } from "./lib/supabase.js";

export type FieldRow = {
  field_name: string;
  source: "static" | "column" | "expr" | "secret";
  default_value: string | null;
  required: boolean;
  sort_order: number;
};

export type ResponseFieldRow = {
  field_name: string;
  target_table: string | null;
  target_column: string | null;
  transform_expr: string | null;
  sort_order: number;
};

export type ResolvedConfig = {
  id: string;
  name: string;
  module: string;
  endpoint_url: string;
  http_method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  auth_type: "basic" | "oauth" | "none" | "proxy";
  is_active: boolean;
  updated_at: string;
  credentials: {
    username: string | null;
    password: string | null;
    extra_headers: Record<string, string>;
  };
  requestFields: FieldRow[];
  responseFields: ResponseFieldRow[];
};

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; updated_at: string; cfg: ResolvedConfig }>();

export async function loadConfig(configId: string): Promise<ResolvedConfig> {
  const cached = cache.get(configId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cfg;

  const { data: cfg, error } = await supabase
    .from("sap_api_configs")
    .select("*")
    .eq("id", configId)
    .maybeSingle();
  if (error) throw new Error(`Load config failed: ${error.message}`);
  if (!cfg) throw new Error(`Config not found: ${configId}`);
  if (!cfg.is_active) throw new Error(`Config is inactive: ${configId}`);

  if (cached && cached.updated_at === cfg.updated_at) {
    cached.at = Date.now();
    return cached.cfg;
  }

  const [{ data: creds }, { data: reqFields }, { data: resFields }] = await Promise.all([
    supabase.from("sap_api_credentials").select("*").eq("config_id", configId).maybeSingle(),
    supabase.from("sap_api_request_fields").select("*").eq("config_id", configId).order("sort_order"),
    supabase.from("sap_api_response_fields").select("*").eq("config_id", configId).order("sort_order"),
  ]);

  const resolved: ResolvedConfig = {
    id: cfg.id,
    name: cfg.name,
    module: cfg.module,
    endpoint_url: cfg.endpoint_url,
    http_method: cfg.http_method,
    auth_type: cfg.auth_type,
    is_active: cfg.is_active,
    updated_at: cfg.updated_at,
    credentials: {
      username: creds?.username ?? null,
      password: creds?.password_encrypted ?? null,
      extra_headers: (creds?.extra_headers ?? {}) as Record<string, string>,
    },
    requestFields: (reqFields ?? []) as FieldRow[],
    responseFields: (resFields ?? []) as ResponseFieldRow[],
  };

  cache.set(configId, { at: Date.now(), updated_at: cfg.updated_at, cfg: resolved });
  return resolved;
}

export function invalidateConfigCache(configId?: string) {
  if (configId) cache.delete(configId);
  else cache.clear();
}
