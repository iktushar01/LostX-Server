import { Router } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { optionalCheckAuth } from "../../middleware/optionalCheckAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { memoryUpload } from "../../../config/multer.config.js";
import { LostItemController } from "./lost-item.controller.js";
import {
    createLostItemZodSchema,
    lostItemIdParamSchema,
    updateLostItemZodSchema,
} from "./lost-item.validation.js";

const router = Router();
const allRoles = [Role.CLIENT, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/", optionalCheckAuth(), LostItemController.list);

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
    optionalCheckAuth(),
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
