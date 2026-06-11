import { Router } from "express";

export const healthRouter = Router();

const startedAt = Date.now();

healthRouter.get("/__health", (_req, res) => {
  res.json({
    ok: true,
    service: "sap-middleware",
    version: "1.0.0",
    uptime_s: Math.round((Date.now() - startedAt) / 1000),
  });
});
