import { Prisma } from "../../../generated/prisma/index.js";
import { Role, UserStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { tokenUtils } from "../../utils/token";
import { jwtUtils } from "../../utils/jwt";
import { envVars } from "../../../config/env";
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "../../../config/cloudinary.config";
import {
    IChangePassWordPayload,
    ILoginUser,
    IRegisterClient,
    IRequestUser,
    IUpdateProfilePayload,
} from "./auth.interface";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds both JWT tokens from a consistent user-shaped object.
 * Centralised so every code path produces identical token payloads.
 */
const buildTokenPair = (user: {
    id: string;
    role: Role;
    name: string;
    email: string;
    status: UserStatus;
    isDeleted: boolean;
    emailVerified: boolean;
}) => {
    const payload = {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        isDeleted: user.isDeleted,
        emailVerified: user.emailVerified,
    };
    return {
        accessToken: tokenUtils.getAccessToken(payload),
        refreshToken: tokenUtils.getRefreshToken(payload),
    };
};

// ─── Register ─────────────────────────────────────────────────────────────────

const registerClient = async (payload: IRegisterClient, fileBuffer?: Buffer, fileName?: string) => {
    const { name, email, password } = payload;

    // 1. Prepare upload promise
    const uploadPromise = fileBuffer && fileName
        ? uploadFileToCloudinary(fileBuffer, fileName)
            .then(res => res.secure_url)
            .catch(() => {
                throw new AppError(StatusCodes.BAD_REQUEST, "Failed to upload image. Please try again.");
            })
        : Promise.resolve(undefined);

    // 2. Prepare auth user promise (without image initially to run them in parallel)
    const signUpPromise = auth.api.signUpEmail({
        body: { name, email, password },
    });

    // Run Cloudinary Upload (I/O bound) and Bcrypt Hashing (CPU bound) concurrently to save 1-2 seconds
    let imageUrl: string | undefined;
    let authData;
    
    try {
        [imageUrl, authData] = await Promise.all([uploadPromise, signUpPromise]);
    } catch (error: any) {
        // Map better-auth duplicate user error to a standard AppError
        if (error?.message?.toLowerCase().includes("exist") || error?.status === 409) {
            throw new AppError(StatusCodes.CONFLICT, "A user with this email already exists");
        }
        throw error;
    }

    if (!authData?.user) {
        if (imageUrl) {
            await deleteFileFromCloudinary(imageUrl, "image").catch(() => {});
        }
        throw new AppError(StatusCodes.BAD_REQUEST, "User registration failed");
    }

    const normalizedEmail = email.toLowerCase();
    const persistedUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    // With requireEmailVerification, better-auth returns a synthetic user (not in DB)
    // for duplicate emails to prevent enumeration — detect that here.
    if (!persistedUser || persistedUser.id !== authData.user.id) {
        if (imageUrl) {
            await deleteFileFromCloudinary(imageUrl, "image").catch(() => {});
        }
        throw new AppError(StatusCodes.CONFLICT, "A user with this email already exists");
    }

    try {
        if (imageUrl) {
            await prisma.user.update({
                where: { id: persistedUser.id },
                data: { image: imageUrl },
            });
            authData.user.image = imageUrl;
        }

        const { accessToken, refreshToken } = buildTokenPair({
            id: authData.user.id,
            role: authData.user.role as Role,
            name: authData.user.name,
            email: authData.user.email,
            status: authData.user.status as UserStatus,
            isDeleted: !!authData.user.isDeleted,
            emailVerified: authData.user.emailVerified,
        });

        return {
            user: authData.user,
            token: authData.token,
            accessToken,
            refreshToken,
        };
    } catch (error: unknown) {
        if (imageUrl) {
            await deleteFileFromCloudinary(imageUrl, "image").catch(() => {});
        }

        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code: string }).code === "P2002"
        ) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "This email is already registered. Please log in or use a different email."
            );
        }

        throw error;
    }
};

// ─── Login ────────────────────────────────────────────────────────────────────

const loginUser = async (payload: ILoginUser) => {
    const { email, password } = payload;

    // Guard checks before attempting sign-in (avoids leaking auth errors)
    const dbUser = await prisma.user.findUnique({ where: { email } });

    if (!dbUser) {
        // Use UNAUTHORIZED — do not confirm whether the email exists
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
    }

    if (dbUser.isDeleted || dbUser.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.FORBIDDEN, "This account has been deleted");
    }

    if (dbUser.status === UserStatus.SUSPENDED) {
        throw new AppError(StatusCodes.FORBIDDEN, "This account has been suspended");
    }

    if (!dbUser.emailVerified) {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            "Email not verified. Please check your inbox for the verification code.",
        );
    }

    // Credentials are validated by better-auth
    let authData;
    try {
        authData = await auth.api.signInEmail({ body: { email, password } });
    } catch (error: any) {
        const message = error?.message?.toLowerCase() ?? "";
        if (
            message.includes("verify") ||
            message.includes("verification") ||
            !dbUser.emailVerified
        ) {
            throw new AppError(StatusCodes.FORBIDDEN, "Email not verified");
        }
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
    }

    const { accessToken, refreshToken } = buildTokenPair({
        id: authData.user.id,
        role: authData.user.role as Role,
        name: authData.user.name,
        email: authData.user.email,
        status: authData.user.status as UserStatus,
        isDeleted: !!authData.user.isDeleted,
        emailVerified: authData.user.emailVerified,
    });

    return {
        user: authData.user,
        token: authData.token,
        accessToken,
        refreshToken,
    };
};

// ─── Get Me ───────────────────────────────────────────────────────────────────

const fetchCurrentUserById = async (userId: string) => {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!dbUser) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    return dbUser;
};

const getMe = async (user: IRequestUser) => {
    return fetchCurrentUserById(user.userId);
};

const updateProfile = async (payload: IUpdateProfilePayload) => {
    const {
        userId,
        name,
        profilePhoto,
        fileBuffer,
        fileName,
    } = payload;

    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });

    if (!dbUser) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    const uploadedProfilePhoto =
        fileBuffer && fileName
            ? await uploadFileToCloudinary(fileBuffer, fileName).then((result) => result.secure_url)
            : undefined;

    const finalProfilePhoto =
        uploadedProfilePhoto !== undefined ? uploadedProfilePhoto : profilePhoto;

    const userUpdateData: Prisma.UserUpdateInput = {};

    if (name !== undefined) {
        userUpdateData.name = name;
    }

    if (finalProfilePhoto !== undefined) {
        userUpdateData.image = finalProfilePhoto;
    }

    if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
            where: { id: userId },
            data: userUpdateData,
        });
    }

    return fetchCurrentUserById(userId);
};

// ─── Refresh tokens ───────────────────────────────────────────────────────────

const getNewTokens = async (oldRefreshToken: string, sessionToken?: string) => {
    // Verify the refresh JWT is valid and not tampered with
    const verified = jwtUtils.verifyToken(oldRefreshToken, envVars.REFRESH_TOKEN_SECRET);

    if (!verified.success || !verified.decoded) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }

    const { decoded } = verified;

    const { accessToken, refreshToken: newRefreshToken } = buildTokenPair({
        id: decoded.userId,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email,
        status: decoded.status,
        isDeleted: decoded.isDeleted,
        emailVerified: decoded.emailVerified,
    });

    // The DB session token is better-auth's own token — we intentionally do NOT
    // overwrite it with our JWT refresh token. We just touch the expiry so the
    // session stays alive while the user is active.
    if (sessionToken) {
        const session = await prisma.session.findUnique({
            where: { token: sessionToken },
            include: { user: true },
        });

        if (session) {
            await prisma.session.update({
                where: { token: sessionToken },
                data: {
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(),
                },
            });
        }
    }

    return {
        accessToken,
        refreshToken: newRefreshToken,
    };
};

// ─── Change Password ──────────────────────────────────────────────────────────

const changePassword = async (
    payload: IChangePassWordPayload,
    sessionToken: string,
) => {
    const session = await auth.api.getSession({
        headers: new Headers({ Authorization: `Bearer ${sessionToken}` }),
    });

    if (!session?.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid or expired session");
    }

    const { currentPassword, newPassword } = payload;

    await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: new Headers({ Authorization: `Bearer ${sessionToken}` }),
    });

    // Clear the forced-password-change flag if it was set
    if (session.user.needPasswordChange) {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { needPasswordChange: false },
        });
    }

    const { accessToken, refreshToken } = buildTokenPair({
        id: session.user.id,
        role: session.user.role as Role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status as UserStatus,
        isDeleted: !!session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    return { accessToken, refreshToken };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

const logoutUser = async (sessionToken: string) => {
    if (!sessionToken) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "No active session");
    }

    return auth.api.signOut({
        headers: new Headers({ Authorization: `Bearer ${sessionToken}` }),
    });
};

// ─── Email verification ───────────────────────────────────────────────────────

const verifyEmail = async (email: string, otp: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await auth.api.verifyEmailOTP({
        body: { email: normalizedEmail, otp: otp.trim() },
    });

    // better-auth may not always flush the DB field — ensure it is set
    if (result?.status && !result.user?.emailVerified) {
        await prisma.user.update({
            where: { email: normalizedEmail },
            data: { emailVerified: true },
        });
    }
};

const resendVerificationOtp = async (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
        return;
    }

    if (user.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Email is already verified");
    }

    await auth.api.sendVerificationOTP({
        body: { email: normalizedEmail, type: "email-verification" },
    });
};

// ─── Forget / Reset password ──────────────────────────────────────────────────

const forgetPassword = async (email: string) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
        // Return generic success to avoid email enumeration
        return;
    }

    if (!user.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Please verify your email first");
    }

    await auth.api.requestPasswordResetEmailOTP({ body: { email } });
};

const resetPassword = async (
    email: string,
    otp: string,
    newPassword: string,
) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (!user.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Please verify your email first");
    }

    await auth.api.resetPasswordEmailOTP({
        body: { email, otp, password: newPassword },
    });

    // Invalidate all sessions after a password reset for security
    await prisma.$transaction([
        prisma.session.deleteMany({ where: { userId: user.id } }),
        ...(user.needPasswordChange
            ? [
                  prisma.user.update({
                      where: { id: user.id },
                      data: { needPasswordChange: false },
                  }),
              ]
            : []),
    ]);
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const googleLoginSuccess = async (session: {
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        isDeleted?: boolean | null;
        emailVerified: boolean;
        image?: string | null | undefined;
    };
}) => {
    const { user } = session;

    const { accessToken, refreshToken } = buildTokenPair({
        id: user.id,
        role: user.role as Role,
        name: user.name,
        email: user.email,
        status: user.status as UserStatus,
        isDeleted: !!user.isDeleted,
        emailVerified: user.emailVerified,
    });

    return { accessToken, refreshToken, user };
};

const issueTokensFromOAuthCode = async (user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    isDeleted?: boolean | null;
    emailVerified: boolean;
    image?: string | null | undefined;
}) => {
    const { accessToken, refreshToken } = buildTokenPair({
        id: user.id,
        role: user.role as Role,
        name: user.name,
        email: user.email,
        status: user.status as UserStatus,
        isDeleted: !!user.isDeleted,
        emailVerified: user.emailVerified,
    });

    return { accessToken, refreshToken, user };
};

const deleteAccount = async (userId: string, payload: { email: string; password?: string }) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            accounts: {
                where: { providerId: "credential" },
                select: { id: true },
            },
        },
    });

    if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.NOT_FOUND, "Account not found");
    }

    if (user.email.toLowerCase() !== payload.email.toLowerCase().trim()) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Email confirmation does not match");
    }

    const hasCredential = user.accounts.length > 0;
    if (hasCredential) {
        if (!payload.password?.trim()) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Password is required to delete this account");
        }
        try {
            await auth.api.signInEmail({
                body: { email: user.email, password: payload.password },
            });
        } catch {
            throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid password");
        }
    }

    await prisma.$transaction(async (tx) => {
        await tx.session.deleteMany({ where: { userId } });
        await tx.user.update({
            where: { id: userId },
            data: {
                name: "Deleted user",
                image: null,
                isDeleted: true,
                deletedAt: new Date(),
                status: UserStatus.DELETED,
            },
        });
    });

    return { id: userId };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const AuthService = {
    registerClient,
    loginUser,
    getMe,
    updateProfile,
    getNewTokens,
    changePassword,
    logoutUser,
    verifyEmail,
    resendVerificationOtp,
    forgetPassword,
    resetPassword,
    googleLoginSuccess,
    issueTokensFromOAuthCode,
    deleteAccount,
};
