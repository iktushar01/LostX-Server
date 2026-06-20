import type { Server } from "http";
import express from "express";

// ─── Graceful startup wrapper ─────────────────────────────────────────────────
// All app imports are deferred so that if env vars are missing, we can still
// return a readable JSON error from the health endpoint instead of a raw 500.

let appModule: typeof import("./app.js") | null = null;
let initError: Error | null = null;

async function loadApp(): Promise<typeof import("./app.js")> {
  if (appModule) return appModule;
  if (initError) throw initError;
  try {
    appModule = await import("./app.js");
    return appModule;
  } catch (err: any) {
    initError = err;
    throw err;
  }
}

// Thin shim: on error, expose the reason as JSON instead of crashing
const shim = express();
shim.use(async (req: express.Request, res: express.Response) => {
  try {
    const mod = await loadApp();
    (mod.app as express.Express)(req, res);
  } catch (err: any) {
    const message: string = err?.message ?? String(err);
    console.error("[LostX] Startup error:", message);
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: "Server misconfigured", detail: message });
    }
  }
});

export default shim;

// ─── Local dev bootstrap ──────────────────────────────────────────────────────
if (process.env.VERCEL !== "1") {
  (async () => {
    if (process.env.NODE_ENV !== "production") {
      await import("dotenv/config" as string);
    }

    let server: Server | undefined;

    try {
      const mod = await loadApp();
      const { envVars } = await import("./config/env.js");
      const port = process.env.PORT || envVars.PORT || 5000;

      server = mod.app.listen(port, () => {
        console.log(`✅ Server running on http://localhost:${port}`);
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.error(`❌ Port ${port} is already in use.`);
        } else {
          console.error("❌ Server error:", err);
          process.exit(1);
        }
      });

      const { seedSuperAdmin } = await import("./app/utils/seed.js");
      seedSuperAdmin().catch((e: Error) =>
        console.error("Super admin seed skipped:", e),
      );

      const { ExpiryService } = await import("./app/module/expiry/expiry.service.js");
      const runExpiryJob = () =>
        ExpiryService.archiveStaleItems()
          .then((r) => {
            if (r.expiredLost > 0 || r.expiredFound > 0) {
              console.log(`[ExpiryJob] Archived ${r.expiredLost} lost / ${r.expiredFound} found`);
            }
          })
          .catch((e: Error) => console.error("[ExpiryJob] Failed:", e));

      setTimeout(runExpiryJob, 60_000);
      setInterval(runExpiryJob, 24 * 60 * 60 * 1000);
    } catch (err: any) {
      console.error("❌ Failed to start server:", err?.message ?? err);
      process.exit(1);
    }
  })();
}
