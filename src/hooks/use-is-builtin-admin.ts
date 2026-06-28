import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Returns whether the currently signed-in user has the built-in `Admin`
 * user_role in Supabase. Used to grant Cloud (Google/email) admins full
 * screen access when they have no SAP profile cached.
 */
export function useIsBuiltInAdmin(): { loading: boolean; isAdmin: boolean } {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["builtin-admin", user?.id ?? null],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "Admin",
      });
      if (error) return false;
      return !!data;
    },
  });

  return {
    loading: authLoading || (!!user && isLoading),
    isAdmin: !!data,
  };
}
