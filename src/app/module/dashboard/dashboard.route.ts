import { Router } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { DashboardController } from "./dashboard.controller.js";

const router = Router();
const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/stats", checkAuth(...allRoles), DashboardController.getStats);

export const DashboardRoutes: Router = router;
