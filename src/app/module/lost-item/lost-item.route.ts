import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LostItemController } from "./lost-item.controller";
import {
    createLostItemZodSchema,
    lostItemIdParamSchema,
} from "./lost-item.validation";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/", LostItemController.list);

router.get(
    "/:id",
    validateRequest(lostItemIdParamSchema, "params"),
    LostItemController.getById,
);

router.post(
    "/",
    checkAuth(...allRoles),
    validateRequest(createLostItemZodSchema),
    LostItemController.create,
);

router.delete(
    "/:id",
    checkAuth(...allRoles),
    validateRequest(lostItemIdParamSchema, "params"),
    LostItemController.remove,
);

export const LostItemRoutes = router;
