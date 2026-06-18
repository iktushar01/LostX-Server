import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ChatbotService } from "./chatbot.service";

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
