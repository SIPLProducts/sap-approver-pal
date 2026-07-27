
-- 1) Switch helper functions to SECURITY INVOKER
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY INVOKER;
ALTER FUNCTION public.is_admin(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_doc_raiser(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.user_has_step_on_doc(uuid, uuid) SECURITY INVOKER;

-- 2) Revoke direct execute on internal trigger-only definer functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 3) Tenants: only tenants the user belongs to (admins bypass)
DROP POLICY IF EXISTS "Authenticated can read tenants" ON public.tenants;
CREATE POLICY "Users read own tenants" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.tenant_id = tenants.id AND ut.user_id = auth.uid()
    )
  );

-- 4) approval_matrix: scoped to user's tenants
DROP POLICY IF EXISTS "Authenticated reads approval_matrix" ON public.approval_matrix;
CREATE POLICY "Users read approval_matrix for own tenants" ON public.approval_matrix
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.tenant_id = approval_matrix.tenant_id AND ut.user_id = auth.uid()
    )
  );

-- 5) custom_roles: scoped to user's tenants
DROP POLICY IF EXISTS "Authenticated reads custom_roles" ON public.custom_roles;
CREATE POLICY "Users read custom_roles for own tenants" ON public.custom_roles
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.tenant_id = custom_roles.tenant_id AND ut.user_id = auth.uid()
    )
  );

-- 6) role_permissions: admin-only read (no tenant column; used only in admin screens)
DROP POLICY IF EXISTS "Authenticated reads role_permissions" ON public.role_permissions;
CREATE POLICY "Admins read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7) approval_strategies: admin-only read (no tenant column; sensitive routing rules)
DROP POLICY IF EXISTS "strategies_select_all_auth" ON public.approval_strategies;
CREATE POLICY "Admins read approval_strategies" ON public.approval_strategies
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
