import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { DashboardController } from "./dashboard.controller";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/stats", checkAuth(...allRoles), DashboardController.getStats);

export const DashboardRoutes = router;
