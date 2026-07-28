import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listApprovalsTool from "./tools/list-approvals";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "resustainability-approvals-mcp",
  title: "Resustainability Approvals",
  version: "0.1.0",
  instructions:
    "Tools for the Resustainability SAP Approvals app. Use `whoami` to confirm connectivity and identity. Use `list_approvals` to list approval documents visible to the signed-in user (RLS-scoped).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listApprovalsTool],
});
