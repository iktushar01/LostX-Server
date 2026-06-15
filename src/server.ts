import type { Server } from "http";
import app from "./app";
import { envVars } from "./config/env";
import { seedSuperAdmin } from "./app/utils/seed";

// Load .env only in development
if (process.env.NODE_ENV !== "production") {
  import('dotenv/config');
}

let server: Server | undefined;
let isBootstrapping = false;

const globalForServer = globalThis as typeof globalThis & {
  __lostxServer?: Server;
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

export default app;
