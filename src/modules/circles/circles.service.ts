import crypto from "node:crypto";
import type { CircleRole } from "@prisma/client";
import { env } from "@/config/env";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { emitToCircle, emitToUser } from "@/realtime/socket.server";
import { SocketEvents, type MembershipChangedPayload } from "@/realtime/events";

/** Tells the Circle (and the member themself, via their personal room). */
function notifyMembershipChanged(circleId: string, payload: MembershipChangedPayload) {
  emitToCircle(circleId, SocketEvents.MembershipChanged, payload);
  emitToUser(payload.userId, SocketEvents.MembershipChanged, payload);
}

async function requireActiveAdmin(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE" || membership.role !== "ADMIN") {
    throw new ForbiddenError("Only Circle Admins can perform this action");
  }
  return membership;
}

export const circlesService = {
  createCircle(name: string, creatorId: string) {
    return circlesRepository.createCircleWithAdmin(name, creatorId);
  },

  async listMembers(circleId: string, requesterId: string) {
    const membership = await circlesRepository.findMembership(circleId, requesterId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You are not a member of this Circle");
    }
    return circlesRepository.listActiveMemberships(circleId);
  },

  /** Join requests waiting for an Admin (FR-ONB-02). */
  async listPendingMemberships(circleId: string, requesterId: string) {
    await requireActiveAdmin(circleId, requesterId);
    return circlesRepository.listPendingMemberships(circleId);
  },

  /** The caller's Circles and pending requests, so the app knows where to land. */
  listMyMemberships(userId: string) {
    return circlesRepository.listMembershipsForUser(userId);
  },

  /** FR-ONB-02: invite links expire after 7 days. */
  async createInvite(circleId: string, actorId: string) {
    const membership = await circlesRepository.findMembership(circleId, actorId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You are not a member of this Circle");
    }
    const code = crypto.randomBytes(6).toString("hex");
    const expiresAt = new Date(Date.now() + env.CIRCLE_INVITE_TTL_DAYS * 86_400_000);
    return circlesRepository.createInvite(circleId, code, actorId, expiresAt);
  },

  /**
   * FR-ONB-02: joining requires the inviter's approval if the Circle has an
   * Admin role set — i.e. if the Circle currently has an active Admin, new
   * joins land as PENDING_APPROVAL until that Admin approves them.
   */
  async acceptInvite(code: string, userId: string) {
    const invite = await circlesRepository.findInviteByCode(code);
    if (!invite || invite.status !== "PENDING") {
      throw new BadRequestError("Invite is invalid or has already been used");
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestError("Invite has expired");
    }

    const existingMembership = await circlesRepository.findMembership(invite.circleId, userId);
    if (existingMembership && existingMembership.status !== "REMOVED") {
      throw new ConflictError("You are already a member of this Circle");
    }

    const circleHasAdmin = await circlesRepository.hasActiveAdmin(invite.circleId);
    const status = circleHasAdmin ? "PENDING_APPROVAL" : "ACTIVE";

    // A user removed earlier re-joins by reviving their old row (userId+circleId is unique).
    const membership = existingMembership
      ? await circlesRepository.reviveMembership(existingMembership.id, status)
      : await circlesRepository.createMembership(invite.circleId, userId, "ADULT", status);
    await circlesRepository.markInviteAccepted(invite.id);
    notifyMembershipChanged(invite.circleId, {
      membershipId: membership.id,
      userId,
      action: status === "PENDING_APPROVAL" ? "MEMBERSHIP_REQUESTED" : "MEMBERSHIP_APPROVED",
    });

    return { membership, requiresApproval: status === "PENDING_APPROVAL" };
  },

  async approveMembership(circleId: string, membershipId: string, actorId: string) {
    await requireActiveAdmin(circleId, actorId);
    const membership = await circlesRepository.findMembershipById(membershipId);
    if (!membership || membership.circleId !== circleId) throw new NotFoundError("Membership not found");
    if (membership.status !== "PENDING_APPROVAL") {
      throw new BadRequestError("Membership is not pending approval");
    }
    const updated = await circlesRepository.approveMembership(membershipId);
    await circlesRepository.writeAuditLog(circleId, actorId, "MEMBERSHIP_APPROVED", membership.userId);
    notifyMembershipChanged(circleId, { membershipId, userId: membership.userId, action: "MEMBERSHIP_APPROVED" });
    return updated;
  },

  /** Admin turns down a join request; the requester can be invited again later. */
  async declineMembership(circleId: string, membershipId: string, actorId: string) {
    await requireActiveAdmin(circleId, actorId);
    const membership = await circlesRepository.findMembershipById(membershipId);
    if (!membership || membership.circleId !== circleId) throw new NotFoundError("Membership not found");
    if (membership.status !== "PENDING_APPROVAL") {
      throw new BadRequestError("Membership is not pending approval");
    }
    const updated = await circlesRepository.removeMembership(membershipId);
    await circlesRepository.writeAuditLog(circleId, actorId, "MEMBERSHIP_DECLINED", membership.userId);
    notifyMembershipChanged(circleId, { membershipId, userId: membership.userId, action: "MEMBERSHIP_DECLINED" });
    return updated;
  },

  /** FR-ONB-04: only Admins can assign/change roles; every change is logged. */
  async changeRole(circleId: string, membershipId: string, newRole: CircleRole, actorId: string) {
    await requireActiveAdmin(circleId, actorId);
    const membership = await circlesRepository.findMembershipById(membershipId);
    if (!membership || membership.circleId !== circleId) throw new NotFoundError("Membership not found");

    const previousRole = membership.role;
    const updated = await circlesRepository.updateMembershipRole(membershipId, newRole);
    await circlesRepository.writeAuditLog(circleId, actorId, "ROLE_CHANGED", membership.userId, {
      previousRole,
      newRole,
    });
    notifyMembershipChanged(circleId, { membershipId, userId: membership.userId, action: "ROLE_CHANGED" });
    return updated;
  },

  async removeMember(circleId: string, membershipId: string, actorId: string) {
    await requireActiveAdmin(circleId, actorId);
    const membership = await circlesRepository.findMembershipById(membershipId);
    if (!membership || membership.circleId !== circleId) throw new NotFoundError("Membership not found");

    const updated = await circlesRepository.removeMembership(membershipId);
    await circlesRepository.writeAuditLog(circleId, actorId, "MEMBER_REMOVED", membership.userId);
    notifyMembershipChanged(circleId, { membershipId, userId: membership.userId, action: "MEMBER_REMOVED" });
    return updated;
  },

  /** FR-ONB-05: Managed Member must acknowledge the transparency notice on their own device. */
  async acknowledgeManagedNotice(circleId: string, membershipId: string, userId: string) {
    const membership = await circlesRepository.findMembershipById(membershipId);
    if (!membership || membership.circleId !== circleId) throw new NotFoundError("Membership not found");
    if (membership.userId !== userId) {
      throw new ForbiddenError("Only the Managed Member can acknowledge this notice");
    }
    return circlesRepository.acknowledgeManagedNotice(membershipId);
  },

  async listAuditLogs(circleId: string, actorId: string) {
    await requireActiveAdmin(circleId, actorId);
    return circlesRepository.listAuditLogs(circleId);
  },
};
