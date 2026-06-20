import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { ChatbotService } from "./chatbot.service.js";

const chat = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    const result = await ChatbotService.chat(req.body.message, userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Chat response generated",
        data: result,
    });
});

const reindex = catchAsync(async (_req: Request, res: Response) => {
    const result = await ChatbotService.reindexMissingEmbeddings();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Embedding reindex completed",
        data: result,
    });
});

export const ChatbotController = {
    chat,
    reindex,
};
