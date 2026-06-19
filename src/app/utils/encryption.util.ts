import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { envVars } from "../../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const resolveKey = (): Buffer => {
    const raw = envVars.ENCRYPTION_KEY?.trim();
    if (!raw) {
        throw new Error("ENCRYPTION_KEY is not configured");
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, "hex");
    }

    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) {
        return decoded;
    }

    throw new Error("ENCRYPTION_KEY must be 32 bytes (64-char hex or base64)");
};

/** Encrypts plaintext. Returns `iv:authTag:ciphertext` (base64 segments). */
export const encryptText = (plaintext: string): string => {
    const key = resolveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
        ":",
    );
};

/** Decrypts a value produced by encryptText. Returns null if input is empty. */
export const decryptText = (ciphertext: string | null | undefined): string | null => {
    if (!ciphertext?.trim()) {
        return null;
    }

    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted payload format");
    }

    const [ivB64, authTagB64, dataB64] = parts;
    const key = resolveKey();
    const iv = Buffer.from(ivB64!, "base64");
    const authTag = Buffer.from(authTagB64!, "base64");
    const encrypted = Buffer.from(dataB64!, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
};

export const encryptIfPresent = (value: string | undefined | null): string | null => {
    if (!value?.trim()) {
        return null;
    }
    return encryptText(value.trim());
};
