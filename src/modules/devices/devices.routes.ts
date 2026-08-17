import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { devicesController } from "@/modules/devices/devices.controller";
import { deviceParamsSchema, registerDeviceSchema } from "@/modules/devices/devices.validation";

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.get("/", asyncHandler(devicesController.list));
devicesRouter.post("/", validate({ body: registerDeviceSchema }), asyncHandler(devicesController.register));
devicesRouter.delete(
  "/:deviceId",
  validate({ params: deviceParamsSchema }),
  asyncHandler(devicesController.unpair)
);
