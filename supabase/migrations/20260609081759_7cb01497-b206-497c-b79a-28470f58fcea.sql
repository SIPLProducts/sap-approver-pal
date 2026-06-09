
-- 1. Grant EXECUTE on existing role helpers (missing grants cause "permission denied for function is_admin")
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- 2. Break recursion between approval_documents and approval_steps via SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.is_doc_raiser(_doc_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.approval_documents
    WHERE id = _doc_id AND raised_by_user = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_step_on_doc(_doc_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.approval_steps
    WHERE document_id = _doc_id AND assigned_user = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_doc_raiser(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_step_on_doc(uuid, uuid) TO authenticated;

-- 3. Rewrite the recursive SELECT policies
DROP POLICY IF EXISTS steps_select_involved_or_admin ON public.approval_steps;
CREATE POLICY steps_select_involved_or_admin ON public.approval_steps
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR assigned_user = auth.uid()
  OR public.is_doc_raiser(document_id, auth.uid())
);

DROP POLICY IF EXISTS docs_select_involved_or_admin ON public.approval_documents;
CREATE POLICY docs_select_involved_or_admin ON public.approval_documents
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR raised_by_user = auth.uid()
  OR public.user_has_step_on_doc(id, auth.uid())
);
