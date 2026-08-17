import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { locationController } from "@/modules/location/location.controller";
import {
  circleIdParamsSchema,
  createSafePlaceSchema,
  memberLocationParamsSchema,
  pingSchema,
  retentionSchema,
  safePlaceParamsSchema,
} from "@/modules/location/location.validation";

export const locationRouter = Router();

locationRouter.use(requireAuth);

// FR-LOC-01
locationRouter.post("/ping", validate({ body: pingSchema }), asyncHandler(locationController.ping));

locationRouter.get(
  "/circles/:circleId/members/:userId",
  validate({ params: memberLocationParamsSchema }),
  asyncHandler(locationController.getMemberLocation)
);

// FR-LOC-03
locationRouter.get(
  "/circles/:circleId/members/:userId/history",
  validate({ params: memberLocationParamsSchema }),
  asyncHandler(locationController.getMemberHistory)
);

locationRouter.patch(
  "/circles/:circleId/retention",
  validate({ params: circleIdParamsSchema, body: retentionSchema }),
  asyncHandler(locationController.updateRetention)
);

// FR-LOC-02: Safe Places
locationRouter.post(
  "/circles/:circleId/safe-places",
  validate({ params: circleIdParamsSchema, body: createSafePlaceSchema }),
  asyncHandler(locationController.createSafePlace)
);

locationRouter.get(
  "/circles/:circleId/safe-places",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(locationController.listSafePlaces)
);

locationRouter.delete(
  "/circles/:circleId/safe-places/:safePlaceId",
  validate({ params: safePlaceParamsSchema }),
  asyncHandler(locationController.deleteSafePlace)
);
