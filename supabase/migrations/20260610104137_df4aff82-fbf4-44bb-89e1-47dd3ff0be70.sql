CREATE TABLE public.sap_global_settings (
  id text PRIMARY KEY DEFAULT 'default',
  connection_mode text NOT NULL DEFAULT 'direct' CHECK (connection_mode IN ('direct','via_proxy')),
  deployment_mode text NOT NULL DEFAULT 'lovable_cloud' CHECK (deployment_mode IN ('lovable_cloud','self_hosted')),
  middleware_port int NOT NULL DEFAULT 3002,
  middleware_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE ON public.sap_global_settings TO authenticated;
GRANT ALL ON public.sap_global_settings TO service_role;
ALTER TABLE public.sap_global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads sap_global_settings" ON public.sap_global_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'Admin'));
CREATE POLICY "Admin manages sap_global_settings" ON public.sap_global_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'Admin')) WITH CHECK (public.has_role(auth.uid(),'Admin'));
CREATE TRIGGER trg_sap_global_settings_uat BEFORE UPDATE ON public.sap_global_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.sap_global_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TABLE public.sap_global_secrets (
  id text PRIMARY KEY DEFAULT 'default',
  proxy_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sap_global_secrets TO service_role;
ALTER TABLE public.sap_global_secrets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sap_global_secrets_uat BEFORE UPDATE ON public.sap_global_secrets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.sap_global_secrets (id) VALUES ('default') ON CONFLICT DO NOTHING;