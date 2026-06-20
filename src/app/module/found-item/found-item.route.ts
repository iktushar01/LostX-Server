import { Router } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { optionalCheckAuth } from "../../middleware/optionalCheckAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { memoryUpload } from "../../../config/multer.config.js";
import { FoundItemController } from "./found-item.controller.js";
import {
    createFoundItemZodSchema,
    finderTipZodSchema,
    foundItemIdParamSchema,
    lostItemIdParamSchema,
    updateFoundItemZodSchema,
} from "./found-item.validation.js";

const router = Router();
const allRoles = [Role.CLIENT, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/", optionalCheckAuth(), FoundItemController.list);

router.get(
    "/mine",
    checkAuth(...allRoles),
    FoundItemController.listMine,
);

router.get(
    "/:id",
    optionalCheckAuth(),
    validateRequest(foundItemIdParamSchema, "params"),
    FoundItemController.getById,
);

router.post(
    "/",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(createFoundItemZodSchema),
    FoundItemController.create,
);

router.post(
    "/from-lost-tip/:lostItemId",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(lostItemIdParamSchema, "params"),
    validateRequest(finderTipZodSchema),
    FoundItemController.createFromLostTip,
);

router.delete(
    "/:id",
    checkAuth(...allRoles),
    validateRequest(foundItemIdParamSchema, "params"),
    FoundItemController.remove,
);

router.patch(
    "/:id/return",
    checkAuth(...allRoles),
    validateRequest(foundItemIdParamSchema, "params"),
    FoundItemController.markReturned,
);

router.patch(
    "/:id",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(foundItemIdParamSchema, "params"),
    validateRequest(updateFoundItemZodSchema),
    FoundItemController.update,
);

export const FoundItemRoutes: Router = router;
