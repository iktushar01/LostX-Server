import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ClaimStatus } from "../../lib/prisma-exports";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { ClaimService } from "./claim.service";

const create = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.create(req.body, user.userId);

    const message = result.autoApproved
        ? "Claim auto-approved — high confidence match with correct verification"
        : "Claim submitted successfully — pending staff review";

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message,
        data: result,
    });
});

const createQuick = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.createQuick(req.body, user.userId);

    const message = result.autoApproved
        ? "Quick claim auto-approved — lost report created and claim approved"
        : "Quick claim submitted — lost report created, pending staff review";

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message,
        data: result,
    });
});

const confirmReceived = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.confirmReceived(req.params.id as string, user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Receipt confirmed — finder can now mark item as returned",
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
    const search =
        typeof req.query.search === "string" ? req.query.search : undefined;
    const status =
        typeof req.query.status === "string" &&
        Object.values(ClaimStatus).includes(req.query.status as ClaimStatus)
            ? (req.query.status as ClaimStatus)
            : undefined;

    const filters: { search?: string; status?: ClaimStatus } = {};

    if (search) {
        filters.search = search;
    }

    if (status) {
        filters.status = status;
    }

    const result = await ClaimService.listAll(filters);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "All claims retrieved",
        data: result,
    });
});

const getById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await ClaimService.getById(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Claim retrieved",
        data: result,
    });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;

    const result = await ClaimService.updateStatus(
        req.params.id as string,
        req.body.status,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: `Claim ${req.body.status.toLowerCase()}`,
        data: result,
    });
});

export const ClaimController = {
    create,
    createQuick,
    confirmReceived,
    listMine,
    listAll,
    getById,
    updateStatus,
};
