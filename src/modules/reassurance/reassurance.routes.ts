import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { reassuranceController } from "@/modules/reassurance/reassurance.controller";
import {
  checkInSchema,
  circleIdParamsSchema,
  createReminderSchema,
  reminderParamsSchema,
} from "@/modules/reassurance/reassurance.validation";

export const reassuranceRouter = Router();

reassuranceRouter.use(requireAuth);

// FR-RSR-01
reassuranceRouter.post(
  "/check-in",
  validate({ body: checkInSchema }),
  asyncHandler(reassuranceController.checkIn)
);

// FR-RSR-02
reassuranceRouter.get(
  "/circles/:circleId/history",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(reassuranceController.getHistory)
);

// FR-RSR-03
reassuranceRouter.post(
  "/reminders",
  validate({ body: createReminderSchema }),
  asyncHandler(reassuranceController.createReminder)
);

reassuranceRouter.get("/reminders", asyncHandler(reassuranceController.listReminders));

reassuranceRouter.delete(
  "/reminders/:reminderId",
  validate({ params: reminderParamsSchema }),
  asyncHandler(reassuranceController.deleteReminder)
);
