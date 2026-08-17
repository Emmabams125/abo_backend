import { NotFoundError } from "@/common/errors/app-error";
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
};
