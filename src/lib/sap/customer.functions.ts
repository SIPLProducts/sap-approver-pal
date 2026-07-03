import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the id of the SAP API config named "Customer_Fetch_API" plus the
 * field names inside each response row that hold the customer code / name.
 * Used by the CustomerSelect F4-help across SD approval screens.
 */
export const getCustomerConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "Customer_Fetch_API")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null, codeField: "KUNNR", textField: "NAME1" };
    }
    return { configId: data.id as string, codeField: "KUNNR", textField: "NAME1" };
  });
