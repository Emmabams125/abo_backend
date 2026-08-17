import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { homeController } from "@/modules/home/home.controller";
import { circleIdParamsSchema } from "@/modules/home/home.validation";

export const homeRouter = Router();

homeRouter.use(requireAuth);

homeRouter.get(
  "/circles/:circleId",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(homeController.getDashboard)
);
