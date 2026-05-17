
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM (
  'F1','F2','F3','F4','F5','F6',
  'M1','M2','M3','M4','M5','MD',
  'S2','S3','S4',
  'T1','T4','T5','T6',
  'IC','ZZ','SR','C1',
  'HOD','PlantHead','SCMHead','StoreHOD',
  'ProjectHead','FinanceHead','MBD','FA',
  'Admin'
);

CREATE TYPE public.sap_module AS ENUM ('MM','SD');

CREATE TYPE public.document_type AS ENUM (
  'ZNFA','ZNFA_TER','PR','PO','SR','MIGO','ZGP','ZMM_REV','ZMM_GATE',
  'BMW_PRICE','BMW_CONTRACT','BMW_SO','BMW_ZERO_WASTE','BMW_SC_ISSUE',
  'IWM_PRICE','IWM_GATE','SD_VK11','SD_ZV13','SD_ZREP_SCR'
);

CREATE TYPE public.doc_status AS ENUM ('pending','approved','rejected','sent_back','cancelled');
CREATE TYPE public.step_status AS ENUM ('pending','approved','rejected','sent_back','skipped','waiting');

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  sap_user_id TEXT,
  designation TEXT,
  plant TEXT,
  business_unit TEXT,
  company_code TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER ROLES + helper
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'Admin'
  )
$$;

-- =====================================================
-- APPROVAL DOCUMENTS
-- =====================================================
CREATE TABLE public.approval_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module public.sap_module NOT NULL,
  doc_type public.document_type NOT NULL,
  sap_t_code TEXT NOT NULL,
  sap_doc_no TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  plant TEXT,
  business_unit TEXT,
  company_code TEXT,
  vendor_name TEXT,
  customer_name TEXT,
  requester_name TEXT NOT NULL,
  requester_sap_id TEXT,
  raised_by_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_step_seq INT NOT NULL DEFAULT 1,
  status public.doc_status NOT NULL DEFAULT 'pending',
  sap_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_type, sap_doc_no)
);

ALTER TABLE public.approval_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_docs_status ON public.approval_documents(status);
CREATE INDEX idx_docs_module ON public.approval_documents(module);
CREATE INDEX idx_docs_plant ON public.approval_documents(plant);

-- =====================================================
-- APPROVAL STEPS
-- =====================================================
CREATE TABLE public.approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.approval_documents(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  role public.app_role NOT NULL,
  assigned_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.step_status NOT NULL DEFAULT 'waiting',
  decided_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, seq)
);

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_steps_doc ON public.approval_steps(document_id);
CREATE INDEX idx_steps_assigned ON public.approval_steps(assigned_user);

-- =====================================================
-- LINE ITEMS
-- =====================================================
CREATE TABLE public.approval_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.approval_documents(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  material_code TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(18,3) DEFAULT 1,
  uom TEXT,
  unit_price NUMERIC(18,2),
  amount NUMERIC(18,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_line_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lines_doc ON public.approval_line_items(document_id);

-- =====================================================
-- ATTACHMENTS
-- =====================================================
CREATE TABLE public.approval_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.approval_documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_attachments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'assignment',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- =====================================================
-- AUDIT LOG
-- =====================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- APPROVAL STRATEGIES (configurable matrices)
-- =====================================================
CREATE TABLE public.approval_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type public.document_type NOT NULL,
  business_unit TEXT,
  company_code TEXT,
  min_value NUMERIC(18,2) DEFAULT 0,
  max_value NUMERIC(18,2),
  roles_in_order public.app_role[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_strategies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.approval_documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- profiles
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_insert_admin" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- user_roles: admin manages; users see their own
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "roles_admin_write" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- approval_documents
CREATE POLICY "docs_select_involved_or_admin" ON public.approval_documents
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR raised_by_user = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.approval_steps s
    WHERE s.document_id = approval_documents.id
      AND s.assigned_user = auth.uid()
  )
);

CREATE POLICY "docs_insert_admin" ON public.approval_documents
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "docs_update_admin" ON public.approval_documents
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

-- approval_steps
CREATE POLICY "steps_select_involved_or_admin" ON public.approval_steps
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR assigned_user = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.approval_documents d
    WHERE d.id = approval_steps.document_id
      AND (d.raised_by_user = auth.uid()
        OR EXISTS (SELECT 1 FROM public.approval_steps s2 WHERE s2.document_id = d.id AND s2.assigned_user = auth.uid()))
  )
);

CREATE POLICY "steps_update_assignee_or_admin" ON public.approval_steps
FOR UPDATE TO authenticated
USING (assigned_user = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "steps_insert_admin" ON public.approval_steps
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- line items + attachments: visibility follows the parent doc
CREATE POLICY "lines_select_via_doc" ON public.approval_line_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.approval_documents d
  WHERE d.id = approval_line_items.document_id
    AND (public.is_admin(auth.uid())
      OR d.raised_by_user = auth.uid()
      OR EXISTS (SELECT 1 FROM public.approval_steps s WHERE s.document_id = d.id AND s.assigned_user = auth.uid()))
));

CREATE POLICY "attachments_select_via_doc" ON public.approval_attachments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.approval_documents d
  WHERE d.id = approval_attachments.document_id
    AND (public.is_admin(auth.uid())
      OR d.raised_by_user = auth.uid()
      OR EXISTS (SELECT 1 FROM public.approval_steps s WHERE s.document_id = d.id AND s.assigned_user = auth.uid()))
));

-- notifications
CREATE POLICY "notifications_select_self" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_update_self" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- audit log: visible to admin + actor + anyone who can see the doc
CREATE POLICY "audit_select_admin_or_actor" ON public.audit_log
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR actor = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.approval_documents d
    WHERE d.id = audit_log.document_id
      AND (d.raised_by_user = auth.uid()
        OR EXISTS (SELECT 1 FROM public.approval_steps s WHERE s.document_id = d.id AND s.assigned_user = auth.uid()))
  )
);

-- strategies: anyone authenticated can read (need to display matrices); only admin writes
CREATE POLICY "strategies_select_all_auth" ON public.approval_strategies
FOR SELECT TO authenticated USING (true);
CREATE POLICY "strategies_admin_write" ON public.approval_strategies
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =====================================================
-- SEED: default approval strategies (editable later via /admin/strategies)
-- =====================================================
INSERT INTO public.approval_strategies (doc_type, roles_in_order) VALUES
  ('ZNFA',          ARRAY['F1','F6','M1','M3','M5','MD']::public.app_role[]),
  ('ZNFA_TER',      ARRAY['T4']::public.app_role[]),
  ('PR',            ARRAY['IC','M1','M2','M3','T1','T4','T6']::public.app_role[]),
  ('PO',            ARRAY['ZZ','F3','F6','T6','S4']::public.app_role[]),
  ('SR',            ARRAY['SR','F1','M3','M4']::public.app_role[]),
  ('MIGO',          ARRAY['PlantHead']::public.app_role[]),
  ('ZGP',           ARRAY['HOD','StoreHOD','SCMHead','PlantHead','StoreHOD']::public.app_role[]),
  ('ZMM_REV',       ARRAY['HOD']::public.app_role[]),
  ('BMW_PRICE',     ARRAY['ProjectHead']::public.app_role[]),
  ('BMW_CONTRACT',  ARRAY['FinanceHead','ProjectHead']::public.app_role[]),
  ('BMW_SO',        ARRAY['FinanceHead','ProjectHead']::public.app_role[]),
  ('BMW_ZERO_WASTE',ARRAY['ProjectHead']::public.app_role[]),
  ('BMW_SC_ISSUE',  ARRAY['ProjectHead']::public.app_role[]),
  ('IWM_PRICE',     ARRAY['ProjectHead']::public.app_role[]),
  ('SD_VK11',       ARRAY['MBD']::public.app_role[]),
  ('SD_ZV13',       ARRAY['MBD']::public.app_role[]),
  ('SD_ZREP_SCR',   ARRAY['FA']::public.app_role[]);
