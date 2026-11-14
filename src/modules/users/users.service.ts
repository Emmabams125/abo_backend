import { Prisma } from "@prisma/client";
import { NotFoundError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";
import { SocketEvents } from "@/realtime/events";
import { emitToCircle } from "@/realtime/socket.server";
import { decryptField, encryptField } from "@/common/utils/encryption";
import { usersRepository } from "@/modules/users/users.repository";

interface ProfileUpdateInput {
  name?: string;
  avatarUrl?: string;
  emergencyContacts?: object;
  medicalInfo?: string | null;
}

function toPublicProfile(user: Awaited<ReturnType<typeof usersRepository.findById>>) {
  if (!user) throw new NotFoundError("User not found");
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emergencyContacts: user.emergencyContacts,
    // FR-PRO-01: medical info is optional and encrypted at rest — decrypted only for the owner, on read.
    medicalInfo: user.medicalInfoEncrypted ? decryptField(user.medicalInfoEncrypted) : null,
    createdAt: user.createdAt,
  };
}

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    return toPublicProfile(user);
  },

  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const user = await usersRepository.updateProfile(userId, {
      name: input.name,
      avatarUrl: input.avatarUrl,
      emergencyContacts: input.emergencyContacts,
      medicalInfoEncrypted:
        input.medicalInfo === undefined ? undefined : input.medicalInfo === null ? null : encryptField(input.medicalInfo),
    });
    return toPublicProfile(user);
  },

  /**
   * Account deletion (Google Play requirement). Personal data is erased and
   * the phone number freed for a fresh sign-up; the row itself stays,
   * anonymised, because SOS events, messages and audit logs reference it.
   * A sole Admin hands the Circle to its longest-standing member.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");

    const memberships = await prisma.circleMembership.findMany({
      where: { userId, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
    });

    await prisma.$transaction(async (tx) => {
      for (const membership of memberships) {
        if (membership.status === "ACTIVE" && membership.role === "ADMIN") {
          const otherAdmins = await tx.circleMembership.count({
            where: { circleId: membership.circleId, role: "ADMIN", status: "ACTIVE", userId: { not: userId } },
          });
          if (otherAdmins === 0) {
            const successor = await tx.circleMembership.findFirst({
              where: { circleId: membership.circleId, status: "ACTIVE", userId: { not: userId } },
              orderBy: { joinedAt: "asc" },
            });
            if (successor) {
              await tx.circleMembership.update({ where: { id: successor.id }, data: { role: "ADMIN" } });
              await tx.auditLog.create({
                data: {
                  circleId: membership.circleId,
                  actorId: userId,
                  action: "ROLE_CHANGED",
                  targetUserId: successor.userId,
                  metadata: { previousRole: successor.role, newRole: "ADMIN", reason: "ADMIN_DELETED_ACCOUNT" },
                },
              });
            }
          }
        }
        await tx.circleMembership.update({ where: { id: membership.id }, data: { status: "REMOVED" } });
      }

      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.device.deleteMany({ where: { userId } });
      await tx.locationPing.deleteMany({ where: { userId } });
      await tx.safePlaceEvent.deleteMany({ where: { userId } });
      await tx.checkInReminder.deleteMany({ where: { userId } });
      await tx.otpChallenge.deleteMany({ where: { phone: user.phone } });
      await tx.user.update({
        where: { id: userId },
        data: {
          phone: `deleted:${userId}`,
          email: null,
          name: null,
          avatarUrl: null,
          emergencyContacts: Prisma.DbNull,
          medicalInfoEncrypted: null,
        },
      });
    });

    for (const membership of memberships) {
      emitToCircle(membership.circleId, SocketEvents.MembershipChanged, {
        membershipId: membership.id,
        userId,
        action: "MEMBER_REMOVED",
      });
    }
  },
};
