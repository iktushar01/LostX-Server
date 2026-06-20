import { decryptText } from "./encryption.util.js";

type ItemWithSecrets = {
    privateDescription?: string | null;
    verificationAnswer?: string | null;
    [key: string]: unknown;
};

/** Remove encrypted / secret fields from API responses. */
export const stripSecretFields = <T extends ItemWithSecrets>(item: T): Omit<T, "privateDescription" | "verificationAnswer"> => {
    const { privateDescription: _p, verificationAnswer: _v, ...rest } = item;
    return rest as Omit<T, "privateDescription" | "verificationAnswer">;
};

/** Decrypt privateDescription for owner/admin views. */
export const withDecryptedPrivateDescription = <T extends ItemWithSecrets>(
    item: T,
): T & { privateDescriptionPlain?: string | null } => {
    const plain = item.privateDescription ? decryptText(item.privateDescription) : null;
    const { privateDescription: _p, ...rest } = item;
    return { ...rest, privateDescriptionPlain: plain } as T & { privateDescriptionPlain?: string | null };
};
