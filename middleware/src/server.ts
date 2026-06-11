import "dotenv/config";
import express from "express";
import cors from "cors";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { invokeRouter } from "./routes/invoke.js";
import { testRouter } from "./routes/test.js";

const app = express();

app.use(cors({ origin: true, allowedHeaders: ["Content-Type", "x-shared-secret"] }));
app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use(invokeRouter);
app.use(testRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message }, "unhandled");
  res.status(500).json({ ok: false, error: err.message });
});

const port = Number(process.env.PORT || 3002);
app.listen(port, () => {
  logger.info(`SAP middleware listening on :${port}`);
});
