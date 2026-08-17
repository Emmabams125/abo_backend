import { usersRepository } from "@/modules/users/users.repository";
import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** FR-PRO-01: medical info is only ever shared as part of an SOS broadcast. */
export async function getUsersPrivacyEntries(userId: string): Promise<PrivacyEntry[]> {
  const user = await usersRepository.findById(userId);
  if (!user?.medicalInfoEncrypted) return [];

  return [
    {
      feature: "Medical info",
      description: "Stored encrypted; only ever shared with the Circle if you trigger an SOS.",
      visibleTo: "Nobody, until an SOS is triggered",
    },
  ];
}
