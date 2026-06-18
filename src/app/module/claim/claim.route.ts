import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ClaimController } from "./claim.controller";
import {
    claimIdParamSchema,
    createClaimZodSchema,
    updateClaimStatusZodSchema,
} from "./claim.validation";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;
const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN] as const;

router.post(
    "/",
    checkAuth(...allRoles),
    validateRequest(createClaimZodSchema),
    ClaimController.create,
);

router.get(
    "/mine",
    checkAuth(...allRoles),
    ClaimController.listMine,
);

router.get(
    "/",
    checkAuth(...adminRoles),
    ClaimController.listAll,
);

router.get(
    "/:id",
    checkAuth(...adminRoles),
    validateRequest(claimIdParamSchema, "params"),
    ClaimController.getById,
);

router.patch(
    "/:id/status",
    checkAuth(...adminRoles),
    validateRequest(claimIdParamSchema, "params"),
    validateRequest(updateClaimStatusZodSchema),
    ClaimController.updateStatus,
);

export const ClaimRoutes: Router = router;
