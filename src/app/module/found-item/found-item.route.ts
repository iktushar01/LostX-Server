import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { FoundItemController } from "./found-item.controller";
import {
    createFoundItemZodSchema,
    foundItemIdParamSchema,
} from "./found-item.validation";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/", FoundItemController.list);

router.get(
    "/:id",
    validateRequest(foundItemIdParamSchema, "params"),
    FoundItemController.getById,
);

router.post(
    "/",
    checkAuth(...allRoles),
    validateRequest(createFoundItemZodSchema),
    FoundItemController.create,
);

router.delete(
    "/:id",
    checkAuth(...allRoles),
    validateRequest(foundItemIdParamSchema, "params"),
    FoundItemController.remove,
);

export const FoundItemRoutes = router;
