import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const BCRYPT_PREFIX = "$2";

export const isBcryptHash = (value: string): boolean => value.startsWith(BCRYPT_PREFIX);

export const hashVerificationAnswer = async (answer: string): Promise<string> =>
    bcrypt.hash(answer.trim(), BCRYPT_ROUNDS);

export const verifyVerificationAnswer = async (
    submitted: string,
    stored: string | null | undefined,
): Promise<boolean> => {
    if (!stored?.trim()) return false;

    if (isBcryptHash(stored)) {
        return bcrypt.compare(submitted.trim(), stored);
    }

    return submitted.trim().toLowerCase() === stored.trim().toLowerCase();
};
