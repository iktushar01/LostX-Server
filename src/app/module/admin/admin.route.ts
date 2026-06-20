import { Router } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AdminController } from "./admin.controller.js";
import { adminFeatureItemZodSchema, adminItemTypeParamSchema } from "./admin.validation.js";

const router = Router();
const staffAndAdminRoles = [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;
const adminOnlyRoles = [Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/stats", checkAuth(...staffAndAdminRoles), AdminController.getStats);
router.get("/analytics", checkAuth(...staffAndAdminRoles), AdminController.getAnalytics);
router.get("/audit-logs", checkAuth(...adminOnlyRoles), AdminController.getAuditLogs);
router.get("/items", checkAuth(...staffAndAdminRoles), AdminController.listItems);
router.patch(
    "/items/:type/:id/feature",
    checkAuth(...staffAndAdminRoles),
    validateRequest(adminItemTypeParamSchema, "params"),
    validateRequest(adminFeatureItemZodSchema),
    AdminController.setItemFeatured,
);
router.delete(
    "/items/:type/:id",
    checkAuth(...adminOnlyRoles),
    validateRequest(adminItemTypeParamSchema, "params"),
    AdminController.deleteItem,
);

export const AdminRoutes: Router = router;
