import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Grep-able first line, then the stack: `pm2 logs Qty_App | grep '\[ssr\]'`.
    const err = error instanceof Error ? error : undefined;
    console.error(`[ssr] request middleware: ${err?.name ?? typeof error}: ${err?.message ?? String(error)}`);
    if (err?.stack) console.error(err.stack);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});


export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
