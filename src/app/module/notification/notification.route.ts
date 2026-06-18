import { Router } from "express";
import { z } from "zod";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { NotificationController } from "./notification.controller";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

const notificationIdParamSchema = z.object({
    id: z.string().min(1),
});

router.get("/", checkAuth(...allRoles), NotificationController.list);

router.patch(
    "/read-all",
    checkAuth(...allRoles),
    NotificationController.markAllRead,
);

router.patch(
    "/:id/read",
    checkAuth(...allRoles),
    validateRequest(notificationIdParamSchema, "params"),
    NotificationController.markRead,
);

export const NotificationRoutes: Router = router;
