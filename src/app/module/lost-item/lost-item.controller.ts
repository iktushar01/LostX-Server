import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { getUploadedImageUrl } from "../../utils/uploadItemImage";
import { LostItemService } from "./lost-item.service";

const create = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const imageUrl = await getUploadedImageUrl(req);

    const result = await LostItemService.create(
        { ...req.body, imageUrl },
        user.userId,
    );

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

const listMine = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await LostItemService.listMine(user.userId, limit);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Your lost items retrieved",
        data: result,
    });
});

const listMineForClaim = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await LostItemService.listMineForClaim(user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Open lost items for claim retrieved",
        data: result,
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

export const LostItemController = { create, getById, list, listMine, listMineForClaim, remove };
