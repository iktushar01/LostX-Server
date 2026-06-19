import type { Server } from "http";
import app from "./app";
import { envVars } from "./config/env";
import { seedSuperAdmin } from "./app/utils/seed";
import { ExpiryService } from "./app/module/expiry/expiry.service";

// Load .env only in development
if (process.env.NODE_ENV !== "production") {
  import('dotenv/config');
}

let server: Server | undefined;
let isBootstrapping = false;

const globalForServer = globalThis as typeof globalThis & {
  __lostxServer?: Server | undefined;
};

const closeServer = () =>
  new Promise<void>((resolve) => {
    const activeServer = globalForServer.__lostxServer ?? server;

    if (!activeServer) {
      resolve();
      return;
    }

    activeServer.close(() => {
      server = undefined;
      globalForServer.__lostxServer = undefined;
      resolve();
    });
  });

const bootstrap = async () => {
  if (isBootstrapping) {
    return;
  }

  isBootstrapping = true;

  try {
    // Use process.env.PORT set by Railway, fallback to envVars or 5000
    const port = process.env.PORT || envVars.PORT || 5000;

    await closeServer();

    server = await app.listen(port);
    globalForServer.__lostxServer = server;
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${port} is already in use.`);
        return;
      }

      console.error("❌ Server error:", error);
      process.exit(1);
    });

    console.log(
      `✅ Server running on ${process.env.NODE_ENV || envVars.NODE_ENV} mode at http://localhost:${port}`
    );

    // Seed super admin (errors won't break server)
    seedSuperAdmin().catch((error) => {
      console.error(
        "Super admin seed skipped due to startup error:",
        error
      );
    });

    const runExpiryJob = () => {
      ExpiryService.archiveStaleItems()
        .then((result) => {
          if (result.expiredLost > 0 || result.expiredFound > 0) {
            console.log(
              `[ExpiryJob] Archived ${result.expiredLost} lost and ${result.expiredFound} found items`,
            );
          }
        })
        .catch((error) => console.error("[ExpiryJob] Failed:", error));
    };

    setTimeout(runExpiryJob, 60_000);
    setInterval(runExpiryJob, 24 * 60 * 60 * 1000);
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      console.error(
        `❌ Port ${process.env.PORT || envVars.PORT} is already in use.`
      );
    } else {
      console.error("❌ Failed to start server:", error);
    }
  } finally {
    isBootstrapping = false;
  }
};

if (process.env.VERCEL !== "1") {
  bootstrap();
}
