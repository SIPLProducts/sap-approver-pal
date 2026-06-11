import type { Request, Response, NextFunction } from "express";

export function requireSharedSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SHARED_SECRET;
  if (!expected) {
    return res.status(500).json({ ok: false, error: "Middleware misconfigured: SHARED_SECRET not set" });
  }
  const got = req.header("x-shared-secret");
  if (!got || got !== expected) {
    return res.status(401).json({ ok: false, error: "Invalid or missing x-shared-secret" });
  }
  next();
}
