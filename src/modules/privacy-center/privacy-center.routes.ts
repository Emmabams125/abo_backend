import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { privacyCenterController } from "@/modules/privacy-center/privacy-center.controller";

export const privacyCenterRouter = Router();

privacyCenterRouter.use(requireAuth);

privacyCenterRouter.get(
  "/circles/:circleId",
  validate({ params: z.object({ circleId: z.string().uuid() }) }),
  asyncHandler(privacyCenterController.get)
);
