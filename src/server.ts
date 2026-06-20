import { app } from "./app.js";

// Vercel zero-config Express: export the app as default
export default app;

// ─── Local dev bootstrap ──────────────────────────────────────────────────────
// This block never runs on Vercel (VERCEL=1 is set automatically by Vercel)
if (process.env.VERCEL !== "1") {
  void (async () => {
    const { envVars } = await import("./config/env.js");
    const port = Number(process.env.PORT || envVars.PORT || 5000);

    const server = app.listen(port, () => {
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

    const { ExpiryService } = await import(
      "./app/module/expiry/expiry.service.js"
    );
    const runExpiryJob = () =>
      ExpiryService.archiveStaleItems()
        .then((r) => {
          if (r.expiredLost > 0 || r.expiredFound > 0) {
            console.log(
              `[ExpiryJob] Archived ${r.expiredLost} lost / ${r.expiredFound} found`,
            );
          }
        })
        .catch((e: Error) => console.error("[ExpiryJob] Failed:", e));

    setTimeout(runExpiryJob, 60_000);
    setInterval(runExpiryJob, 24 * 60 * 60 * 1000);
  })();
}
