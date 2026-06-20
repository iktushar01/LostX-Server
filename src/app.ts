import express, { Application, NextFunction, Request, Response, Router } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { envVars, configError } from "./config/env.js";
import { getAllowedOrigins } from "./config/origins.js";
import { globalErrorhandler } from "./app/middleware/globalErrorhandler.js";
import { notFound } from "./app/middleware/notFound.js";

const app: Application = express();
const allowedOrigins = getAllowedOrigins();

// Resolve the directory of this file — works for both tsc output and esbuild bundles
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set("view engine", "ejs");
// Attempt both possible locations (compiled dist/ or source src/)
app.set("views", path.resolve(__dirname, "app/templates"));

const corsOptions = {
    origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
    ) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

let authHandler: ReturnType<typeof toNodeHandler> | null = null;
const getAuthHandler = async () => {
    if (authHandler) {
        return authHandler;
    }
    const { auth } = await import("./app/lib/auth.js");
    authHandler = toNodeHandler(auth);
    return authHandler;
};

let indexRoute: Router | null = null;
const getIndexRoute = async () => {
    if (indexRoute) {
        return indexRoute;
    }
    const { IndexRoute } = await import("./app/routes/index.js");
    indexRoute = IndexRoute;
    return indexRoute;
};

app.use("/api/auth", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const handler = await getAuthHandler();
        await handler(req, res);
        return;
    } catch (error) {
        return next(error);
    }
});
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
    res.send("LostX Server is running 🚀");
});

app.get("/health", async (_req: Request, res: Response) => {
    if (configError) {
        res.status(503).json({
            success: false,
            message: "Server misconfigured",
            error: configError,
        });
        return;
    }
    res.status(200).json({
        success: true,
        message: "LostX API is healthy",
        environment: envVars.NODE_ENV,
    });
});

app.get("/api/cron/expiry", async (req: Request, res: Response, next: NextFunction) => {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    try {
        const { ExpiryService } = await import("./app/module/expiry/expiry.service.js");
        const result = await ExpiryService.archiveStaleItems();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

app.use("/api/v1", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const router = await getIndexRoute();
        return router(req, res, next);
    } catch (error) {
        return next(error);
    }
});

app.use(globalErrorhandler);
app.use(notFound);

export { app };
