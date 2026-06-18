import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { MatchService } from "./match.service";

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

export const MatchController = { browseSuggestions, forLostItem, forFoundItem };
