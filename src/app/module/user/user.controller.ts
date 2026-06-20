import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { IRequestUser } from "../auth/auth.interface.js";
import { UserService } from "./user.service.js";

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * POST /users/create-admin
 * The requesting user's role is forwarded to the service so it can enforce
 * the SUPER_ADMIN-only elevation rule server-side (defence in depth).
 */
const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const requestingUser = req.user as IRequestUser;

    const result = await UserService.createAdmin(req.body, requestingUser.role);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Admin registered successfully",
        data: result,
    });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const UserController = {
    createAdmin
};