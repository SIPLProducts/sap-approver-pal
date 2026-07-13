import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the id of the SAP API config named "Get_Search_Term" plus the
 * field names inside each response row that hold the search-term code / label.
 * Used by the SearchTermMultiSelect F4-help across SD approval screens.
 */
export const getSearchTermConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "Get_Search_Term")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null };
    }
    return { configId: data.id as string };
  });
