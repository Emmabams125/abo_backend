import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { otpRequestLimiter } from "@/common/middleware/rate-limit";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { authController } from "@/modules/auth/auth.controller";
import {
  reauthVerifySchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from "@/modules/auth/auth.validation";

export const authRouter = Router();

authRouter.post(
  "/otp/request",
  otpRequestLimiter,
  validate({ body: requestOtpSchema }),
  asyncHandler(authController.requestOtp)
);

authRouter.post(
  "/otp/verify",
  validate({ body: verifyOtpSchema }),
  asyncHandler(authController.verifyOtp)
);

authRouter.post("/refresh", validate({ body: refreshSchema }), asyncHandler(authController.refresh));

authRouter.post("/logout", validate({ body: refreshSchema }), asyncHandler(authController.logout));

authRouter.post(
  "/reauth/request",
  requireAuth,
  otpRequestLimiter,
  validate({ body: requestOtpSchema }),
  asyncHandler(authController.requestReauthOtp)
);

authRouter.post(
  "/reauth/verify",
  requireAuth,
  validate({ body: reauthVerifySchema }),
  asyncHandler(authController.verifyReauth)
);
