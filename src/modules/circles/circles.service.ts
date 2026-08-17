import crypto from "node:crypto";
import type { CircleRole } from "@prisma/client";
import { env } from "@/config/env";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { circlesRepository } from "@/modules/circles/circles.repository";

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

    const membership = await circlesRepository.createMembership(invite.circleId, userId, "ADULT", status);
    await circlesRepository.markInviteAccepted(invite.id);

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
    return updated;
  },

  async removeMember(circleId: string, membershipId: string, actorId: string) {
    await requireActiveAdmin(circleId, actorId);
    const membership = await circlesRepository.findMembershipById(membershipId);
    if (!membership || membership.circleId !== circleId) throw new NotFoundError("Membership not found");

    const updated = await circlesRepository.removeMembership(membershipId);
    await circlesRepository.writeAuditLog(circleId, actorId, "MEMBER_REMOVED", membership.userId);
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
