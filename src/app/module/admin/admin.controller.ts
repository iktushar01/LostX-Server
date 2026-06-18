import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
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

const getAnalytics = catchAsync(async (_req: Request, res: Response) => {
    const result = await AdminService.getAnalytics();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Analytics retrieved",
        data: result,
    });
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await AdminService.getAuditLogs(limit);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Audit logs retrieved",
        data: result,
    });
});

const listItems = catchAsync(async (req: Request, res: Response) => {
    const type = req.query.type === "found" ? "found" : "lost";
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const featured =
        req.query.featured === "true" ? true : req.query.featured === "false" ? false : undefined;

    const result = await AdminService.listItems({
        type,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(featured === undefined ? {} : { featured }),
    });

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Admin items retrieved",
        data: result,
    });
});

const setItemFeatured = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const type = req.params.type === "found" ? "found" : "lost";
    const result = await AdminService.setItemFeatured(
        type,
        req.params.id as string,
        Boolean(req.body.isFeatured),
        user.userId,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Item feature state updated",
        data: result,
    });
});

const deleteItem = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const type = req.params.type === "found" ? "found" : "lost";
    const result = await AdminService.deleteItem(
        type,
        req.params.id as string,
        user.userId,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Item removed by admin",
        data: result,
    });
});

export const AdminController = {
    getStats,
    getAnalytics,
    getAuditLogs,
    listItems,
    setItemFeatured,
    deleteItem,
};
