import { Router } from "express";
import { Role } from "../../lib/prisma-exports.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { memoryUpload } from "../../../config/multer.config.js";
import { AuthController } from "./auth.controller.js";
import { 
    registerClientZodSchema,
    loginZodSchema,
    verifyEmailZodSchema,
    resendVerificationOtpZodSchema,
    forgetPasswordZodSchema,
    resetPasswordZodSchema,
 changePasswordZodSchema,
    updateProfileZodSchema,
    deleteAccountZodSchema,
 } from "./auth.validation.js";



const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

router.post(
    "/register",
    memoryUpload.single("image"),
    validateRequest(registerClientZodSchema),
    AuthController.registerClient,
);

router.post(
    "/login",
    validateRequest(loginZodSchema),
    AuthController.loginUser,
);

router.post("/refresh-token", AuthController.getNewTokens);

router.post(
    "/verify-email",
    validateRequest(verifyEmailZodSchema),
    AuthController.verifyEmail,
);

router.post(
    "/resend-verification-otp",
    validateRequest(resendVerificationOtpZodSchema),
    AuthController.resendVerificationOtp,
);

router.post(
    "/forget-password",
    validateRequest(forgetPasswordZodSchema),
    AuthController.forgetPassword,
);

router.post(
    "/reset-password",
    validateRequest(resetPasswordZodSchema),
    AuthController.resetPassword,
);

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get("/login/google", AuthController.googleLogin);
router.get("/google/success", AuthController.googleLoginSuccess);
router.get("/oauth/code", AuthController.exchangeOAuthCode);
router.get("/oauth/error", AuthController.handleOAuthError);

// ─── Authenticated routes (all roles) ────────────────────────────────────────

const allRoles = [Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/me", checkAuth(...allRoles), AuthController.getMe);

router.patch(
    "/me",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(updateProfileZodSchema),
    AuthController.updateProfile,
);

router.post(
    "/change-password",
    checkAuth(...allRoles),
    validateRequest(changePasswordZodSchema),
    AuthController.changePassword,
);

router.post("/logout", checkAuth(...allRoles), AuthController.logoutUser);

router.post(
    "/delete-account",
    checkAuth(...allRoles),
    validateRequest(deleteAccountZodSchema),
    AuthController.deleteAccount,
);

export const AuthRoute: Router = router;
