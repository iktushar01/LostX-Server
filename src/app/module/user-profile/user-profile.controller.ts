import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { IRequestUser } from "../auth/auth.interface.js";
import { UserProfileService } from "./user-profile.service.js";
import { UserReviewService } from "../user-review/user-review.service.js";
import { UserReportService } from "../user-report/user-report.service.js";

const getAccountSummary = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await UserProfileService.getAccountSummary(user.userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Account summary retrieved",
        data: result,
    });
});

const getPublicProfile = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await UserProfileService.getPublicProfile(
        req.params.id as string,
        user.userId,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Public profile retrieved",
        data: result,
    });
});

const createReview = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await UserReviewService.create(
        req.params.id as string,
        user.userId,
        req.body,
    );

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Review submitted",
        data: result,
    });
});

const listReviews = catchAsync(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await UserReviewService.listForUser(req.params.id as string, page, limit);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Reviews retrieved",
        data: result.data,
        meta: result.meta,
    });
});

const getEligibleReviewClaims = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await UserReviewService.getEligibleClaimsForReview(
        user.userId,
        req.params.id as string,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Eligible claims retrieved",
        data: result,
    });
});

const createReport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await UserReportService.create(user.userId, req.body);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Report submitted for admin review",
        data: result,
    });
});

const listReportsAdmin = catchAsync(async (req: Request, res: Response) => {
    const status = req.query.status as import("../../lib/prisma-exports.js").UserReportStatus | undefined;
    const result = await UserReportService.listForAdmin(status);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "User reports retrieved",
        data: result,
    });
});

const updateReportAdmin = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await UserReportService.updateByAdmin(
        req.params.id as string,
        user.userId,
        req.body,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Report updated",
        data: result,
    });
});

export const UserProfileController = {
    getAccountSummary,
    getPublicProfile,
    createReview,
    listReviews,
    getEligibleReviewClaims,
    createReport,
    listReportsAdmin,
    updateReportAdmin,
};
