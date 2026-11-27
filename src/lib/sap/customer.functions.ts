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
 * Returns the id of the SAP API config named "90%_Plant_Base_Cust_F4".
 * Used by the row-level Customer F4 in the Transportation results table.
 */
export const getTransportPlantCustConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "90%_Plant_Base_Cust_F4")
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

/**
 * Returns the id of the SAP API config named "90%_CUST_Based_CUSTNAME".
 * Used by the row-level Customer Name F4 in the Transportation results table.
 */
export const getTransportCustBasedNameConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "90%_CUST_Based_CUSTNAME")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null };
    }
    return { configId: data.id as string };
  });

/**
 * Returns the id of the SAP API config named "90%_Get_API".
 * Used to load Transportation (90%) Exception Billing records.
 */
export const getTransportBillingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "90%_Get_API")
      .maybeSingle();
    if (!data || !data.is_active) {
      return { configId: null as string | null };
    }
    return { configId: data.id as string };
  });

/**
 * Returns the id of the SAP API config named "90%_Save_API" and the signed-in
 * user's SAP ID (sent as user_name in the save payload).
 */
export const getTransportSaveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "90%_Save_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "90%_Change_API" and the signed-in
 * user's SAP ID (sent as user_name in the modify payload).
 */
export const getTransportChangeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "90%_Change_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "90%_Approvals_Get_Data" and the
 * signed-in user's SAP ID (sent as user_name in the get_data payload).
 */
export const getTransportApprovalsGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "90\\%\\_Approvals\\_Get\\_Data")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getTransportApprovalsApproveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "90\\%\\_Approvals\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getTransportApprovalsRejectConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "90\\%\\_Reject\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Finance_Save_API" (used by the
 * Financial Year Base Rate Execute) and the signed-in user's SAP ID.
 */
export const getFinanceSaveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Finance_Save_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Finace_create_API" (Financial
 * Year Base Rate Save) and the signed-in user's SAP ID.
 */
export const getFinanceCreateConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Finace_create_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Finace_Change_API" (Financial
 * Year Base Rate Change) and the signed-in user's SAP ID.
 */
export const getFinanceChangeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Finace_Change_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Finace_Delete_API" (Financial
 * Year Base Rate Delete) and the signed-in user's SAP ID.
 */
export const getFinanceDeleteConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Finace_Delete_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Finance_Material_F4_API"
 * (Financial Year Base Rate Material F4).
 */
export const getFinanceMaterialF4Config = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "Finance_Material_F4_API")
      .maybeSingle();
    if (!data || !data.is_active) return { configId: null as string | null };
    return { configId: data.id as string };
  });

export const getFinanceApprovalsGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Finance\\_Approvals\\_Get\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getAvgApprovalsGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "AVG\\_Approvals\\_GET\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getAvgApprovalsApproveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "AVG\\_Approvals\\_Approve\\_API")
      .maybeSingle();
    if (!data || !data.is_active) return { configId: null as string | null };
    return { configId: data.id as string };
  });

export const getAvgApprovalsRejectConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "AVG\\_Approvals\\_Reject\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getFinanceApproveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "Finace\\_Approve\\_API")
      .maybeSingle();
    if (!data || !data.is_active) return { configId: null as string | null };
    return { configId: data.id as string };
  });

export const getFinanceRejectConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sap_api_configs")
      .select("id, is_active")
      .ilike("name", "Finace\\_Reject\\_API")
      .maybeSingle();
    if (!data || !data.is_active) return { configId: null as string | null };
    return { configId: data.id as string };
  });

/**
 * Returns the id of the SAP API config named "Average_Selling_Get_API"
 * (Average Selling Rate fetch) and the signed-in user's SAP ID.
 */
export const getAverageSellingGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Average_Selling_Get_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Average_Selling_Save_API"
 * (Average Selling Rate Save) and the signed-in user's SAP ID.
 */
export const getAverageSellingSaveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Average_Selling_Save_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Average_Selling_Change_API"
 * (Average Selling Rate Change) and the signed-in user's SAP ID.
 */
export const getAverageSellingChangeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Average_Selling_Change_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "Average_Selling_Delete_API"
 * (Average Selling Rate Delete) and the signed-in user's SAP ID.
 */
export const getAverageSellingDeleteConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "Average_Selling_Delete_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "DM_GET_API"
 * (Distance Master fetch) and the signed-in user's SAP ID.
 */
export const getDistanceMasterGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "DM_GET_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "DM_SAVE_API"
 * (Distance Master Save) and the signed-in user's SAP ID.
 */
export const getDmSaveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("id, is_active").ilike("name", "DM_SAVE_API").maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "DM_Change_API"
 * (Distance Master Change) and the signed-in user's SAP ID.
 */
export const getDmChangeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("id, is_active").ilike("name", "DM_Change_API").maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "DM_Delete_API"
 * (Distance Master Delete) and the signed-in user's SAP ID.
 */
export const getDmDeleteConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("id, is_active").ilike("name", "DM_Delete_API").maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getDmApprovalsGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "DM\\_APPROVALS\\_GET\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getDmApprovalsApproveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "DM\\_APPROVALS\\_APPROVE\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

export const getDmApprovalsRejectConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("sap_api_configs")
        .select("id, is_active")
        .ilike("name", "DM\\_APPROVALS\\_REJECT\\_API")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "VM_GET_API"
 * (Vehicle Master Get) and the signed-in user's SAP ID.
 */
export const getVehicleMasterGetConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("id, is_active").ilike("name", "VM_GET_API").maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "VM_SAVE_API"
 * (Vehicle Master Save) and the signed-in user's SAP ID.
 */
export const getVmSaveConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("id, is_active").ilike("name", "VM_SAVE_API").maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });

/**
 * Returns the id of the SAP API config named "VM_CHANGE_API"
 * (Vehicle Master Change) and the signed-in user's SAP ID.
 */
export const getVmChangeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("sap_api_configs").select("id, is_active").ilike("name", "VM_CHANGE_API").maybeSingle(),
      supabaseAdmin.from("profiles").select("sap_user_id").eq("id", context.userId).maybeSingle(),
    ]);
    const userName = (profile?.sap_user_id ?? "").trim();
    if (!data || !data.is_active) return { configId: null as string | null, userName };
    return { configId: data.id as string, userName };
  });
