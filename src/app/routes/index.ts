import express, { type Router } from "express";
import { AuthRoute } from "../module/auth/auth.route.js";
import { UserRoutes } from "../module/user/user.route.js";
import { LostItemRoutes } from "../module/lost-item/lost-item.route.js";
import { FoundItemRoutes } from "../module/found-item/found-item.route.js";
import { ClaimRoutes } from "../module/claim/claim.route.js";
import { AdminRoutes } from "../module/admin/admin.route.js";
import { DashboardRoutes } from "../module/dashboard/dashboard.route.js";
import { MatchRoutes } from "../module/match/match.route.js";
import { NotificationRoutes } from "../module/notification/notification.route.js";

import { ChatbotRoutes } from "../module/chatbot/chatbot.route.js";

const router = express.Router();

router.use("/auth", AuthRoute);
router.use("/users", UserRoutes);
router.use("/lost-items", LostItemRoutes);
router.use("/found-items", FoundItemRoutes);
router.use("/claims", ClaimRoutes);
router.use("/matches", MatchRoutes);
router.use("/notifications", NotificationRoutes);
router.use("/chatbot", ChatbotRoutes);
router.use("/dashboard", DashboardRoutes);
router.use("/admin", AdminRoutes);

export const IndexRoute: Router = router;
