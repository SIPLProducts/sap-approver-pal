import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the id of the SAP API config named "Get_Plant" plus the field name
 * inside each response row that holds the plant code. Used by the PlantSelect
 * dropdown across SD screens.
 */
export const getPlantConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "Get_Plant")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null, plantField: "VKORG" };
    }
    return { configId: data.id as string, plantField: "VKORG" };
  });

/**
 * Returns the id of the SAP API config named "GET_USER_PLANT" plus the field
 * name holding the plant code. Used by the Plant F4 in User Management's
 * Create / Edit User dialog. Response rows look like:
 *   [{ "WERKS": "0001", "NAME1": "Werk 0001" }]
 */
export const getUserPlantConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "GET_USER_PLANT")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null, plantField: "WERKS" };
    }
    return { configId: data.id as string, plantField: "WERKS" };
  });

/**
 * Returns the id of the SAP API config named "IWM_PLANTS_F4" plus the field
 * name holding the plant code for IWM plant selectors.
 */
export const getIwmPlantConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "IWM_PLANTS_F4")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null, plantField: "WERKS" };
    }
    return { configId: data.id as string, plantField: "WERKS" };
  });

