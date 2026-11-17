import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { blockParamsSchema, blocksController } from "@/modules/users/blocks";
import { usersController } from "@/modules/users/users.controller";
import { updateProfileSchema } from "@/modules/users/users.validation";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/me", asyncHandler(usersController.getMe));
usersRouter.delete("/me", asyncHandler(usersController.deleteMe));
usersRouter.patch("/me", validate({ body: updateProfileSchema }), asyncHandler(usersController.updateMe));

usersRouter.get("/me/blocks", asyncHandler(blocksController.list));
usersRouter.post("/:userId/block", validate({ params: blockParamsSchema }), asyncHandler(blocksController.block));
usersRouter.delete("/:userId/block", validate({ params: blockParamsSchema }), asyncHandler(blocksController.unblock));
