import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { IRequestUser } from "../auth/auth.interface.js";
import { DashboardService } from "./dashboard.service.js";

const getStats = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await DashboardService.getUserStats(user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Dashboard statistics retrieved",
        data: result,
    });
});

export const DashboardController = { getStats };
