import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { subscriptionController } from "@/modules/subscription/subscription.controller";
import { changeTierSchema, circleIdParamsSchema } from "@/modules/subscription/subscription.validation";

export const subscriptionRouter = Router();

// FR-SUB-01: plan comparison is public (no auth) so it can be shown pre-signup too.
subscriptionRouter.get("/plans", asyncHandler(subscriptionController.getPlans));

subscriptionRouter.use(requireAuth);

subscriptionRouter.get(
  "/circles/:circleId",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(subscriptionController.getSubscription)
);

subscriptionRouter.patch(
  "/circles/:circleId",
  validate({ params: circleIdParamsSchema, body: changeTierSchema }),
  asyncHandler(subscriptionController.changeTier)
);

subscriptionRouter.get(
  "/circles/:circleId/invoices",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(subscriptionController.listInvoices)
);
