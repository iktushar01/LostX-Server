import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { AdminController } from "./admin.controller";

const router = Router();
const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/stats", checkAuth(...adminRoles), AdminController.getStats);

export const AdminRoutes: Router = router;
