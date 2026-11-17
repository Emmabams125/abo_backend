import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { communityAlertLimiter } from "@/common/middleware/rate-limit";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { communityController } from "@/modules/community/community.controller";
import {
  alertIdParamsSchema,
  createAlertSchema,
  nearbyQuerySchema,
  reportAlertSchema,
} from "@/modules/community/community.validation";

export const communityRouter = Router();

communityRouter.use(requireAuth);

communityRouter.post(
  "/",
  communityAlertLimiter,
  validate({ body: createAlertSchema }),
  asyncHandler(communityController.createAlert)
);

communityRouter.get(
  "/nearby",
  validate({ query: nearbyQuerySchema }),
  asyncHandler(communityController.listNearby)
);

communityRouter.post(
  "/:alertId/report",
  validate({ params: alertIdParamsSchema, body: reportAlertSchema }),
  asyncHandler(communityController.reportAlert)
);

communityRouter.patch(
  "/:alertId/resolve",
  validate({ params: alertIdParamsSchema }),
  asyncHandler(communityController.resolveAlert)
);
