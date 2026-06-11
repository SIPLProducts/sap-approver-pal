import { Router } from "express";
import { z } from "zod";
import { requireSharedSecret } from "../auth.js";
import { loadConfig } from "../config-loader.js";
import { invokeSap } from "../sap-invoker.js";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export const invokeRouter = Router();

const Body = z.object({
  configId: z.string().uuid(),
  inputs: z.record(z.string(), z.unknown()).optional().default({}),
});

invokeRouter.post("/sap/invoke", requireSharedSecret, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.message });
  }
  const { configId, inputs } = parsed.data;

  try {
    const cfg = await loadConfig(configId);
    const result = await invokeSap(cfg, inputs);

    await supabase.from("sap_api_sync_log").insert({
      config_id: configId,
      status: result.ok ? "ok" : "error",
      latency_ms: result.latency_ms,
      message: `invoke: ${result.status}`,
    });

    return res.status(result.ok ? 200 : 502).json(result);
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ configId, err: msg }, "invoke failed");
    await supabase.from("sap_api_sync_log").insert({
      config_id: configId,
      status: "error",
      latency_ms: 0,
      message: `invoke: ${msg}`.slice(0, 500),
    });
    return res.status(500).json({ ok: false, error: msg });
  }
});
