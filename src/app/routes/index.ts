import express, { type Router } from "express";
import { AuthRoute } from "../module/auth/auth.route";
import { UserRoutes } from "../module/user/user.route";
import { LostItemRoutes } from "../module/lost-item/lost-item.route";
import { FoundItemRoutes } from "../module/found-item/found-item.route";
import { ClaimRoutes } from "../module/claim/claim.route";
import { AdminRoutes } from "../module/admin/admin.route";
import { DashboardRoutes } from "../module/dashboard/dashboard.route";
import { MatchRoutes } from "../module/match/match.route";
import { NotificationRoutes } from "../module/notification/notification.route";

import { ChatbotRoutes } from "../module/chatbot/chatbot.route";

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
