
DROP POLICY IF EXISTS "Users read custom_roles for own tenants" ON public.custom_roles;
CREATE POLICY "Users read custom_roles"
ON public.custom_roles FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR tenant_id IS NULL
  OR EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = custom_roles.tenant_id)
);

DROP POLICY IF EXISTS "Users read approval_matrix for own tenants" ON public.approval_matrix;
CREATE POLICY "Users read approval_matrix"
ON public.approval_matrix FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR tenant_id IS NULL
  OR EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = approval_matrix.tenant_id)
);

DROP POLICY IF EXISTS "Admins read approval_strategies" ON public.approval_strategies;
CREATE POLICY "Users read approval_strategies"
ON public.approval_strategies FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins read role_permissions" ON public.role_permissions;
CREATE POLICY "Users read role_permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.custom_roles cr
    WHERE cr.id = role_permissions.custom_role_id
      AND (
        cr.tenant_id IS NULL
        OR EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = cr.tenant_id)
      )
  )
);
