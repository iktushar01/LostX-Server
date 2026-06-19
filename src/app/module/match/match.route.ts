import { Router } from "express";
import { z } from "zod";
import { ItemCategory, Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { MatchController } from "./match.controller";

const router = Router();
const allRoles = [Role.CLIENT, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] as const;

const itemIdParamSchema = z.object({
    id: z.string().min(1),
});

const draftMatchQuerySchema = z.object({
    title: z.string().min(1).max(120).trim(),
    description: z.string().min(1).max(500).trim(),
    category: z.nativeEnum(ItemCategory),
    location: z.string().min(1).max(200).trim(),
    dateFound: z.coerce.date(),
});

router.get("/browse", MatchController.browseSuggestions);

router.get(
    "/draft",
    checkAuth(...allRoles),
    validateRequest(draftMatchQuerySchema, "query"),
    MatchController.draftMatches,
);

router.get(
    "/for-lost/:id",
    validateRequest(itemIdParamSchema, "params"),
    MatchController.forLostItem,
);

router.get(
    "/for-found/:id",
    validateRequest(itemIdParamSchema, "params"),
    MatchController.forFoundItem,
);

export const MatchRoutes: Router = router;
