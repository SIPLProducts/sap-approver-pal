import { Router } from "express";
import { z } from "zod";
import { requireSharedSecret } from "../auth.js";
import { loadConfig } from "../config-loader.js";
import { probeSap } from "../sap-invoker.js";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export const testRouter = Router();

const Body = z.object({ configId: z.string().uuid() });

testRouter.post("/sap/test", requireSharedSecret, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  try {
    const cfg = await loadConfig(parsed.data.configId);
    const result = await probeSap(cfg);
    await supabase.from("sap_api_sync_log").insert({
      config_id: parsed.data.configId,
      status: result.ok ? "ok" : "error",
      latency_ms: result.latency_ms,
      message: `test: ${result.message}`,
    });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ err: msg }, "test failed");
    return res.status(500).json({ ok: false, error: msg });
  }
});
