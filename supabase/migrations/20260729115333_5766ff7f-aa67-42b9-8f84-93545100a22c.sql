DROP POLICY IF EXISTS "Users read approval_strategies" ON public.approval_strategies;
CREATE POLICY "Admins read approval_strategies"
ON public.approval_strategies FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));