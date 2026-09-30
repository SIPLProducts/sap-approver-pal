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

/**
 * Returns the id of the SAP API config named "90%_CUST_API".
 * Used by the Customer F4 on the Transportation (90%) Exception Billing screen.
 */
export const getTransportCustConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "90%_CUST_API")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null };
    }
    return { configId: data.id as string };
  });

/**
 * Returns the id of the SAP API config named "90%_CUSTNAME_API".
 * Used by the Customer Name F4 on the Transportation (90%) Exception Billing screen.
 */
export const getTransportCustNameConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "90%_CUSTNAME_API")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null };
    }
    return { configId: data.id as string };
  });
