import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { NotificationService } from "./notification.service";

const list = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = await NotificationService.listForUser(user.userId, limit);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Notifications retrieved",
        data: result,
    });
});

const markRead = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await NotificationService.markAsRead(req.params.id as string, user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Notification marked as read",
        data: result,
    });
});

const markAllRead = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    await NotificationService.markAllAsRead(user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "All notifications marked as read",
    });
});

export const NotificationController = { list, markRead, markAllRead };
