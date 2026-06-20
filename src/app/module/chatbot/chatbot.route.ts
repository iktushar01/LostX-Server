import { Router, type Router as IRouter } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { optionalCheckAuth } from "../../middleware/optionalCheckAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ChatbotController } from "./chatbot.controller.js";
import { chatMessageZodSchema } from "./chatbot.validation.js";

const router = Router();
const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN] as const;

router.post(
    "/chat",
    optionalCheckAuth(),
    validateRequest(chatMessageZodSchema),
    ChatbotController.chat,
);

router.post(
    "/reindex",
    checkAuth(...adminRoles),
    ChatbotController.reindex,
);

export const ChatbotRoutes: IRouter = router;
