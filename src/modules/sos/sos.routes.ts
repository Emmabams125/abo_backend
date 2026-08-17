import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { sosController } from "@/modules/sos/sos.controller";
import { sosEventParamsSchema, triggerSosSchema } from "@/modules/sos/sos.validation";

export const sosRouter = Router();

sosRouter.use(requireAuth);

// FR-SOS-01/02
sosRouter.post("/trigger", validate({ body: triggerSosSchema }), asyncHandler(sosController.trigger));

sosRouter.post(
  "/:sosEventId/acknowledge",
  validate({ params: sosEventParamsSchema }),
  asyncHandler(sosController.acknowledge)
);

sosRouter.post(
  "/:sosEventId/resolve",
  validate({ params: sosEventParamsSchema }),
  asyncHandler(sosController.resolve)
);

// FR-SOS-03
sosRouter.get("/:sosEventId/log", validate({ params: sosEventParamsSchema }), asyncHandler(sosController.getLog));
