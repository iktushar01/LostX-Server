import express from "express";
import { AuthRoute } from "../module/auth/auth.route";
import { UserRoutes } from "../module/user/user.route";
import { LostItemRoutes } from "../module/lost-item/lost-item.route";
import { FoundItemRoutes } from "../module/found-item/found-item.route";
import { ClaimRoutes } from "../module/claim/claim.route";

const router = express.Router();

router.use("/auth", AuthRoute);
router.use("/users", UserRoutes);
router.use("/lost-items", LostItemRoutes);
router.use("/found-items", FoundItemRoutes);
router.use("/claims", ClaimRoutes);

export const IndexRoute = router;
