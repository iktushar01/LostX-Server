import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { memoryUpload } from "../../../config/multer.config";
import { LostItemController } from "./lost-item.controller";
import {
    createLostItemZodSchema,
    lostItemIdParamSchema,
    updateLostItemZodSchema,
} from "./lost-item.validation";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/", LostItemController.list);

router.get(
    "/mine/for-claim",
    checkAuth(...allRoles),
    LostItemController.listMineForClaim,
);

router.get(
    "/mine",
    checkAuth(...allRoles),
    LostItemController.listMine,
);

router.get(
    "/:id",
    validateRequest(lostItemIdParamSchema, "params"),
    LostItemController.getById,
);

router.post(
    "/",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(createLostItemZodSchema),
    LostItemController.create,
);

router.delete(
    "/:id",
    checkAuth(...allRoles),
    validateRequest(lostItemIdParamSchema, "params"),
    LostItemController.remove,
);

router.patch(
    "/:id",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(lostItemIdParamSchema, "params"),
    validateRequest(updateLostItemZodSchema),
    LostItemController.update,
);

export const LostItemRoutes: Router = router;
