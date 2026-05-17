import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type DocumentType = Database["public"]["Enums"]["document_type"];
export type SapModule = Database["public"]["Enums"]["sap_module"];
export type DocStatus = Database["public"]["Enums"]["doc_status"];
export type StepStatus = Database["public"]["Enums"]["step_status"];

export type ApprovalDocument = Database["public"]["Tables"]["approval_documents"]["Row"];
export type ApprovalStep = Database["public"]["Tables"]["approval_steps"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export async function getCurrentUserRoles(): Promise<AppRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as AppRole);
}

export const DOC_TYPE_LABELS: Record<DocumentType, { label: string; tcode: string; module: SapModule }> = {
  ZNFA:           { label: "Note for Approval",          tcode: "ZNFA",            module: "MM" },
  ZNFA_TER:       { label: "NFA – Territory",            tcode: "ZNFA_TER",        module: "MM" },
  PR:             { label: "Purchase Requisition",       tcode: "ME54N / ME55",    module: "MM" },
  PO:             { label: "Purchase Order",             tcode: "ME28 / ME29N",    module: "MM" },
  SR:             { label: "Service Entry Sheet",        tcode: "ML81N",           module: "MM" },
  MIGO:           { label: "Goods Receipt (105 mvmt)",   tcode: "MIGO",            module: "MM" },
  ZGP:            { label: "Gate Pass (RGP/NRGP)",       tcode: "ZGP",             module: "MM" },
  ZMM_REV:        { label: "Material Issue",             tcode: "ZMM_REV",         module: "MM" },
  ZMM_GATE:       { label: "Gate Entry",                 tcode: "ZMM_GATE",        module: "MM" },
  BMW_PRICE:      { label: "BMW Price Approval",         tcode: "ZBMW_VK11_APP",   module: "SD" },
  BMW_CONTRACT:   { label: "BMW Contract Approval",      tcode: "ZBMW_CONTRACT_APP", module: "SD" },
  BMW_SO:         { label: "BMW Sales Order Approval",   tcode: "ZSD_BMW_SO_APP",  module: "SD" },
  BMW_ZERO_WASTE: { label: "BMW Zero Waste Approval",    tcode: "ZBMW_COCKPIT",    module: "SD" },
  BMW_SC_ISSUE:   { label: "BMW Service Certificate",    tcode: "ZBMW_SC_ISSUE_PH",module: "SD" },
  IWM_PRICE:      { label: "IWM Price Approval",         tcode: "ZIWM_APPROVE",    module: "SD" },
  IWM_GATE:       { label: "IWM Gate Security",          tcode: "ZGATE",           module: "SD" },
  SD_VK11:        { label: "Condition (VK11)",           tcode: "VK11",            module: "SD" },
  SD_ZV13:        { label: "Customer Distance (ZV13)",   tcode: "ZV13",            module: "SD" },
  SD_ZREP_SCR:    { label: "Scrap Price Update",         tcode: "ZREP_SCR",        module: "SD" },
};

export const ROLE_LABELS: Record<AppRole, string> = {
  F1: "F1 – Plant Accountant",
  F2: "F2 – HO FI Team",
  F3: "F3 – Finance L3",
  F4: "F4 – Finance L4",
  F5: "F5 – Finance L5",
  F6: "F6 – Dy Finance Controller",
  M1: "M1 – Plant Head",
  M2: "M2 – Operations Mgr",
  M3: "M3 – SBU Head",
  M4: "M4 – Sr Operations",
  M5: "M5 – CFO",
  MD: "MD – MD & CEO",
  S2: "S2 – SCM First Level",
  S3: "S3 – SCM L3",
  S4: "S4 – SCM Head",
  T1: "T1 – Tech L1",
  T4: "T4 – Tech Manager",
  T5: "T5 – Regional Director",
  T6: "T6 – Dept Head",
  IC: "IC – Indenter",
  ZZ: "ZZ – PO Initiator",
  SR: "SR – Service Initiator",
  C1: "C1 – Compliance",
  HOD: "HOD – Head of Dept",
  PlantHead: "Plant Head (designate)",
  SCMHead: "SCM Head",
  StoreHOD: "Store HOD",
  ProjectHead: "Project Head",
  FinanceHead: "Finance Head",
  MBD: "MBD Team",
  FA: "F&A Team",
  Admin: "Administrator",
};
