import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { ClaimService } from "./claim.service";

const create = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.create(req.body, user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Claim submitted successfully",
        data: result,
    });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.listMine(user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Your claims retrieved",
        data: result,
    });
});

const listAll = catchAsync(async (req: Request, res: Response) => {
    const result = await ClaimService.listAll();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "All claims retrieved",
        data: result,
    });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.updateStatus(
        req.params.id as string,
        req.body.status,
        user.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: `Claim ${req.body.status.toLowerCase()}`,
        data: result,
    });
});

export const ClaimController = { create, listMine, listAll, updateStatus };
