import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { IRequestUser } from "../auth/auth.interface.js";
import { ClaimMessageService } from "./claim-message.service.js";

const listByClaim = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await ClaimMessageService.listByClaim(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Claim chat messages retrieved",
        data: result,
    });
});

const create = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await ClaimMessageService.create(
        req.params.id as string,
        user.userId,
        user.role,
        req.body.content,
    );

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Message sent",
        data: result,
    });
});

export const ClaimMessageController = { listByClaim, create };

