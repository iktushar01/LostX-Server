import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AdminService } from "./admin.service";

const getStats = catchAsync(async (_req: Request, res: Response) => {
    const result = await AdminService.getStats();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Admin statistics retrieved",
        data: result,
    });
});

export const AdminController = { getStats };
