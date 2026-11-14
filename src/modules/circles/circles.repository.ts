import { prisma } from "@/db/prisma.client";
import type { CircleRole } from "@prisma/client";

/**
 * What Circle members may see of each other. Email, emergency contacts and
 * medical info stay private to the account owner.
 */
const memberUserFields = { id: true, phone: true, name: true, avatarUrl: true } as const;

export const circlesRepository = {
  createCircleWithAdmin(name: string, creatorId: string) {
    return prisma.$transaction(async (tx) => {
      const circle = await tx.familyCircle.create({ data: { name, createdBy: creatorId } });
      await tx.circleMembership.create({
        data: { circleId: circle.id, userId: creatorId, role: "ADMIN", status: "ACTIVE" },
      });
      await tx.locationRetentionSetting.create({ data: { circleId: circle.id } });
      return circle;
    });
  },

  findCircleById(circleId: string) {
    return prisma.familyCircle.findUnique({ where: { id: circleId } });
  },

  findMembership(circleId: string, userId: string) {
    return prisma.circleMembership.findUnique({
      where: { userId_circleId: { userId, circleId } },
    });
  },

  findMembershipById(membershipId: string) {
    return prisma.circleMembership.findUnique({ where: { id: membershipId } });
  },

  async listActiveCircleIdsForUser(userId: string) {
    const memberships = await prisma.circleMembership.findMany({
      where: { userId, status: "ACTIVE" },
      select: { circleId: true },
    });
    return memberships.map((m) => m.circleId);
  },

  listActiveMemberships(circleId: string) {
    return prisma.circleMembership.findMany({
      where: { circleId, status: "ACTIVE" },
      include: { user: { select: memberUserFields } },
      orderBy: { joinedAt: "asc" },
    });
  },

  listPendingMemberships(circleId: string) {
    return prisma.circleMembership.findMany({
      where: { circleId, status: "PENDING_APPROVAL" },
      include: { user: { select: memberUserFields } },
      orderBy: { joinedAt: "asc" },
    });
  },

  /** Every Circle the user belongs to or has asked to join, newest first. */
  listMembershipsForUser(userId: string) {
    return prisma.circleMembership.findMany({
      where: { userId, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
      include: { circle: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "desc" },
    });
  },

  hasActiveAdmin(circleId: string) {
    return prisma.circleMembership
      .count({ where: { circleId, role: "ADMIN", status: "ACTIVE" } })
      .then((count) => count > 0);
  },

  createMembership(circleId: string, userId: string, role: CircleRole, status: "ACTIVE" | "PENDING_APPROVAL") {
    return prisma.circleMembership.create({ data: { circleId, userId, role, status } });
  },

  reviveMembership(membershipId: string, status: "ACTIVE" | "PENDING_APPROVAL") {
    return prisma.circleMembership.update({
      where: { id: membershipId },
      data: { status, role: "ADULT", joinedAt: new Date() },
    });
  },

  updateMembershipRole(membershipId: string, role: CircleRole) {
    return prisma.circleMembership.update({ where: { id: membershipId }, data: { role } });
  },

  approveMembership(membershipId: string) {
    return prisma.circleMembership.update({ where: { id: membershipId }, data: { status: "ACTIVE" } });
  },

  removeMembership(membershipId: string) {
    return prisma.circleMembership.update({ where: { id: membershipId }, data: { status: "REMOVED" } });
  },

  acknowledgeManagedNotice(membershipId: string) {
    return prisma.circleMembership.update({
      where: { id: membershipId },
      data: { managedNoticeAckedAt: new Date() },
    });
  },

  // ── Invites ──────────────────────────────────────────────────

  createInvite(circleId: string, code: string, createdBy: string, expiresAt: Date) {
    return prisma.circleInvite.create({ data: { circleId, code, createdBy, expiresAt } });
  },

  findInviteByCode(code: string) {
    return prisma.circleInvite.findUnique({ where: { code } });
  },

  markInviteAccepted(inviteId: string) {
    return prisma.circleInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED" } });
  },

  // ── Audit log ────────────────────────────────────────────────

  writeAuditLog(circleId: string, actorId: string, action: string, targetUserId?: string, metadata?: object) {
    return prisma.auditLog.create({
      data: { circleId, actorId, action, targetUserId, metadata },
    });
  },

  listAuditLogs(circleId: string) {
    return prisma.auditLog.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } });
  },
};
