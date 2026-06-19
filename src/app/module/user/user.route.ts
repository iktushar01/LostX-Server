import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserProfileController } from "../user-profile/user-profile.controller";
import {
    adminUpdateReportSchema,
    createReportSchema,
    createReviewSchema,
    listReviewsQuerySchema,
    userIdParamSchema,
} from "../user-profile/user-profile.validation";
import { createAdminZodSchema } from "./user.validation";
import { z } from "zod";

const router = Router();
const allRoles = [Role.CLIENT, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;
const adminOnlyRoles = [Role.ADMIN, Role.SUPER_ADMIN] as const;

const reportIdParamSchema = z.object({ id: z.string().min(1) });

router.post(
    "/create-admin",
    checkAuth(Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin,
);

router.get("/me/account", checkAuth(...allRoles), UserProfileController.getAccountSummary);

router.post(
    "/reports",
    checkAuth(...allRoles),
    validateRequest(createReportSchema),
    UserProfileController.createReport,
);

router.get(
    "/admin/reports",
    checkAuth(...adminOnlyRoles),
    UserProfileController.listReportsAdmin,
);

router.patch(
    "/admin/reports/:id",
    checkAuth(...adminOnlyRoles),
    validateRequest(reportIdParamSchema, "params"),
    validateRequest(adminUpdateReportSchema),
    UserProfileController.updateReportAdmin,
);

router.get(
    "/:id/profile",
    checkAuth(...allRoles),
    validateRequest(userIdParamSchema, "params"),
    UserProfileController.getPublicProfile,
);

router.get(
    "/:id/reviews/eligible-claims",
    checkAuth(...allRoles),
    validateRequest(userIdParamSchema, "params"),
    UserProfileController.getEligibleReviewClaims,
);

router.get(
    "/:id/reviews",
    checkAuth(...allRoles),
    validateRequest(userIdParamSchema, "params"),
    validateRequest(listReviewsQuerySchema, "query"),
    UserProfileController.listReviews,
);

router.post(
    "/:id/reviews",
    checkAuth(...allRoles),
    validateRequest(userIdParamSchema, "params"),
    validateRequest(createReviewSchema),
    UserProfileController.createReview,
);

export const UserRoutes: Router = router;
