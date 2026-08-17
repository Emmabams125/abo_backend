import { Router } from "express";
import { requireAuth, requireReauth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { circlesController } from "@/modules/circles/circles.controller";
import {
  acceptInviteSchema,
  changeRoleSchema,
  circleIdParamsSchema,
  createCircleSchema,
  membershipParamsSchema,
} from "@/modules/circles/circles.validation";

export const circlesRouter = Router();

circlesRouter.use(requireAuth);

circlesRouter.post("/", validate({ body: createCircleSchema }), asyncHandler(circlesController.create));

circlesRouter.get(
  "/:circleId/members",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(circlesController.listMembers)
);

circlesRouter.post(
  "/:circleId/invites",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(circlesController.createInvite)
);

circlesRouter.post(
  "/invites/accept",
  validate({ body: acceptInviteSchema }),
  asyncHandler(circlesController.acceptInvite)
);

circlesRouter.post(
  "/:circleId/memberships/:membershipId/approve",
  validate({ params: membershipParamsSchema }),
  asyncHandler(circlesController.approveMembership)
);

// FR-PRO-02: role changes require a fresh reauth token.
circlesRouter.patch(
  "/:circleId/memberships/:membershipId/role",
  requireReauth,
  validate({ params: membershipParamsSchema, body: changeRoleSchema }),
  asyncHandler(circlesController.changeRole)
);

circlesRouter.delete(
  "/:circleId/memberships/:membershipId",
  requireReauth,
  validate({ params: membershipParamsSchema }),
  asyncHandler(circlesController.removeMember)
);

circlesRouter.post(
  "/:circleId/memberships/:membershipId/acknowledge-notice",
  validate({ params: membershipParamsSchema }),
  asyncHandler(circlesController.acknowledgeManagedNotice)
);

circlesRouter.get(
  "/:circleId/audit-logs",
  validate({ params: circleIdParamsSchema }),
  asyncHandler(circlesController.listAuditLogs)
);
