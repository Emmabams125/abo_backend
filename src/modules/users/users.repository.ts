import { prisma } from "@/db/prisma.client";

export const usersRepository = {
  findById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  updateProfile(
    userId: string,
    data: {
      name?: string;
      avatarUrl?: string;
      emergencyContacts?: object;
      medicalInfoEncrypted?: string | null;
    }
  ) {
    return prisma.user.update({ where: { id: userId }, data });
  },
};
