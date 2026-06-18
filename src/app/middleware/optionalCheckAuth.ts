import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { jwtUtils } from "../utils/jwt";
import { cookieUtils } from "../utils/cookies";
import { envVars } from "../../config/env";

/**
 * Attempts to attach req.user when credentials are present.
 * Unlike checkAuth, this never blocks unauthenticated guests.
 */
export const optionalCheckAuth =
    () => async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const sessionToken = cookieUtils.getCookie(req, "better-auth.session_token");

            if (sessionToken) {
                const sessionExists = await prisma.session.findFirst({
                    where: {
                        token: sessionToken,
                        expiresAt: { gt: new Date() },
                    },
                    include: { user: true },
                });

                if (sessionExists?.user) {
                    req.user = {
                        ...sessionExists.user,
                        userId: sessionExists.user.id,
                    };
                    return next();
                }
            }

            const accessToken = cookieUtils.getCookie(req, "accessToken");

            if (accessToken) {
                const verifiedToken = jwtUtils.verifyToken(
                    accessToken,
                    envVars.ACCESS_TOKEN_SECRET,
                );

                if (verifiedToken.success && verifiedToken.decoded) {
                    req.user = verifiedToken.decoded as NonNullable<Request["user"]>;
                }
            }
        } catch {
            // Guest access is allowed for the chatbot endpoint.
        }

        next();
    };
