
CREATE TABLE public.email_no_reply_config (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT true,
  host text,
  port integer,
  encryption text NOT NULL DEFAULT 'tls',
  username text,
  from_email text,
  from_name text,
  cc_recipients text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.email_no_reply_config TO authenticated;
GRANT ALL ON public.email_no_reply_config TO service_role;

ALTER TABLE public.email_no_reply_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view no-reply email config"
  ON public.email_no_reply_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Admins can insert no-reply email config"
  ON public.email_no_reply_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Admins can update no-reply email config"
  ON public.email_no_reply_config
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'))
  WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE TRIGGER touch_email_no_reply_config_updated_at
  BEFORE UPDATE ON public.email_no_reply_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.email_no_reply_config (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

-- Secrets table: no grants to anon/authenticated; only service_role can read.
CREATE TABLE public.email_no_reply_secrets (
  id text PRIMARY KEY DEFAULT 'default',
  app_password text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_no_reply_secrets TO service_role;

ALTER TABLE public.email_no_reply_secrets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER touch_email_no_reply_secrets_updated_at
  BEFORE UPDATE ON public.email_no_reply_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.email_no_reply_secrets (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;
