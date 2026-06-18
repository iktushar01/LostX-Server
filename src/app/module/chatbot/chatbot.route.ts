import { Router, type Router as IRouter } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { optionalCheckAuth } from "../../middleware/optionalCheckAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ChatbotController } from "./chatbot.controller";
import { chatMessageZodSchema } from "./chatbot.validation";

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
