import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { mediaController } from "@/modules/media/media.controller";
import { uploadUrlSchema } from "@/modules/media/media.validation";

export const mediaRouter = Router();

mediaRouter.use(requireAuth);

mediaRouter.post(
  "/upload-url",
  validate({ body: uploadUrlSchema }),
  asyncHandler(mediaController.requestUploadUrl)
);
