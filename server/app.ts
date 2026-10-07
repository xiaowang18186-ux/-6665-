import express from "express";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./config/env";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { riskStore, type MemoryRiskStore } from "./risk/store";

export function createApp(store: MemoryRiskStore = riskStore, opts: { serveStatic?: boolean } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", ENV.trustProxy);
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/admin", adminRouter(store));
  app.use("/api", publicRouter(store));
  app.use("/api", (_req, res) => res.status(404).json({ ok: false, code: "NOT_FOUND", message: "接口不存在" }));

  if (opts.serveStatic) {
    const dir = path.resolve(import.meta.dirname, "public");
    if (fs.existsSync(dir)) {
      app.use(express.static(dir));
      app.get("*", (_req, res) => res.sendFile(path.join(dir, "index.html")));
    }
  }
  return app;
}
