import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { MatchService } from "./match.service.js";

const browseSuggestions = catchAsync(async (_req: Request, res: Response) => {
    const result = await MatchService.getBrowseSuggestions();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Browse match suggestions retrieved",
        data: result,
    });
});

const forLostItem = catchAsync(async (req: Request, res: Response) => {
    const result = await MatchService.getSuggestionsForLostItem(req.params.id as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Match suggestions retrieved",
        data: result,
    });
});

const forFoundItem = catchAsync(async (req: Request, res: Response) => {
    const result = await MatchService.getSuggestionsForFoundItem(req.params.id as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Match suggestions retrieved",
        data: result,
    });
});

const draftMatches = catchAsync(async (req: Request, res: Response) => {
    const { title, description, category, location, dateFound } = req.query;

    const result = await MatchService.getDraftMatches({
        title: String(title),
        description: String(description),
        category: category as import("../../lib/prisma-exports.js").ItemCategory,
        location: String(location),
        dateFound: new Date(String(dateFound)),
    });

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Draft match suggestions retrieved",
        data: result,
    });
});

export const MatchController = { browseSuggestions, forLostItem, forFoundItem, draftMatches };
