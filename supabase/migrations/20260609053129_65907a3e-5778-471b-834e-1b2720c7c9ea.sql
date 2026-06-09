
-- =========== USER MANAGEMENT ===========

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tenants" ON public.tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages tenants" ON public.tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.user_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenants TO authenticated;
GRANT ALL ON public.user_tenants TO service_role;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own tenant links" ON public.user_tenants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Admin manages user_tenants" ON public.user_tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated reads custom_roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages custom_roles" ON public.custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, custom_role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_roles TO authenticated;
GRANT ALL ON public.user_custom_roles TO service_role;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own custom roles" ON public.user_custom_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Admin manages user_custom_roles" ON public.user_custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  built_in_role public.app_role,
  screen_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('view','create','edit','delete','approve','export')),
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((custom_role_id IS NOT NULL)::int + (built_in_role IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX role_permissions_custom_uq ON public.role_permissions (custom_role_id, screen_key, action) WHERE custom_role_id IS NOT NULL;
CREATE UNIQUE INDEX role_permissions_builtin_uq ON public.role_permissions (built_in_role, screen_key, action) WHERE built_in_role IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated reads role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.approval_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage_no int NOT NULL,
  role_key text NOT NULL,
  min_amount numeric(18,2) NOT NULL DEFAULT 0,
  max_amount numeric(18,2),
  currency text NOT NULL DEFAULT 'INR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, stage_no, role_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_matrix TO authenticated;
GRANT ALL ON public.approval_matrix TO service_role;
ALTER TABLE public.approval_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated reads approval_matrix" ON public.approval_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages approval_matrix" ON public.approval_matrix FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_table text,
  target_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads audit" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Admin inserts audit" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Admin') AND actor_id = auth.uid());

-- =========== SAP API SETTINGS ===========

CREATE TABLE public.sap_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  module text NOT NULL DEFAULT 'COMMON' CHECK (module IN ('MM','SD','COMMON')),
  endpoint_url text NOT NULL,
  http_method text NOT NULL DEFAULT 'GET' CHECK (http_method IN ('GET','POST','PUT','PATCH','DELETE','HEAD')),
  auth_type text NOT NULL DEFAULT 'basic' CHECK (auth_type IN ('basic','oauth','none','proxy')),
  middleware_url text,
  proxy_secret_ref text,
  api_type text NOT NULL DEFAULT 'fetch' CHECK (api_type IN ('sync','fetch')),
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  schedule_cron text,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sap_api_configs TO authenticated;
GRANT ALL ON public.sap_api_configs TO service_role;
ALTER TABLE public.sap_api_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads sap_api_configs" ON public.sap_api_configs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Admin manages sap_api_configs" ON public.sap_api_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.sap_api_credentials (
  config_id uuid PRIMARY KEY REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  username text,
  password_encrypted text,
  extra_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sap_api_credentials TO service_role;
ALTER TABLE public.sap_api_credentials ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: only service_role can touch this table.

CREATE TABLE public.sap_api_request_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  source text NOT NULL DEFAULT 'static' CHECK (source IN ('static','column','expr','secret')),
  default_value text,
  required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sap_api_request_fields TO authenticated;
GRANT ALL ON public.sap_api_request_fields TO service_role;
ALTER TABLE public.sap_api_request_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages request fields" ON public.sap_api_request_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.sap_api_response_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  target_table text,
  target_column text,
  transform_expr text,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sap_api_response_fields TO authenticated;
GRANT ALL ON public.sap_api_response_fields TO service_role;
ALTER TABLE public.sap_api_response_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages response fields" ON public.sap_api_response_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Admin')) WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TABLE public.sap_api_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  latency_ms int,
  rows_processed int,
  message text
);
GRANT SELECT, INSERT ON public.sap_api_sync_log TO authenticated;
GRANT ALL ON public.sap_api_sync_log TO service_role;
ALTER TABLE public.sap_api_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads sap sync log" ON public.sap_api_sync_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));

-- updated_at triggers
CREATE TRIGGER trg_tenants_uat BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_custom_roles_uat BEFORE UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_approval_matrix_uat BEFORE UPDATE ON public.approval_matrix FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sap_api_configs_uat BEFORE UPDATE ON public.sap_api_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sap_api_credentials_uat BEFORE UPDATE ON public.sap_api_credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
