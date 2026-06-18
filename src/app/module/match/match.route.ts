import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validateRequest";
import { MatchController } from "./match.controller";

const router = Router();

const itemIdParamSchema = z.object({
    id: z.string().min(1),
});

router.get("/browse", MatchController.browseSuggestions);

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
