import { prisma } from "@/db/prisma.client";
import type { CircleRole } from "@prisma/client";

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
      include: { user: true },
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
