import dotenv from "dotenv";
import { SignOptions } from "jsonwebtoken";

if (process.env.VERCEL !== "1") {
    dotenv.config();
}

interface EnvConfig {
    PORT: string;
    NODE_ENV: string;
    BETTER_AUTH_URL: string;
    FRONTEND_URL: string;
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    ACCESS_TOKEN_SECRET: string;
    REFRESH_TOKEN_SECRET: string;
    ACCESS_TOKEN_EXPIRES_IN: SignOptions['expiresIn'];
    REFRESH_TOKEN_EXPIRES_IN: SignOptions['expiresIn'];
    BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: SignOptions['expiresIn'];
    BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: SignOptions['expiresIn'];
    EMAIL_HOST: string;
    EMAIL_PORT: number;
    EMAIL_SECURE: boolean;
    EMAIL_USER: string;
    EMAIL_PASSWORD: string;
    EMAIL_FROM: string;
    EXPIRE_OTP_TIME: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CALLBACK_URL: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    IMGBB_API_KEY: string;
    SUPER_ADMIN_EMAIL: string;
    SUPER_ADMIN_PASSWORD: string;
    OPENROUTER_API_KEY: string;
    OPENROUTER_BASE_URL: string;
    OPENROUTER_EMBEDDING_MODEL: string;
    OPENROUTER_LLM_MODEL: string;
    CHATBOT_TOP_K: number;
    CHATBOT_MIN_SIMILARITY: number;
    CHATBOT_EMBEDDING_DIMENSION: number;
    AUTO_APPROVE_MATCH_THRESHOLD: number;
    AI_AUTO_APPROVE_CONFIDENCE: number;
    ITEM_EXPIRY_DAYS: number;
    DUPLICATE_REPORT_WINDOW_HOURS: number;
    ENCRYPTION_KEY: string;
}

const requiredEnvVariables = [
    "BETTER_AUTH_URL",
    "FRONTEND_URL",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "ACCESS_TOKEN_EXPIRES_IN",
    "REFRESH_TOKEN_EXPIRES_IN",
    "BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN",
    "BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE",
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_SECURE",
    "EMAIL_USER",
    "EMAIL_PASSWORD",
    "EMAIL_FROM",
    "EXPIRE_OTP_TIME",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "IMGBB_API_KEY",
    "SUPER_ADMIN_EMAIL",
    "SUPER_ADMIN_PASSWORD",
];

const missingEnvVariables = requiredEnvVariables.filter(
    (variable) => !process.env[variable],
);

// Exported so the /health endpoint can surface it without crashing startup
export let configError: string | null = null;

if (missingEnvVariables.length > 0) {
    const msg = `Missing required environment variables: ${missingEnvVariables.join(", ")}`;
    console.error(`[LostX] ❌ ${msg}`);
    configError = msg;
    // Do NOT throw here — a top-level throw in an esbuild bundle crashes the
    // entire function before any request handler can catch it.
}

const loadEnvVariables = (): EnvConfig => {
    return {
        PORT: process.env.PORT ?? "3000",
        NODE_ENV: process.env.NODE_ENV ?? "production",
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "",
        FRONTEND_URL: process.env.FRONTEND_URL ?? "",
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
        ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET ?? "",
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? "",
        ACCESS_TOKEN_EXPIRES_IN: (process.env.ACCESS_TOKEN_EXPIRES_IN ?? "1d") as SignOptions['expiresIn'],
        REFRESH_TOKEN_EXPIRES_IN: (process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d") as SignOptions['expiresIn'],
        BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: (process.env.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN ?? "1d") as SignOptions['expiresIn'],
        BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: (process.env.BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE ?? "1d") as SignOptions['expiresIn'],
        EMAIL_HOST: process.env.EMAIL_HOST ?? "",
        EMAIL_PORT: Number(process.env.EMAIL_PORT ?? 587),
        EMAIL_SECURE: process.env.EMAIL_SECURE === "true",
        EMAIL_USER: process.env.EMAIL_USER ?? "",
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ?? "",
        EMAIL_FROM: process.env.EMAIL_FROM ?? "",
        EXPIRE_OTP_TIME: process.env.EXPIRE_OTP_TIME ?? "15m",
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
        GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? "",
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",
        IMGBB_API_KEY: process.env.IMGBB_API_KEY ?? "",
        SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ?? "",
        SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD ?? "",
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
        OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
        OPENROUTER_EMBEDDING_MODEL: process.env.OPENROUTER_EMBEDDING_MODEL ?? "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        OPENROUTER_LLM_MODEL: process.env.OPENROUTER_LLM_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free",
        CHATBOT_TOP_K: Number(process.env.CHATBOT_TOP_K ?? 5),
        CHATBOT_MIN_SIMILARITY: Number(process.env.CHATBOT_MIN_SIMILARITY ?? 0.55),
        CHATBOT_EMBEDDING_DIMENSION: Number(process.env.CHATBOT_EMBEDDING_DIMENSION ?? 2048),
        AUTO_APPROVE_MATCH_THRESHOLD: Number(process.env.AUTO_APPROVE_MATCH_THRESHOLD ?? 85),
        AI_AUTO_APPROVE_CONFIDENCE: Number(process.env.AI_AUTO_APPROVE_CONFIDENCE ?? 80),
        ITEM_EXPIRY_DAYS: Number(process.env.ITEM_EXPIRY_DAYS ?? 90),
        DUPLICATE_REPORT_WINDOW_HOURS: Number(process.env.DUPLICATE_REPORT_WINDOW_HOURS ?? 24),
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "",
    };
};

export const envVars: EnvConfig = loadEnvVariables();
