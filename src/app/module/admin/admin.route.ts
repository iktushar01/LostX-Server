import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { adminFeatureItemZodSchema, adminItemTypeParamSchema } from "./admin.validation";

const router = Router();
const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/stats", checkAuth(...adminRoles), AdminController.getStats);
router.get("/items", checkAuth(...adminRoles), AdminController.listItems);
router.patch(
    "/items/:type/:id/feature",
    checkAuth(...adminRoles),
    validateRequest(adminItemTypeParamSchema, "params"),
    validateRequest(adminFeatureItemZodSchema),
    AdminController.setItemFeatured,
);
router.delete(
    "/items/:type/:id",
    checkAuth(...adminRoles),
    validateRequest(adminItemTypeParamSchema, "params"),
    AdminController.deleteItem,
);

export const AdminRoutes: Router = router;
