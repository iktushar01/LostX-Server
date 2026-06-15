import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { LostItemService } from "./lost-item.service";

const create = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await LostItemService.create(req.body, user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Lost item report created",
        data: result,
    });
});

const getById = catchAsync(async (req: Request, res: Response) => {
    const result = await LostItemService.getById(req.params.id as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Lost item retrieved",
        data: result,
    });
});

const list = catchAsync(async (req: Request, res: Response) => {
    const result = await LostItemService.list(req.query as Record<string, unknown>);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Lost items retrieved",
        data: result.data,
        meta: result.meta,
    });
});

const remove = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await LostItemService.deleteOwn(req.params.id as string, user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Lost item deleted",
        data: result,
    });
});

export const LostItemController = { create, getById, list, remove };
