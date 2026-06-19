import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { envVars } from "./config/env";
import { getAllowedOrigins } from "./config/origins";
import { IndexRoute } from "./app/routes/index";
import { globalErrorhandler } from "./app/middleware/globalErrorhandler";
import { notFound } from "./app/middleware/notFound";
import { auth } from "./app/lib/auth";
import { ExpiryService } from "./app/module/expiry/expiry.service";
import { ensureVercelBootstrap } from "./vercel-bootstrap";

const app: Application = express();
const allowedOrigins = getAllowedOrigins();

app.set("view engine", "ejs");
app.set(
    "views",
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "app/templates"),
);

const corsOptions = {
    origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
    ) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(async (_req, _res, next) => {
    await ensureVercelBootstrap();
    next();
});

app.use("/api/auth", toNodeHandler(auth))
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.send("LostX Server is running 🚀");
});

app.get("/api/cron/expiry", async (req: Request, res: Response) => {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const result = await ExpiryService.archiveStaleItems();
    res.status(200).json({ success: true, data: result });
});

app.use("/api/v1", IndexRoute);


app.use(globalErrorhandler);
app.use(notFound);
export default app;
