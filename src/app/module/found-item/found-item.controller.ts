import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { getUploadedImageUrl } from "../../utils/uploadItemImage";
import { FoundItemService } from "./found-item.service";

const create = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const imageUrl = await getUploadedImageUrl(req);

    const result = await FoundItemService.create(
        { ...req.body, imageUrl },
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Found item report created",
        data: result,
    });
});

const createFromLostTip = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const imageUrl = await getUploadedImageUrl(req);

    const result = await FoundItemService.createFromLostTip(
        req.params.lostItemId as string,
        { ...req.body, imageUrl },
        user.userId,
    );

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Finder tip submitted. The owner has been notified.",
        data: result,
    });
});

const getById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser | undefined;
    const result = await FoundItemService.getById(
        req.params.id as string,
        user?.userId,
        user?.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Found item retrieved",
        data: result,
    });
});

const list = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser | undefined;
    const result = await FoundItemService.list(
        req.query as Record<string, unknown>,
        user?.userId,
        user?.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Found items retrieved",
        data: result.data,
        meta: result.meta,
    });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await FoundItemService.listMine(user.userId, limit);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Your found items retrieved",
        data: result,
    });
});

const remove = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await FoundItemService.deleteOwn(req.params.id as string, user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Found item deleted",
        data: result,
    });
});

const markReturned = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await FoundItemService.markReturned(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Item marked as returned",
        data: result,
    });
});

const update = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const imageUrl = await getUploadedImageUrl(req);
    const result = await FoundItemService.updateOwn(
        req.params.id as string,
        user.userId,
        {
            ...req.body,
            ...(imageUrl ? { imageUrl } : {}),
        },
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Found item updated",
        data: result,
    });
});

export const FoundItemController = {
    create,
    createFromLostTip,
    getById,
    list,
    listMine,
    remove,
    markReturned,
    update,
};
