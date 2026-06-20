import { Router } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ClaimMessageController } from "../claim-message/claim-message.controller.js";
import { ClaimController } from "./claim.controller.js";
import {
    claimMessageParamSchema,
    createClaimMessageZodSchema,
} from "../claim-message/claim-message.validation.js";
import {
    claimIdParamSchema,
    createClaimZodSchema,
    quickClaimZodSchema,
    updateClaimStatusZodSchema,
    verificationQuestionsZodSchema,
    verificationQuestionsPreviewZodSchema,
} from "./claim.validation.js";

const router = Router();
const allRoles = [Role.CLIENT, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;
const staffAndAdminRoles = [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.post(
    "/",
    checkAuth(...allRoles),
    validateRequest(createClaimZodSchema),
    ClaimController.create,
);

router.post(
    "/quick",
    checkAuth(...allRoles),
    validateRequest(quickClaimZodSchema),
    ClaimController.createQuick,
);

router.post(
    "/verification-questions/preview",
    checkAuth(...allRoles),
    validateRequest(verificationQuestionsPreviewZodSchema),
    ClaimController.generateVerificationQuestionsPreview,
);

router.post(
    "/verification-questions",
    checkAuth(...allRoles),
    validateRequest(verificationQuestionsZodSchema),
    ClaimController.generateVerificationQuestions,
);

router.get(
    "/mine",
    checkAuth(...allRoles),
    ClaimController.listMine,
);

router.get(
    "/",
    checkAuth(...staffAndAdminRoles),
    ClaimController.listAll,
);

router.get(
    "/:id/messages",
    checkAuth(...allRoles),
    validateRequest(claimMessageParamSchema, "params"),
    ClaimMessageController.listByClaim,
);

router.post(
    "/:id/messages",
    checkAuth(...allRoles),
    validateRequest(claimMessageParamSchema, "params"),
    validateRequest(createClaimMessageZodSchema),
    ClaimMessageController.create,
);

router.get(
    "/:id",
    checkAuth(...allRoles),
    validateRequest(claimIdParamSchema, "params"),
    ClaimController.getById,
);

router.patch(
    "/:id/confirm-received",
    checkAuth(...allRoles),
    validateRequest(claimIdParamSchema, "params"),
    ClaimController.confirmReceived,
);

router.patch(
    "/:id/status",
    checkAuth(...staffAndAdminRoles),
    validateRequest(claimIdParamSchema, "params"),
    validateRequest(updateClaimStatusZodSchema),
    ClaimController.updateStatus,
);

export const ClaimRoutes: Router = router;
